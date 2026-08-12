/**
 * Vercel serverless API — Panic Word multiplayer backend.
 * Pure JavaScript module (ESM): no dependencies, no TypeScript, no imports.
 * Vercel executes this file natively (no transpilation).
 *
 * Serves:
 *   POST /api/trpc/multi.createRoom
 *   POST /api/trpc/multi.joinRoom
 *   GET/POST /api/trpc/multi.getRoom
 *   POST /api/trpc/multi.reportRound
 *   POST /api/trpc/multi.finishGame
 *
 * Responses use the superjson envelope expected by the tRPC react-query
 * client: { "result": { "data": { "json": <payload> } } }
 */

// ---------------------------------------------------------------------------
// In-memory rooms (volatile; a room is garbage-collected after 30 min idle)
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
  if (ms === undefined || typeof ms !== "number" || !Number.isFinite(ms)) return 3000;
  return Math.min(10000, Math.max(2000, Math.round(ms)));
}

function createRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Response helpers (superjson envelope)
// ---------------------------------------------------------------------------
function okJson(data) {
  return jsonResponse({ result: { data: { json: data } } });
}

function jsonResponse(obj, status) {
  var body = JSON.stringify(obj);
  return new Response(body, {
    status: status || 200,
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
        json: {
          message: message,
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        },
      },
    },
    500,
  );
}

// ---------------------------------------------------------------------------
// Request parsing (tRPC httpBatchLink sends { json: {...} } in body or input)
// ---------------------------------------------------------------------------
async function readBody(req) {
  try {
    var text = await req.text();
    if (!text) return {};
    var parsed = JSON.parse(text);
    return parsed.json !== undefined ? parsed.json : parsed;
  } catch (e) {
    return {};
  }
}

function parseGetInput(urlString) {
  try {
    var u = new URL(urlString, "https://u");
    var input = u.searchParams.get("input");
    if (!input) return {};
    var parsed = JSON.parse(decodeURIComponent(input));
    return parsed.json !== undefined ? parsed.json : parsed;
  } catch (e) {
    return {};
  }
}

function upperCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleCreateRoom(body) {
  gcRooms();
  var playerId = body.playerId;
  var name = body.name;
  if (!playerId || !name) return tRpcError("playerId and name required");

  var code = createRoomCode();
  while (rooms.has(code)) {
    code = createRoomCode();
  }

  var room = {
    code: code,
    hostId: playerId,
    startedAt: Date.now(),
    inputMode: body.inputMode === "voice" ? "voice" : "keyboard",
    roundDurationMs: clampDuration(body.roundDurationMs),
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
  return okJson({ code: code, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs });
}

function handleJoinRoom(body) {
  var room = rooms.get(upperCode(body.code));
  if (!room) return okJson({ ok: false, error: "not_found" });

  var id = "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  room.players.set(id, {
    id: id,
    name: String(body.name || "Joueur").slice(0, 24),
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
  var room = rooms.get(upperCode(code));
  if (!room) return okJson({ players: [], started: false });
  var players = Array.from(room.players.values())
    .map(function (p) {
      return {
        id: p.id,
        name: p.name,
        score: p.score,
        wordsFound: p.wordsFound,
        currentRound: p.currentRound,
        finished: p.finished,
      };
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });
  return okJson({ players: players, started: true, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs });
}

function handleReportRound(body) {
  var room = rooms.get(upperCode(body.code));
  var player = room && room.players.get(body.playerId);
  if (!room || !player) return okJson({ ok: false });
  player.score += Number(body.roundScore || 0);
  if (body.found) player.wordsFound += 1;
  player.currentRound = Number(body.round || 0);
  player.lastPing = Date.now();
  return okJson({ ok: true, score: player.score });
}

function handleFinishGame(body) {
  var room = rooms.get(upperCode(body.code));
  var player = room && room.players.get(body.playerId);
  if (!room || !player) return okJson({ ok: false });
  player.finished = true;
  player.lastPing = Date.now();
  return okJson({ ok: true });
}

// ---------------------------------------------------------------------------
// Vercel serverless handler — called by Vercel with (request, context)
// ---------------------------------------------------------------------------
export default async function handler(req) {
  var url;
  try {
    url = new URL(req.url, "https://u");
  } catch (e) {
    return jsonResponse({ error: "bad url" }, 400);
  }

  if (url.pathname === "/api/health") {
    return jsonResponse({ ok: true, service: "panic-word-multi" });
  }

  var match = url.pathname.match(/^\/api\/trpc\/multi\.([A-Za-z]+)$/);
  if (!match) {
    return jsonResponse({ error: "unknown path: " + url.pathname }, 404);
  }
  var proc = match[1];

  try {
    if (req.method === "GET") {
      if (proc !== "getRoom") return tRpcError("GET not supported for " + proc);
      return handleGetRoom(parseGetInput(url.toString()).code);
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "method not allowed" }, 405);
    }

    var body = await readBody(req);
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
        return tRpcError("unknown procedure: " + proc);
    }
  } catch (err) {
    console.error("[multi]", err);
    return tRpcError(err && err.message ? err.message : "server error");
  }
}
