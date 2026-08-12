import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGame } from "@/contexts/GameContext";
import { trpc } from "@/lib/trpc";
import Game from "./Game";
import { nanoid } from "nanoid";
import type { Difficulty } from "@shared/game";
import { DIFFICULTY_LABELS, generateRoomCode } from "@shared/game";

type MultiStep = "setup" | "lobby" | "playing";

interface PlayerRow {
  id: string;
  name: string;
  score: number;
  wordsFound: number;
  currentRound: number;
  finished: boolean;
}

/**
 * Écran Multijoueur : création ou rejoindre une salle, puis cœur de jeu
 * synchronisé (même code = même série de mots).
 */
export default function Multi() {
  const { settings, t } = useGame();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<MultiStep>("setup");
  const [code, setCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [started, setStarted] = useState(false);
  /** Durée de manche imposée par la salle (sélectionnée par l'hôte, imposée à tous). */
  const [roomRoundDurationMs, setRoomRoundDurationMs] = useState<number>(3000);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const utils = trpc.useUtils();
  const createRoom = trpc.multi.createRoom.useMutation();
  const joinRoom = trpc.multi.joinRoom.useMutation();
  const reportRound = trpc.multi.reportRound.useMutation();
  const finishGame = trpc.multi.finishGame.useMutation();
  const { data: roomData } = trpc.multi.getRoom.useQuery(
    { code: code.toUpperCase() },
    { enabled: step === "lobby" || step === "playing", refetchInterval: 1200 },
  );

  // Polling du classement + durée imposée par la salle
  useEffect(() => {
    if (roomData) {
      setPlayers(roomData.players as PlayerRow[]);
      if (typeof roomData.roundDurationMs === "number") {
        setRoomRoundDurationMs(roomData.roundDurationMs);
      }
    }
  }, [roomData]);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => stopPoll(), []);

  /* ------------------------- Création / Rejoindre ------------------------- */
  const create = async () => {
    const name = nickname.trim() || "Joueur";
    const myId = nanoid(12);
    try {
      const res = await createRoom.mutateAsync({ playerId: myId, name, inputMode: settings.inputMode, roundDurationMs: settings.roundDurationMs });
      setPlayerId(myId);
      setCode(res.code);
      setStarted(false);
      setRoomRoundDurationMs(res.roundDurationMs);
      setStep("lobby");
    } catch {
      toast.error(t("room.error"));
    }
  };

  const join = async () => {
    const name = nickname.trim() || "Joueur";
    try {
      const res = await joinRoom.mutateAsync({
        code: code.trim().toUpperCase(),
        name,
      });
      if (!res.ok) {
        toast.error(t("room.error"));
        return;
      }
      setPlayerId(res.playerId);
      setCode(res.code);
      setStarted(false);
      setRoomRoundDurationMs(res.roundDurationMs);
      setStep("lobby");
    } catch {
      toast.error(t("room.error"));
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("end.copied"));
    } catch {
      toast.error("Clipboard indisponible");
    }
  };

  const allReady = players.length >= 2;

  /* ------------------------- Rendu ------------------------- */
  if (step === "playing") {
    return (
      <div className="relative">
        <Game
          difficulty={difficulty}
          mode="multi"
          roomSeed={code}
          overrideInputMode={
          (roomData as { inputMode?: "keyboard" | "voice" } | undefined)?.inputMode
        }
          overrideRoundDurationMs={roomRoundDurationMs}
        onRoundResult={(word, score, found) => {
            reportRound.mutate({
              code,
              playerId,
              roundScore: score,
              found,
              round: (players.find((p) => p.id === playerId)?.currentRound ?? 0) + 1,
            });
          }}
        />
        {/* Leaderboard temps réel (superposé en haut à droite) */}
        <div className="pointer-events-none absolute right-3 top-16 z-20 hidden w-44 md:block">
          <div className="pointer-events-auto rounded-lg border border-border/70 bg-background/85 p-2.5 shadow-md backdrop-blur-sm">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("room.players")} ({players.length})
            </div>
            <ul className="flex flex-col gap-1">
              {players.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    p.id === playerId ? "bg-primary/15 font-bold" : ""
                  }`}
                >
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-mono-display ml-1.5">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (step === "lobby") {
    const me = players.find((p) => p.id === playerId);
    return (
      <div className="flex min-h-full flex-col px-5 pb-8 pt-8">
        <button
          onClick={() => navigate("/")}
          className="btn-press mb-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("end.home")}
        </button>

        <h1 className="font-display text-3xl font-bold">{t("home.multi")}</h1>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("room.yourCode")}
          </div>
          <div className="font-mono-display mt-2 text-4xl font-bold tracking-[0.3em] text-primary">
            {code}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="btn-press mt-3"
            onClick={copyCode}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {t("end.share")}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{t("room.waiting")}</p>
        </div>

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("room.players")} ({players.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {players.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
                  p.id === playerId
                    ? "border-primary/60 bg-accent/50 font-semibold"
                    : "border-border bg-card"
                }`}
              >
                <span>{p.name}</span>
                {p.id === playerId && (
                  <span className="text-[10px] uppercase text-primary">Vous</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`btn-press flex-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
                  difficulty === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {DIFFICULTY_LABELS[d][settings.lang]}
              </button>
            ))}
          </div>
          <Button
            size="lg"
            className="btn-press mt-1 font-bold"
            disabled={!allReady}
            onClick={() => {
              setStarted(true);
              setStep("playing");
            }}
          >
            {t("room.start")}
            {!allReady && (
              <span className="ml-2 text-xs font-normal opacity-70">
                (2+ joueurs)
              </span>
            )}
          </Button>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Saisie imposée :{" "}
            <strong>
              {(roomData as { inputMode?: string } | undefined)?.inputMode === "voice"
                ? t("home.voice")
                : t("home.keyboard")}
            </strong>
            {" "}(définie par l'hôte)
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            Chrono imposé :{" "}
            <strong className="font-mono-display">
              {Math.round(roomRoundDurationMs / 1000)} s
            </strong>
            {" "}(défini par l'hôte)
          </p>
          {!allReady && (
            <p className="text-center text-[11px] text-muted-foreground">
              {t("room.waiting")}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------- Setup ------------------------- */
  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-8">
      <button
        onClick={() => navigate("/")}
        className="btn-press mb-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("end.home")}
      </button>

      <h1 className="font-display text-3xl font-bold">{t("home.multi")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("home.multi.desc")}</p>

      <div className="mt-6">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("room.nickname")}
        </label>
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("room.nickname.ph")}
          maxLength={24}
          className="h-11"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display mb-2 text-base font-bold">{t("room.create")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Un code à 4 lettres sera généré. Partagez-le avec vos amis.
          </p>
          <Button className="btn-press w-full font-semibold" onClick={create}>
            {t("room.create")}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display mb-2 text-base font-bold">{t("room.join")}</h2>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("room.code.ph")}
            maxLength={4}
            className="mb-2 h-11 font-mono-display text-center tracking-[0.3em]"
          />
          <Button variant="outline" className="btn-press w-full font-semibold" onClick={join}>
            {t("room.enter")}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <Users className="mb-1 inline h-3.5 w-3.5" /> Tous les joueurs reçoivent la même
        série de mots. Verrouillage du mode de saisie (voix ou clavier) pour l'équité.
        Données minimales : pseudos + chronos de fin de manche.
      </div>
    </div>
  );
}
