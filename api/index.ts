/**
 * Vercel serverless API — Panic Word multiplayer backend.
 *
 * Self-contained vanilla JS (NO imports from /server — the project uses
 * "type": "module" and Vercel does not bundle api/ files, so extension-less
 * imports would crash with MODULE_NOT_FOUND).
 *
 * Serves the tRPC-style paths the client calls:
 *   POST /api/trpc/multi.createRoom
 *   POST /api/trpc/multi.joinRoom
 *   GET  /api/trpc/multi.getRoom?input=...
 *   POST /api/trpc/multi.reportRound
 *   POST /api/trpc/multi.finishGame
 *
 * The React client wraps responses with superjson, so we reply with
 *   { "result": { "data": { "json": <payload> } } }
 * which the tRPC react-query client unwraps transparently.
 *
 * Vercel automatically treats this file as a serverless function
 * (no app.listen — just export the handler).
 */

// ---------------------------------------------------------------------------
// In-memory rooms (volatile — fine for casual games; rooms expire after 30 min)
// ---------------------------------------------------------------------------
const rooms = new Map();
const ROOM_TTL_MS = 30 * 60 * 1000;

function gcRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    let active = false;
    for (const p of room.players.values()) {
      if (now - p.lastPing < ROOM_TTL_MS) active = true;
    }
    if (room.players.size === 0 || !active) rooms.delete(code);
  }
}

function clampDuration(ms) {
  if (ms === undefined || !Number.isFinite(ms)) return 3000;
  return Math.min(10000, Math.max(2000, Math.round(ms)));
}

function createRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

// ---------------------------------------------------------------------------
// tRPC-flavored helpers (superjson envelope the client expects)
// ---------------------------------------------------------------------------
function okJson(data) {
  return jsonResponse({ result: { data: { json: data } } });
}

function jsonResponse(obj, status = 200) {
  const body = JSON.stringify(obj);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function tRpcError(message) {
  return jsonResponse(
    {
      error: {
        json: { message, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } },
      },
    },
    500,
  );
}

async function readBody(req) {
  try {
    const text = await req.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    // tRPC httpBatchLink sends { json: { ... } }
    return parsed.json ?? parsed;
  } catch {
    return {};
  }
}

function parseGetInput(url) {
  try {
    const u = new URL(url, "https://x");
    const input = u.searchParams.get("input");
    if (!input) return {};
    const parsed = JSON.parse(input);
    return parsed.json ?? parsed;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleCreateRoom(body) {
  gcRooms();
  const { playerId, name, inputMode, roundDurationMs } = body;
  if (!playerId || !name) return tRpcError("playerId and name required");

  let code = createRoomCode();
  while (rooms.has(code)) code = createRoomCode(); // avoid collision (rare)

  const room = {
    code,
    hostId: playerId,
    startedAt: Date.now(),
    inputMode: inputMode === "voice" ? "voice" : "keyboard",
    roundDurationMs: clampDuration(roundDurationMs),
    players: new Map(),
  };
  room.players.set(playerId, {
    id: playerId,
    name: String(name).slice(0, 24),
    score: 0,
    wordsFound: 0,
    currentRound: 0,
    lastPing: Date.now(),
    finished: false,
  });
  rooms.set(code, room);
  return okJson({ code, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs });
}

function handleJoinRoom(body) {
  const code = String(body.code ?? "").trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return okJson({ ok: false, error: "not_found" });

  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  room.players.set(id, {
    id,
    name: String(body.name ?? "Joueur").slice(0, 24),
    score: 0,
    wordsFound: 0,
    currentRound: 0,
    lastPing: Date.now(),
    finished: false,
  });
  return okJson({
    ok: true,
    playerId: id,
    code: room.code,
    inputMode: room.inputMode,
    roundDurationMs: room.roundDurationMs,
  });
}

function handleGetRoom(code) {
  const room = rooms.get(String(code ?? "").trim().toUpperCase());
  if (!room) return okJson({ players: [], started: false });
  const players = Array.from(room.players.values())
    .map(({ id, name, score, wordsFound, currentRound, finished }) => ({
      id,
      name,
      score,
      wordsFound,
      currentRound,
      finished,
    }))
    .sort((a, b) => b.score - a.score);
  return okJson({ players, started: true, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs });
}

function handleReportRound(body) {
  const room = rooms.get(String(body.code ?? "").trim().toUpperCase());
  const player = room?.players.get(body.playerId);
  if (!room || !player) return okJson({ ok: false });
  player.score += Number(body.roundScore ?? 0);
  if (body.found) player.wordsFound += 1;
  player.currentRound = Number(body.round ?? 0);
  player.lastPing = Date.now();
  return okJson({ ok: true, score: player.score });
}

function handleFinishGame(body) {
  const room = rooms.get(String(body.code ?? "").trim().toUpperCase());
  const player = room?.players.get(body.playerId);
  if (!room || !player) return okJson({ ok: false });
  player.finished = true;
  player.lastPing = Date.now();
  return okJson({ ok: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function handler(req) {
  const url = new URL(req.url);

  // Health / static hint
  if (url.pathname === "/api/health") {
    return jsonResponse({ ok: true, service: "panic-word-multi" });
  }

  const m = url.pathname.match(/^\/api\/trpc\/multi\.(\w+)$/);
  if (!m) {
    return jsonResponse({ error: `unknown path: ${url.pathname}` }, 404);
  }
  const proc = m[1];

  try {
    if (req.method === "GET") {
      if (proc !== "getRoom") return tRpcError(`GET not supported for ${proc}`);
      return handleGetRoom(parseGetInput(url).code);
    }
    if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

    const body = await readBody(req);
    switch (proc) {
      case "createRoom":
        return await handleCreateRoom(body);
      case "joinRoom":
        return handleJoinRoom(body);
      case "getRoom":
        return handleGetRoom(body.code);
      case "reportRound":
        return handleReportRound(body);
      case "finishGame":
        return handleFinishGame(body);
      default:
        return tRpcError(`unknown procedure: ${proc}`);
    }
  } catch (err) {
    console.error("[multi]", err);
    return tRpcError(err?.message ?? "server error");
  }
}

export default handler;
