import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/contexts/GameContext";
import Game from "./Game";
import type { Difficulty } from "@shared/game";
import { DIFFICULTY_LABELS } from "@shared/game";

/**
 * Écran Solo : sélection rapide de la difficulté, puis lancement direct
 * du cœur de jeu. La difficulté conditionne la banque de mots utilisée.
 */
export default function Solo() {
  const { settings, t } = useGame();
  const [, navigate] = useLocation();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  if (difficulty === null) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-8">
        <button
          onClick={() => navigate("/")}
          className="btn-press mb-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("end.home")}
        </button>

        <h1 className="font-display text-3xl font-bold">{t("home.solo")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("home.solo.desc")}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d, i) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className="btn-press animate-fade-up flex items-center justify-between rounded-xl border border-border bg-card px-5 py-5 text-left transition-colors hover:border-primary/50"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div>
                <div className="font-display text-lg font-bold">
                  {DIFFICULTY_LABELS[d][settings.lang]}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {d === "easy"
                    ? "4 lettres"
                    : d === "medium"
                      ? "5 lettres"
                      : "6 à 7 lettres"}
                </div>
              </div>
              <span className="font-mono-display text-xs text-muted-foreground">
                {d === "easy" ? "●●○○○" : d === "medium" ? "●●●○○" : "●●●●●"}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Game difficulty={difficulty} mode="solo" />
    </div>
  );
}
