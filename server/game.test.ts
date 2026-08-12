import { describe, expect, it } from "vitest";
import {
  checkAnswer,
  difficultyOf,
  generateRoomCode,
  normalize,
  pickSeries,
  roundScore,
  scrambleWord,
  seedFromString,
  shuffle,
  totalScore,
  MAX_SCORE_PER_ROUND,
  ROUND_DURATION_MS,
  MIN_ROUND_DURATION_MS,
  MAX_ROUND_DURATION_MS,
  ROUND_DURATION_OPTIONS,
  SOUND_INTENSITIES,
} from "../shared/game";

describe("normalize", () => {
  it("retire les accents et met en minuscules", () => {
    expect(normalize("ÉLÈVE")).toBe("eleve");
    expect(normalize("àçé")).toBe("ace");
  });
  it("supprime les caractères non alphabétiques", () => {
    expect(normalize("mot! 123")).toBe("mot");
    expect(normalize("  PANIC ")).toBe("panic");
  });
});

describe("shuffle / scrambleWord", () => {
  it("shuffle mélange le tableau", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const mixed = shuffle(arr, 42);
    expect(mixed.length).toBe(arr.length);
    expect(mixed).not.toEqual(arr);
  });
  it("shuffle est déterministe avec la même graine", () => {
    const a = shuffle([1, 2, 3, 4, 5], 7);
    const b = shuffle([1, 2, 3, 4, 5], 7);
    expect(a).toEqual(b);
  });
  it("shuffle avec graines différentes produit des résultats différents (quasi-sûr)", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], 7);
    const b = shuffle([1, 2, 3, 4, 5, 6], 99);
    expect(a).not.toEqual(b);
  });
  it("scrambleWord ne renvoie jamais le mot original (pour LUNE)", () => {
    for (let s = 0; s < 30; s++) {
      expect(scrambleWord("LUNE", s).join("")).not.toBe("LUNE");
    }
  });
  it("scrambleWord conserve toutes les lettres", () => {
    const scrambled = scrambleWord("VAMPIRE", 11);
    expect(scrambled.sort().join("")).toBe("VAMPIRE".split("").sort().join(""));
  });
});

describe("seedFromString", () => {
  it("produit toujours le même hash pour la même chaîne", () => {
    expect(seedFromString("K7QZ:3")).toBe(seedFromString("K7QZ:3"));
  });
  it("différencie deux chaînes", () => {
    expect(seedFromString("K7QZ:3")).not.toBe(seedFromString("K7QZ:4"));
  });
});

describe("difficultyOf", () => {
  it("classe par longueur", () => {
    expect(difficultyOf("LUNE")).toBe("easy");
    expect(difficultyOf("OMBRE")).toBe("medium");
    expect(difficultyOf("VAMPIRE")).toBe("hard");
    expect(difficultyOf("VOILURE")).toBe("hard");
  });
});

describe("roundScore / totalScore", () => {
  it("donne 1000 points immédiatement", () => {
    expect(roundScore(0)).toBe(MAX_SCORE_PER_ROUND);
  });
  it("donne 0 après 3 secondes", () => {
    expect(roundScore(ROUND_DURATION_MS)).toBe(0);
    expect(roundScore(ROUND_DURATION_MS + 500)).toBe(0);
  });
  it("décroît linéairement avec le temps", () => {
    const half = roundScore(ROUND_DURATION_MS / 2);
    expect(half).toBe(500);
  });
  it("cumule les scores", () => {
    expect(totalScore([{ score: 100 }, { score: 200 }, { score: 0 }])).toBe(300);
  });
});

describe("checkAnswer", () => {
  it("valide une réponse correcte malgré la casse et les accents", () => {
    expect(checkAnswer("lune", "LUNE")).toBe(true);
    expect(checkAnswer("Étoile", "ETOILE")).toBe(true);
  });
  it("rejette une mauvaise réponse", () => {
    expect(checkAnswer("chat", "LUNE")).toBe(false);
  });
});

describe("pickSeries", () => {
  const bank = [
    { word: "A", theme: "t" },
    { word: "B", theme: "t" },
    { word: "C", theme: "t" },
    { word: "D", theme: "t" },
    { word: "E", theme: "t" },
    { word: "F", theme: "t" },
    { word: "G", theme: "t" },
    { word: "H", theme: "t" },
    { word: "I", theme: "t" },
    { word: "J", theme: "t" },
  ];
  it("sélectionne `count` mots déterministes avec une graine", () => {
    const a = pickSeries(bank, 5, "ROOM1");
    const b = pickSeries(bank, 5, "ROOM1");
    expect(a.map((w) => w.word)).toEqual(b.map((w) => w.word));
    expect(a.length).toBe(5);
  });
  it("deux salles différentes reçoivent des séries différentes", () => {
    const a = pickSeries(bank, 5, "ROOM1");
    const b = pickSeries(bank, 5, "ROOM2");
    expect(a.map((w) => w.word)).not.toEqual(b.map((w) => w.word));
  });
});

describe("generateRoomCode", () => {
  it("génère un code de 4 lettres majuscules sans I/O", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
    expect(/^[A-HJ-NP-Z]{4}$/.test(code)).toBe(true);
  });
});

describe("durée configurable", () => {
  it("roundScore avec une durée custom de 5s donne 1000 à t=0 et 0 à t=5s", () => {
    expect(roundScore(0, 5000)).toBe(MAX_SCORE_PER_ROUND);
    expect(roundScore(5000, 5000)).toBe(0);
  });
  it("roundScore avec 10s : 5s donne 500", () => {
    expect(roundScore(5000, 10000)).toBe(500);
  });
  it("les constantes de plage encadrent bien la durée par défaut", () => {
    expect(ROUND_DURATION_MS).toBeGreaterThanOrEqual(MIN_ROUND_DURATION_MS);
    expect(ROUND_DURATION_MS).toBeLessThanOrEqual(MAX_ROUND_DURATION_MS);
    expect(ROUND_DURATION_MS).toBe(3000);
  });
  it("toutes les options de durée sont dans la plage autorisée", () => {
    for (const ms of ROUND_DURATION_OPTIONS) {
      expect(ms).toBeGreaterThanOrEqual(MIN_ROUND_DURATION_MS);
      expect(ms).toBeLessThanOrEqual(MAX_ROUND_DURATION_MS);
    }
    expect(ROUND_DURATION_OPTIONS).toContain(3000);
    expect(ROUND_DURATION_OPTIONS).toContain(10000);
  });
});

describe("intensité sonore", () => {
  it("les trois intensités existent et ont des labels par langue", () => {
    const ids = SOUND_INTENSITIES.map((s) => s.id);
    expect(ids).toEqual(["soft", "normal", "terrifying"]);
    for (const s of SOUND_INTENSITIES) {
      expect(s.label.fr).toBeTruthy();
      expect(s.label.en).toBeTruthy();
      expect(s.label.es).toBeTruthy();
    }
  });
});
