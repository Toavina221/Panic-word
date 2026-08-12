import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

function clampDuration(ms?: number): number {
  if (ms === undefined || !Number.isFinite(ms)) return 3000;
  return Math.min(10000, Math.max(2000, Math.round(ms)));
}

/**
 * Mode multijoueur "Lite" :
 * - Salles créées en mémoire serveur (volatile, léger).
 * - Seuls pseudo + points par manche transitent (quelques octets).
 * - Synchronisation des séries : même code de salle = même graine
 *   de mélange → les mêmes mots dans le même ordre pour tous.
 */

interface MultiPlayer {
  id: string;
  name: string;
  score: number;
  wordsFound: number;
  currentRound: number;
  lastPing: number;
  finished: boolean;
}

interface MultiRoom {
  code: string;
  hostId: string;
  startedAt: number;
  inputMode: "keyboard" | "voice";
  roundDurationMs: number;
  players: Map<string, MultiPlayer>;
}

const rooms = new Map<string, MultiRoom>();
const ROOM_TTL_MS = 30 * 60 * 1000; // salles nettoyées après 30 min d'inactivité

function gcRooms(): void {
  const now = Date.now();
  rooms.forEach((room, code) => {
    let active = false;
    room.players.forEach((p: MultiPlayer) => {
      if (now - p.lastPing < ROOM_TTL_MS) active = true;
    });
    if (room.players.size === 0 || !active) rooms.delete(code);
  });
}

const roomInput = z.object({ code: z.string().min(4).max(4).toUpperCase() });
const playerInput = z.object({
  code: z.string().min(4).max(4).toUpperCase(),
  playerId: z.string().min(1).max(64),
});

export const multiRouter = router({
  createRoom: publicProcedure
    .input(
      z.object({
        playerId: z.string().min(1).max(64),
        name: z.string().min(1).max(24),
        inputMode: z.enum(["keyboard", "voice"]).optional(),
        roundDurationMs: z.number().int().min(2000).max(10000).optional(),
      }),
    )
    .mutation(({ input }) => {
      gcRooms();
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += letters[Math.floor(Math.random() * letters.length)];
      }
      const room: MultiRoom = {
        code,
        hostId: input.playerId,
        startedAt: Date.now(),
        inputMode: "keyboard",
        roundDurationMs: 3000,
        players: new Map(),
      };
      room.players.set(input.playerId, {
        id: input.playerId,
        name: input.name,
        score: 0,
        wordsFound: 0,
        currentRound: 0,
        lastPing: Date.now(),
        finished: false,
      });
      if (input.inputMode) room.inputMode = input.inputMode;
      room.roundDurationMs = clampDuration(input.roundDurationMs);
      rooms.set(code, room);
      return { code, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs } as const;
    }),

  joinRoom: publicProcedure
    .input(z.object({ code: roomInput.shape.code, name: z.string().min(1).max(24) }))
    .mutation(({ input }) => {
      const room = rooms.get(input.code);
      if (!room) {
        return { ok: false, error: "not_found" } as const;
      }
      const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      room.players.set(id, {
        id,
        name: input.name,
        score: 0,
        wordsFound: 0,
        currentRound: 0,
        lastPing: Date.now(),
        finished: false,
      });
      return { ok: true, playerId: id, code: room.code, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs } as const;
    }),

  /** Polling léger : renvoie pseudo + score par joueur (quelques octets). */
  getRoom: publicProcedure.input(roomInput).query(({ input }) => {
    const room = rooms.get(input.code);
    if (!room) return { players: [] as MultiPlayer[], started: false };
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
    return { players, started: true, inputMode: room.inputMode, roundDurationMs: room.roundDurationMs };
  }),

  /** Met à jour le score du joueur à la fin d'une manche (octets minimaux). */
  reportRound: publicProcedure
    .input(
      z.object({
        ...playerInput.shape,
        roundScore: z.number().min(0).max(1000),
        found: z.boolean(),
        round: z.number().min(0).max(20),
      }),
    )
    .mutation(({ input }) => {
      const room = rooms.get(input.code);
      const player = room?.players.get(input.playerId);
      if (!room || !player) return { ok: false } as const;
      player.score += input.roundScore;
      if (input.found) player.wordsFound += 1;
      player.currentRound = input.round;
      player.lastPing = Date.now();
      return { ok: true, score: player.score } as const;
    }),

  /** Signale la fin de partie d'un joueur. */
  finishGame: publicProcedure
    .input(playerInput)
    .mutation(({ input }) => {
      const room = rooms.get(input.code);
      const player = room?.players.get(input.playerId);
      if (!room || !player) return { ok: false } as const;
      player.finished = true;
      player.lastPing = Date.now();
      return { ok: true } as const;
    }),

  /** Liste les joueurs pour l'écran d'attente. */
  listPlayers: publicProcedure.input(roomInput).query(({ input }) => {
    const room = rooms.get(input.code);
    if (!room) return [] as { id: string; name: string }[];
    return Array.from(room.players.values()).map((p) => ({ id: p.id, name: p.name }));
  }),
});
