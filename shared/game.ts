/**
 * PANIC WORD — logique métier partagée (client & serveur).
 * Normalisation Unicode, scrambling Fisher-Yates, calcul de score,
 * niveaux de difficulté, sélection de séries de mots.
 */

export type LangCode = "fr" | "en" | "es";
export type ThemeId = "normal" | "horror" | "cyberpunk";
export type InputMode = "keyboard" | "voice";
export type SoundIntensity = "soft" | "normal" | "terrifying";

export const ROUND_DURATION_MS = 3000; // valeur par défaut (2000 à 10000 selon préférence)
export const MIN_ROUND_DURATION_MS = 2000;
export const MAX_ROUND_DURATION_MS = 10000;
export const ROUNDS_PER_GAME = 10;
export const MAX_SCORE_PER_ROUND = 1000;

/** Durées de chrono proposées dans le sélecteur (ms). */
export const ROUND_DURATION_OPTIONS: number[] = [2000, 3000, 5000, 7000, 10000];

export const SOUND_INTENSITIES: { id: SoundIntensity; label: Record<string, string> }[] = [
  { id: "soft", label: { fr: "Doux", en: "Soft", es: "Suave" } },
  { id: "normal", label: { fr: "Normal", en: "Normal", es: "Normal" } },
  { id: "terrifying", label: { fr: "Terrifiant", en: "Terrifying", es: "Terrorífico" } },
];

export const LANGUAGES: { code: LangCode; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export const THEMES: { id: ThemeId; label: Record<string, string> }[] = [
  { id: "normal", label: { fr: "Normal", en: "Normal", es: "Normal" } },
  { id: "horror", label: { fr: "Horreur", en: "Horror", es: "Horror" } },
  { id: "cyberpunk", label: { fr: "Cyberpunk", en: "Cyberpunk", es: "Cyberpunk" } },
];

export interface WordEntry {
  word: string;
  theme: string;
}

export interface WordBank {
  lang: LangCode;
  words: WordEntry[];
}

/**
 * Normalise une chaîne : minuscule, accentuations retirées vers la lettre
 * de base (é→e), tout caractère non-alphabétique retiré.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Mélange un tableau selon Fisher-Yates. Si `seed` est fourni, le résultat est
 * déterministe (utile pour synchroniser les séries multijoueurs).
 */
export function shuffle<T>(array: T[], seed?: number): T[] {
  const arr = [...array];
  // mulberry32 PRNG — reproductible à partir d'une graine
  let s = seed === undefined ? Math.random() * 2 ** 31 : seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mélange les lettres d'un mot. Garantie : le mélange n'est jamais le mot
 * lui-même (pour les mots dont toutes les lettres sont distinctes,
 * on resimple). La sortie est déterministe avec la même graine.
 */
export function scrambleWord(word: string, salt: number = 0): string[] {
  const letters = word.split("");
  let attempt = 0;
  while (attempt < 32) {
    const mixed = shuffle(letters, seedFromString(word + salt + attempt));
    if (mixed.join("") !== word) return mixed;
    attempt++;
  }
  return letters;
}

/**
 * Transforme une chaîne en entier 32 bits (hash simple type djb2).
 */
export function seedFromString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export type Difficulty = "easy" | "medium" | "hard";

/** Niveau de difficulté basé sur la longueur du mot. */
export function difficultyOf(word: string): Difficulty {
  const l = word.length;
  if (l <= 4) return "easy";
  if (l <= 5) return "medium";
  return "hard";
}

export const DIFFICULTY_LABELS: Record<Difficulty, Record<LangCode, string>> = {
  easy: { fr: "Facile", en: "Easy", es: "Fácil" },
  medium: { fr: "Moyen", en: "Medium", es: "Medio" },
  hard: { fr: "Difficile", en: "Hard", es: "Difícil" },
};

/**
 * Sélectionne une série de mots pour une partie. Mélange déterministe à
 * partir du code de salle (multijoueur) ou d'une graine aléatoire (solo).
 */
export function pickSeries(
  bank: WordEntry[],
  count: number,
  seed?: string,
): WordEntry[] {
  const s = seed === undefined ? Math.random() * 2 ** 31 : seedFromString(seed);
  const pool = shuffle(bank, s);
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Score d'un round : 1000 points au prorata du temps restant.
 * `elapsedMs` = temps écoulé depuis le début du round, `duration` = durée
 * configurable du round. 0 si le temps est écoulé.
 */
export function roundScore(elapsedMs: number, duration: number = ROUND_DURATION_MS): number {
  if (elapsedMs >= duration) return 0;
  return Math.round((1 - elapsedMs / duration) * MAX_SCORE_PER_ROUND);
}

/** Score total cumulé d'une liste de résultats de round. */
export function totalScore(rounds: { score: number }[]): number {
  return rounds.reduce((sum, r) => sum + r.score, 0);
}

/** Vérifie si la réponse saisie correspond au mot cible. */
export function checkAnswer(answer: string, target: string): boolean {
  return normalize(answer) === normalize(target);
}

/** Génère un code de salle de 4 lettres majuscules. */
export function generateRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I/O pour éviter les confusions
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}
