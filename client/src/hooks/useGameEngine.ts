import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_ROUND_DURATION_MS,
  MIN_ROUND_DURATION_MS,
  ROUNDS_PER_GAME,
  checkAnswer,
  pickSeries,
  roundScore as roundScoreFn,
  scrambleWord,
  seedFromString,
  type WordEntry,
} from "@shared/game";
import { playFailure, playVictory, playWrong } from "@/lib/audio";

export type RoundState = "start" | "idle" | "reveal" | "playing" | "correct" | "missed" | "finished";

/** Normalise une durée de round dans la plage autorisée (2-10 s). */
export function normalizeDuration(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_ROUND_DURATION_MS;
  return Math.min(MAX_ROUND_DURATION_MS, Math.max(MIN_ROUND_DURATION_MS, Math.round(ms)));
}

export interface RoundResult {
  word: string;
  score: number;
  found: boolean;
}

export interface GameEngine {
  roundState: RoundState;
  currentIndex: number;
  roundIndex: number;
  elapsedMs: number;
  duration: number;
  pressureActive: boolean;
  score: number;
  roundScore: number;
  results: RoundResult[];
  scrambled: string[];
  target: string;
  submit: (answer: string) => boolean;
  /** Vérification sans son d'erreur (auto-validation, voix). */
  submitQuiet: (answer: string) => boolean;
  next: () => void;
  start: () => void;
  stop: () => void;
  words: WordEntry[];
}

interface EngineOptions {
  words: WordEntry[];
  seed?: string;
  /** Durée de chaque manche en ms (2000 à 10000). */
  durationMs?: number;
  onCorrect?: () => void;
  onMissed?: () => void;
  onFinished?: (results: RoundResult[]) => void;
  onPressureStart?: () => void;
  onPressureEnd?: () => void;
}

const MAX_SCORE = 1000;

/**
 * Moteur de jeu : gère les rounds de 3 s, le chrono haute précision,
 * le calcul de score au prorata du temps restant et l'enchaînement.
 */
export function useGameEngine(opts: EngineOptions): GameEngine {
  const [roundState, setRoundState] = useState<RoundState>("start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const wordsRef = useRef(opts.words);
  const indexRef = useRef(0);
  const stateRef = useRef<RoundState>("start");
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const scoreRef = useRef(0);
  const resultsRef = useRef<RoundResult[]>([]);
  const durationRef = useRef(normalizeDuration(opts.durationMs ?? 0));
  const onCorrectRef = useRef(opts.onCorrect);
  const onMissedRef = useRef(opts.onMissed);
  const onFinishedRef = useRef(opts.onFinished);
  const onPressureStartRef = useRef(opts.onPressureStart);
  const onPressureEndRef = useRef(opts.onPressureEnd);

  onCorrectRef.current = opts.onCorrect;
  onMissedRef.current = opts.onMissed;
  onFinishedRef.current = opts.onFinished;
  onPressureStartRef.current = opts.onPressureStart;
  onPressureEndRef.current = opts.onPressureEnd;

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const duration = durationRef.current;
    const idx = indexRef.current;
    if (idx >= wordsRef.current.length) {
      stopLoop();
      stateRef.current = "finished";
      setRoundState("finished");
      onFinishedRef.current?.(resultsRef.current);
      return;
    }
    // La pression démarre à la moitié du temps restant (plus tard si durée longue)
    const pressureAt = Math.min(duration / 2, 1500);
    const pressure = elapsed >= pressureAt;
    if (pressure) onPressureStartRef.current?.();
    if (elapsed >= duration) {
      stopLoop();
      stateRef.current = "missed";
      setRoundState("missed");
      setElapsedMs(duration);
      setRoundScore(0);
      playFailure();
      resultsRef.current = [
        ...resultsRef.current,
        { word: wordsRef.current[idx].word, score: 0, found: false },
      ];
      onMissedRef.current?.();
      return;
    }
    setElapsedMs(Math.floor(elapsed));
    setRoundScore(roundScoreFn(elapsed, duration));
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const startRound = useCallback(() => {
    const idx = indexRef.current;
    if (idx >= wordsRef.current.length) {
      stateRef.current = "finished";
      setRoundState("finished");
      onFinishedRef.current?.(resultsRef.current);
      return;
    }
    stopLoop();
    const entry = wordsRef.current[idx];
    const seed = opts.seed ? seedFromString(`${opts.seed}:${idx}`) : undefined;
    setRoundIndex(idx);
    setScrambled(scrambleWord(entry.word, seed));
    setCurrentIndex(idx);
    setRoundScore(MAX_SCORE);
    setElapsedMs(0);
    stateRef.current = "reveal";
    setRoundState("reveal");
    // Phase calme 0→1s, puis bascule en "playing" à 1s
    setTimeout(() => {
      if (stateRef.current !== "reveal") return;
      startRef.current = performance.now();
      stateRef.current = "playing";
      setRoundState("playing");
      onPressureStartRef.current = opts.onPressureStart;
      rafRef.current = requestAnimationFrame(tick);
    }, 1000);
  }, [opts.seed, opts.onPressureStart, stopLoop, tick]);

  const submit = useCallback(
    (answer: string): boolean => {
      if (stateRef.current !== "reveal" && stateRef.current !== "playing") return false;
      const entry = wordsRef.current[indexRef.current];
      const ok = checkAnswer(answer, entry.word);
      if (ok) {
        const elapsed =
          stateRef.current === "reveal" ? 0 : performance.now() - startRef.current;
        const pts = roundScoreFn(elapsed, durationRef.current);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setRoundScore(pts);
        resultsRef.current = [
          ...resultsRef.current,
          { word: entry.word, score: pts, found: true },
        ];
        stateRef.current = "correct";
        setRoundState("correct");
        setElapsedMs(Math.floor(Math.max(0, elapsed)));
        stopLoop();
        playVictory();
        onCorrectRef.current?.();
        return true;
      }
      // Mauvaise réponse : simple buzzer sec, le chrono continue jusqu'à épuisement
      playWrong();
      return false;
    },
    [],
  );

  /** Vérifie sans son d'erreur (auto-validation pendant la frappe, voix). */
  const submitQuiet = useCallback((answer: string): boolean => {
    if (stateRef.current !== "reveal" && stateRef.current !== "playing") return false;
    const entry = wordsRef.current[indexRef.current];
    const ok = checkAnswer(answer, entry.word);
    if (ok) {
      const elapsed =
        stateRef.current === "reveal" ? 0 : performance.now() - startRef.current;
      const pts = roundScoreFn(elapsed, durationRef.current);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setRoundScore(pts);
      resultsRef.current = [
        ...resultsRef.current,
        { word: entry.word, score: pts, found: true },
      ];
      stateRef.current = "correct";
      setRoundState("correct");
      setElapsedMs(Math.floor(Math.max(0, elapsed)));
      stopLoop();
      playVictory();
      onCorrectRef.current?.();
      return true;
    }
    return false;
  }, []);

  const next = useCallback(() => {
    indexRef.current += 1;
    if (indexRef.current >= wordsRef.current.length) {
      stateRef.current = "finished";
      setRoundState("finished");
      onFinishedRef.current?.(resultsRef.current);
      return;
    }
    startRound();
  }, [startRound]);

  const stop = useCallback(() => {
    stopLoop();
    stateRef.current = "finished";
    setRoundState("finished");
  }, [stopLoop]);

  const start = useCallback(() => {
    indexRef.current = 0;
    scoreRef.current = 0;
    resultsRef.current = [];
    setScore(0);
    setResults([]);
    startRound();
  }, [startRound]);

  // Met à jour la durée et la liste de mots quand les options changent
  useEffect(() => {
    wordsRef.current = opts.words;
  }, [opts.words]);
  useEffect(() => {
    durationRef.current = normalizeDuration(opts.durationMs ?? 0);
  }, [opts.durationMs]);

  const pressureActive =
    roundState === "playing" && elapsedMs >= Math.min(durationRef.current / 2, 1500);

  const target =
    wordsRef.current.length > 0 && currentIndex < wordsRef.current.length
      ? wordsRef.current[currentIndex].word
      : "";

  return {
    roundState,
    currentIndex,
    roundIndex,
    elapsedMs,
    duration: durationRef.current,
    pressureActive,
    score,
    roundScore,
    results,
    scrambled,
    target,
    submit,
    submitQuiet,
    next,
    start,
    stop,
    words: opts.words,
  };
}

export { ROUNDS_PER_GAME };
