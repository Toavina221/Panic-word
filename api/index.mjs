// Vercel Node serverless function — Panic Word multiplayer backend.
// Signature Node : handler(req, res) — req = IncomingMessage, res = ServerResponse.
// No imports, no dependencies, works on any Node version Vercel provides.

var rooms = new Map();
var ROOM_TTL_MS = 30 * 60 * 1000;

function gcRooms() {
  var now = Date.now();
  rooms.forEach(function (room, code) {
    var active = false;
    room.players.forEach(function (p) {
      if (now - p.lastPing < ROOM_TTL_MS) active = true;
    });
    if (room.players.size === 0 || !active) rooms.delete(code);
  });
}

function clampDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return 3000;
  return Math.min(10000, Math.max(2000, Math.round(ms)));
}

function createRoomCode() {
  var letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  var code = "";
  for (var i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

function sendJson(res, status, obj) {
  var body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(body);
}

function tRpcOk(res, data) {
  sendJson(res, 200, { result: { data: { json: data } } });
}

function tRpcError(res, message) {
  sendJson(
    res,
    500,
    {
      error: {
        json: {
          message: message,
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        },
      },
    },
  );
}

function readBody(req) {
  return new Promise(function (resolve) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
      if (chunks.length > 64) {
        resolve({});
        req.destroy();
      }
    });
    req.on("end", function () {
      try {
        var text = Buffer.concat(chunks).toString("utf8");
        if (!text) return resolve({});
        var parsed = JSON.parse(text);
        resolve(parsed.json !== undefined ? parsed.json : parsed);
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", function () {
      resolve({});
    });
    // Safety net: resolve empty if body never arrives
    setTimeout(function () {
      resolve({});
    }, 8000);
  });
}

function parseQueryInput(urlString) {
  try {
    var m = /[?&]input=([^&]*)/.exec(urlString);
    if (!m) return {};
    var parsed = JSON.parse(decodeURIComponent(m[1]));
    return parsed.json !== undefined ? parsed.json : parsed;
  } catch (e) {
    return {};
  }
}

function upperCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

function handleCreateRoom(res, body) {
  gcRooms();
  var playerId = body.playerId;
  var name = body.name;
  if (!playerId || !name) return tRpcError(res, "playerId and name required");

  var code = createRoomCode();
  while (rooms.has(code)) code = createRoomCode();

  var inputMode = body.inputMode === "voice" ? "voice" : "keyboard";
  var roundDurationMs = clampDuration(body.roundDurationMs);
  rooms.set(code, {
    code: code,
    hostId: playerId,
    startedAt: Date.now(),
    inputMode: inputMode,
    roundDurationMs: roundDurationMs,
    players: new Map([
      [
        playerId,
        {
          id: playerId,
          name: String(name).slice(0, 24),
          score: 0,
          wordsFound: 0,
          currentRound: 0,
          lastPing: Date.now(),
          finished: false,
        },
      ],
    ]),
  });
  tRpcOk(res, { code: code, inputMode: inputMode, roundDurationMs: roundDurationMs });
}

function handleJoinRoom(res, body) {
  var room = rooms.get(upperCode(body.code));
  if (!room) return tRpcOk(res, { ok: false, error: "not_found" });

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
  tRpcOk(res, {
    ok: true,
    playerId: id,
    code: room.code,
    inputMode: room.inputMode,
    roundDurationMs: room.roundDurationMs,
  });
}

function handleGetRoom(res, code) {
  var room = rooms.get(upperCode(code));
  if (!room) return tRpcOk(res, { players: [], started: false });
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
  tRpcOk(res, { players: players, started: true, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs });
}

function handleReportRound(res, body) {
  var room = rooms.get(upperCode(body.code));
  var player = room && room.players.get(body.playerId);
  if (!room || !player) return tRpcOk(res, { ok: false });
  player.score += Number(body.roundScore || 0);
  if (body.found) player.wordsFound += 1;
  player.currentRound = Number(body.round || 0);
  player.lastPing = Date.now();
  tRpcOk(res, { ok: true, score: player.score });
}

function handleFinishGame(res, body) {
  var room = rooms.get(upperCode(body.code));
  var player = room && room.players.get(body.playerId);
  if (!room || !player) return tRpcOk(res, { ok: false });
  player.finished = true;
  player.lastPing = Date.now();
  tRpcOk(res, { ok: true });
}

function handler(req, res) {
  var urlStr = req.url || "";
  var pathname = urlStr.split("?")[0];
  var method = (req.method || "GET").toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // Direct endpoints (bypass tRPC envelope) — useful for quick checks
  if (pathname === "/api/health" || pathname === "/api/ping") {
    return sendJson(res, 200, { ok: true, service: "panic-word-multi" });
  }

  var match = /^\/api\/trpc\/multi\.([A-Za-z]+)$/.exec(pathname);
  if (!match) {
    return sendJson(res, 404, { error: "unknown path" });
  }
  var proc = match[1];

  function route(body) {
    try {
      if (method === "GET") {
        if (proc !== "getRoom") return tRpcError(res, "GET not supported for " + proc);
        return handleGetRoom(res, parseQueryInput(urlStr).code);
      }
      if (method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
      switch (proc) {
        case "createRoom":
          return handleCreateRoom(res, body);
        case "joinRoom":
          return handleJoinRoom(res, body);
        case "getRoom":
          return handleGetRoom(res, body.code);
        case "reportRound":
          return handleReportRound(res, body);
        case "finishGame":
          return handleFinishGame(res, body);
        default:
          return tRpcError(res, "unknown procedure: " + proc);
      }
    } catch (err) {
      tRpcError(res, err && err.message ? err.message : "server error");
    }
  }

  if (method === "GET") {
    return route({});
  }
  readBody(req).then(route);
}

export default handler;
