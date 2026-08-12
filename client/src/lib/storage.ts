/**
 * PANIC WORD — stockage local (localStorage).
 * Persiste les préférences utilisateur et l'historique des scores
 * pour un fonctionnement 100 % hors-ligne.
 */

import type { InputMode, LangCode, SoundIntensity, ThemeId } from "@shared/game";

const KEY = "panicword.v1";

export interface PlayerPrefs {
  lang: LangCode;
  theme: ThemeId;
  inputMode: InputMode;
  /** Durée de chaque manche en ms (2000 à 10000). */
  roundDurationMs: number;
  /** Intensité sonore : "soft" | "normal" | "terrifying". */
  soundIntensity: SoundIntensity;
  nickname: string;
  headsetWarningSeen: boolean;
}

export interface GameRecord {
  id: string;
  date: number; // epoch ms
  lang: LangCode;
  theme: ThemeId;
  mode: "solo" | "multi";
  totalScore: number;
  bestRoundScore: number;
  wordsFound: number;
  rounds: number;
}

export interface StoredState {
  prefs: PlayerPrefs;
  records: GameRecord[];
}

const DEFAULT_PREFS: PlayerPrefs = {
  lang: "fr",
  theme: "normal",
  inputMode: "keyboard",
  roundDurationMs: 3000,
  soundIntensity: "normal",
  nickname: "",
  headsetWarningSeen: false,
};

function load(): StoredState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { prefs: { ...DEFAULT_PREFS }, records: [] };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      prefs: { ...DEFAULT_PREFS, ...parsed.prefs },
      records: Array.isArray(parsed.records) ? (parsed.records as GameRecord[]) : [],
    };
  } catch {
    return { prefs: { ...DEFAULT_PREFS }, records: [] };
  }
}

let state: StoredState | null = null;

function getState(): StoredState {
  if (!state) state = load();
  return state;
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getState()));
  } catch {
    /* quota dépassé ou privé → on ignore */
  }
}

export function getPrefs(): PlayerPrefs {
  return getState().prefs;
}

export function updatePrefs(patch: Partial<PlayerPrefs>): PlayerPrefs {
  const s = getState();
  s.prefs = { ...s.prefs, ...patch };
  persist();
  return s.prefs;
}

export function getRecords(): GameRecord[] {
  return getState().records;
}

/** Ajoute un résultat de partie et garde les 50 meilleurs. */
export function addRecord(rec: Omit<GameRecord, "id" | "date">): GameRecord {
  const s = getState();
  const record: GameRecord = {
    ...rec,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: Date.now(),
  };
  s.records = [record, ...s.records]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);
  persist();
  return record;
}

/** Meilleur score solo enregistré. */
export function bestScore(): number {
  const records = getState().records;
  if (records.length === 0) return 0;
  return Math.max(...records.map((r) => r.totalScore));
}

export function clearRecords(): void {
  const s = getState();
  s.records = [];
  persist();
}
