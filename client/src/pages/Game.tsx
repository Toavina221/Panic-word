import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Mic, MicOff, Send, RotateCcw, Home as HomeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ROUNDS_PER_GAME, type WordEntry } from "@shared/game";
import { useGame } from "@/contexts/GameContext";
import { useGameEngine } from "@/hooks/useGameEngine";
import { loadWordBank, filterByDifficulty } from "@/lib/wordBank";
import { listenVoice, isVoiceSupported, mapLangToSpeechLocale } from "@/lib/voice";
import {
  resumeAudio,
  setSoundIntensity,
  startPressureAmbiance,
  playReveal,
  playWrong,
  disposeAudio,
} from "@/lib/audio";
import { addRecord, bestScore } from "@/lib/storage";
import CodeRain from "@/components/CodeRain";

interface GameProps {
  difficulty: "easy" | "medium" | "hard";
  mode: "solo" | "multi";
  roomSeed?: string;
  overrideInputMode?: "keyboard" | "voice";
  /** Durée de manche imposée par la salle (multijoueur). */
  overrideRoundDurationMs?: number;
  onRoundResult?: (word: string, score: number, found: boolean) => void;
}

/** Composant commun Solo / Multijoueur : le cœur du jeu. */
export default function Game({ difficulty, mode, roomSeed, overrideInputMode, overrideRoundDurationMs, onRoundResult }: GameProps) {
  const { settings, t, prefs } = useGame();

  // Verrouillage du mode de saisie et de la durée au niveau de la salle (équité multijoueur)
  const inputMode = overrideInputMode ?? settings.inputMode;
  const roundDurationMs = overrideRoundDurationMs ?? settings.roundDurationMs;
  const [, navigate] = useLocation();

  const [words, setWords] = useState<WordEntry[]>(() => []);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [shakeKey, setShakeKey] = useState(0);

  const stopListenRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);
  const stopAmbianceRef = useRef<() => void>(() => {});
  const pressureStartedRef = useRef(false);

  // Chargement de la banque de mots
  useEffect(() => {
    let cancelled = false;
    loadWordBank(settings.lang)
      .then((bank) => {
        if (cancelled) return;
        const filtered = filterByDifficulty(bank, difficulty);
        const pool = filtered.length >= ROUNDS_PER_GAME ? filtered : bank;
        setWords(pool);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Impossible de charger les mots");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.lang, difficulty]);

  // Applique l'intensité sonore choisie à tout le moteur audio
  useEffect(() => {
    setSoundIntensity(settings.soundIntensity);
  }, [settings.soundIntensity]);

  const engine = useGameEngine({
    words,
    seed: roomSeed,
    durationMs: roundDurationMs,
    onCorrect: () => {
      stopListenRef.current();
      setListening(false);
      const entry = words[engine.currentIndex];
      onRoundResult?.(entry.word, engine.roundScore, true);
    },
    onMissed: () => {
      stopListenRef.current();
      setListening(false);
      const entry = words[engine.currentIndex];
      onRoundResult?.(entry.word, 0, false);
    },
    onFinished: () => {
      stopListenRef.current();
      setListening(false);
      if (mode === "solo") {
        addRecord({
          lang: settings.lang,
          theme: settings.theme,
          mode,
          totalScore: engine.score,
          bestRoundScore: Math.max(...engine.results.map((r) => r.score), 0),
          wordsFound: engine.results.filter((r) => r.found).length,
          rounds: engine.results.length,
        });
      }
      const scoreKey = bestScore();
      const found = engine.results.filter((r) => r.found).length;
      if (mode === "solo") {
        try {
          localStorage.setItem("panicword.lastSoloDetails", JSON.stringify(engine.results));
        } catch {
          /* quota dépassé → on ignore */
        }
      }
      navigate(`/end?s=${engine.score}&f=${found}&n=${engine.results.length}&b=${scoreKey}&m=${mode}`);
    },
    onPressureStart: () => {
      if (pressureStartedRef.current) return;
      pressureStartedRef.current = true;
      stopAmbianceRef.current = startPressureAmbiance(settings.theme);
    },
  });

  // Verrouille le défilement du body pendant le jeu
  useEffect(() => {
    document.body.classList.add("game-active");
    return () => document.body.classList.remove("game-active");
  }, []);

  // Arrêt brutal du son à la fin du round (victoire/échec)
  useEffect(() => {
    if (engine.roundState === "correct" || engine.roundState === "missed") {
      stopAmbianceRef.current();
      stopAmbianceRef.current = () => {};
      pressureStartedRef.current = false;
      playReveal(settings.theme);
    }
  }, [engine.roundState, settings.theme]);

  useEffect(() => () => disposeAudio(), []);

  // Reconnaissance vocale continue pendant la phase de jeu
  useEffect(() => {
    const voiceLocked = inputMode === "voice";
    if (
      !isVoiceSupported() ||
      !voiceAvailable ||
      engine.roundState !== "playing" ||
      !voiceLocked
    ) {
      setListening(false);
      stopListenRef.current();
      return;
    }
    setListening(true);
    stopListenRef.current = listenVoice(
      settings.lang,
      (r) => {
        engine.submitQuiet(r.transcript);
      },
      (err) => {
        if (err === "not-allowed") setVoiceAvailable(false);
        if (err === "unsupported") setVoiceAvailable(false);
      },
    );
    return () => {
      stopListenRef.current();
      setListening(false);
    };
  }, [
    engine.roundState,
    settings.lang,
    inputMode,
    voiceAvailable,
    engine.submit,
  ]);

  // Focus clavier automatique
  useEffect(() => {
    if (engine.roundState === "playing" && inputMode === "keyboard") {
      inputRef.current?.focus();
    }
  }, [engine.roundState, engine.currentIndex, inputMode]);

  /* ------------------------- Actions ------------------------- */
  const onSubmit = () => {
    resumeAudio();
    if (engine.submit(answer)) {
      setAnswer("");
    } else {
      // Mauvaise réponse : buzzer sec + secousse du champ, le chrono continue
      playWrong();
      setShakeKey((k) => k + 1);
      toast.error(t("game.wrong"), { duration: 900 });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSubmit();
  };

  /* Auto-validation clavier : dès que la saisie forme le mot cible (sans buzzer — réservé à la soumission explicite) */
  useEffect(() => {
    if (inputMode !== "keyboard") return;
    if (answer.length > 0 && engine.submitQuiet(answer)) {
      setAnswer("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, inputMode]);

  const toggleMic = () => {
    resumeAudio();
    if (listening) {
      stopListenRef.current();
      setListening(false);
    } else if (isVoiceSupported()) {
      toast.info(t("game.listening"));
    } else {
      toast.error(t("voiceNotSupported"));
    }
  };

  /* ------------------------- Rendu ------------------------- */
  const progress = Math.min(1, engine.elapsedMs / engine.duration);
  const chronoColor =
    progress < 0.5 ? "var(--success)" : progress < 0.8 ? "var(--neon)" : "var(--danger)";
  const timeLeft = Math.max(0, (engine.duration - engine.elapsedMs) / 1000);

  const themeClasses =
    settings.theme === "horror"
      ? "theme-flash theme-glitch"
      : settings.theme === "cyberpunk"
        ? "cyberpunk-stage"
        : "";

  if (loading || words.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`game-stage relative flex min-h-full flex-col ${themeClasses}`}>
      {settings.theme === "cyberpunk" && <CodeRain />}

      {/* Barre supérieure : manche / score / chrono */}
      <header className="relative z-10 flex items-center justify-between px-5 pb-2 pt-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("game.round")} {engine.currentIndex + 1}/{ROUNDS_PER_GAME}
        </div>
        <div className="chrono-display text-2xl font-bold" style={{ color: chronoColor }}>
          {timeLeft.toFixed(1)}s
        </div>
        <div className="font-mono-display text-sm font-bold">
          {t("game.score")} {engine.score}
        </div>
      </header>

      {/* Barre de temps */}
      <div className="relative z-10 h-1.5 w-full bg-muted/40">
        <div
          className="time-bar h-full"
          style={{
            width: `${(1 - progress) * 100}%`,
            backgroundColor: chronoColor,
            boxShadow: `0 0 8px ${chronoColor}`,
          }}
        />
      </div>

      {/* Scène de jeu */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        {engine.roundState === "start" && (
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-lg text-muted-foreground">{t("game.ready")}</p>
            <Button
              size="lg"
              className="btn-press h-16 px-12 text-xl font-bold tracking-widest"
              onClick={() => {
                resumeAudio();
                engine.start();
              }}
            >
              {t("game.start")}
            </Button>
            <p className="max-w-xs text-sm text-muted-foreground">
              {Math.round(engine.duration / 1000)} s {t("game.perRound").toLowerCase()}
            </p>
          </div>
        )}

        {engine.roundState === "reveal" && (
          <div className="flex flex-wrap justify-center">
            {engine.scrambled.map((letter, i) => (
              <span
                key={`${engine.currentIndex}-${i}`}
                className="letter-bubble bubble-enter"
                style={{
                  animationDelay: `${i * 70}ms`,
                  ["--rot" as string]: `${(i % 2 ? 1 : -1) * (3 + (i % 3) * 2)}deg`,
                }}
              >
                {letter}
              </span>
            ))}
          </div>
        )}

          {(engine.roundState === "reveal" || engine.roundState === "playing") && (
          <div className={engine.pressureActive ? "letters-shaking" : ""}>
            <div className="mt-6 flex flex-wrap justify-center">
              {engine.scrambled.map((letter, i) => (
                <span key={`${engine.currentIndex}-${i}`} className="letter-bubble">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        )}

        {engine.roundState === "playing" && (
          <div className="mt-8 flex w-full max-w-xs items-center gap-2">
            {inputMode !== "voice" && (
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value.toUpperCase())}
                onKeyDown={onKeyDown}
                placeholder={t("game.input.ph")}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={`h-12 w-full rounded-lg border bg-card px-4 font-display text-lg font-bold tracking-widest text-center placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring ${
                  shakeKey ? "wrong-shake" : ""
                }`}
              />
            )}
            {inputMode === "voice" && (
              <div className="flex w-full flex-col items-center gap-2">
                <button
                  onClick={toggleMic}
                  className={`btn-press flex h-20 w-20 items-center justify-center rounded-full border-2 ${
                    listening
                      ? "mic-pulse border-neon bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                  aria-label="Micro"
                >
                  {listening ? (
                    <Mic className="h-9 w-9" />
                  ) : (
                    <MicOff className="h-9 w-9" />
                  )}
                </button>
                <span className="text-xs text-muted-foreground">
                  {listening ? t("game.listening") : t("home.voice")}
                </span>
              </div>
            )}
            {inputMode !== "voice" && (
              <button
                onClick={onSubmit}
                disabled={answer.length === 0}
                className="btn-press flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
                aria-label={t("game.validate")}
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Révélation du mot : correct */}
        {engine.roundState === "correct" && (
          <div className="correct-pop flex flex-col items-center gap-3 text-center">
            <div className="font-display text-3xl font-bold text-success">
              {t("game.correct")}
            </div>
            <div className="font-mono-display text-5xl font-bold" style={{ color: chronoColor }}>
              +{engine.roundScore}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{engine.target}</div>
            <Button className="btn-press mt-3 font-semibold" onClick={engine.next}>
              {t("end.playAgain").replace("Rejouer", "Suivant →")}
            </Button>
          </div>
        )}

        {/* Révélation du mot : temps écoulé */}
        {engine.roundState === "missed" && (
          <div className="wrong-shake flex flex-col items-center gap-3 text-center">
            <div className="font-display text-2xl font-bold text-destructive">
              {t("game.missed")}
            </div>
            <div className="font-display text-4xl font-bold tracking-widest">
              {engine.target}
            </div>
            <div className="font-mono-display text-sm text-muted-foreground">
              +0 {t("end.points").toLowerCase()}
            </div>
            <Button
              variant="outline"
              className="btn-press mt-3 border-border font-semibold"
              onClick={engine.next}
            >
              Suivant →
            </Button>
          </div>
        )}
      </main>

      {/* Footer : navigation d'urgence */}
      <footer className="relative z-10 flex items-center justify-between px-5 pb-6 pt-2 text-xs text-muted-foreground">
        <button
          onClick={() => {
            engine.stop();
            navigate("/");
          }}
          className="btn-press flex items-center gap-1.5 hover:text-foreground"
        >
          <HomeIcon className="h-3.5 w-3.5" />
          {t("end.home")}
        </button>
        <span className="font-mono-display">
          {mode === "multi" ? "MULTI" : "SOLO"} · {prefs.lang.toUpperCase()}
        </span>
        <button
          onClick={() => {
            engine.stop();
            engine.start();
          }}
          className="btn-press flex items-center gap-1.5 hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </button>
      </footer>
    </div>
  );
}

export { mapLangToSpeechLocale };
