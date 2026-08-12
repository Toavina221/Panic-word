import type { Difficulty, LangCode, WordEntry } from "@shared/game";
import { difficultyOf } from "@shared/game";

interface WordBankCache {
  [lang: string]: WordEntry[];
}

const cache: WordBankCache = {};

/** Charge la banque de mots JSON pour la langue donnée (fichier local /data). */
export async function loadWordBank(lang: LangCode): Promise<WordEntry[]> {
  if (cache[lang]) return cache[lang];
  const res = await fetch(`/data/${lang}.json`);
  if (!res.ok) throw new Error(`Impossible de charger la banque de mots ${lang}`);
  const data = (await res.json()) as { lang: string; words: WordEntry[] };
  cache[lang] = data.words;
  return data.words;
}

/** Filtre la banque par difficulté (basée sur la longueur du mot). */
export function filterByDifficulty(
  bank: WordEntry[],
  difficulty: Difficulty,
): WordEntry[] {
  return bank.filter((w) => difficultyOf(w.word) === difficulty);
}

/** Comptes par difficulté, utile pour l'UI. */
export function countsByDifficulty(bank: WordEntry[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const w of bank) counts[difficultyOf(w.word)]++;
  return counts;
}
