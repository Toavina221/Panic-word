/**
 * Vercel entry point — serverless Express app.
 *
 * Serves:
 * - /api/trpc/multi.*  → tRPC multiplayer backend (rooms created in memory)
 * - static client build (`dist/public`, produced by `pnpm build`) + SPA fallback
 *
 * Vercel automatically bundles the whole `api/` folder as functions.
 * This file must default-export the Express app (no app.listen).
 */
import express from "express";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { multiRouter } from "../server/routers/multi";

// ---------------------------------------------------------------------------
// Minimal tRPC context (no OAuth — multiplayer rooms are anonymous)
// ---------------------------------------------------------------------------
interface VercelCtx {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: null;
}

const t = initTRPC.context<VercelCtx>().create({ transformer: superjson });

function createContext({ req, res }: CreateExpressContextOptions): VercelCtx {
  return { req, res, user: null };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// tRPC backend — the client (batchLink, url: "/api/trpc") calls paths like
// /api/trpc/multi.createRoom, so we wrap multiRouter under a "multi" prefix.
const vercelRouter = t.router({
  multi: multiRouter,
});

type VercelRouter = typeof vercelRouter;

app.use(
  "/api/trpc",
  createExpressMiddleware<VercelRouter>({
    router: vercelRouter,
    createContext,
  }),
);

// ---------------------------------------------------------------------------
// Static client: Vercel Functions land in the project root at runtime,
// so `dist/public` (built by `pnpm build`) is right next to us.
// ---------------------------------------------------------------------------
const staticDir = path.join(process.cwd(), "dist", "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { maxAge: "1h" }));
  // SPA fallback — every non-API, non-file route serves index.html
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).send(`Not found: ${req.path}`);
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
