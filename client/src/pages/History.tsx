import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, History as HistoryIcon, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/contexts/GameContext";
import {
  clearRecords,
  getRecords,
  type GameRecord,
} from "@/lib/storage";

/**
 * Écran Historique : consultation des 50 dernières parties enregistrées
 * localement (date, mode, langue, thème, score, mots trouvés).
 */
export default function History() {
  const { settings, t } = useGame();
  const [, navigate] = useLocation();
  const [records, setRecords] = useState<GameRecord[]>(() => getRecords());

  const best = useMemo(
    () => (records.length ? Math.max(...records.map((r) => r.totalScore)) : 0),
    [records],
  );

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-8">
      <button
        onClick={() => navigate("/")}
        className="btn-press mb-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("end.home")}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{t("history.title")}</h1>
        {records.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="btn-press text-destructive"
            onClick={() => {
              clearRecords();
              setRecords([]);
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t("history.clear")}
          </Button>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {t("history.subtitle")}
        {best > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-primary">
            <Trophy className="h-3.5 w-3.5" /> {best}
          </span>
        )}
      </p>

      {records.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <HistoryIcon className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t("history.empty")}</p>
          <Button variant="outline" size="sm" className="btn-press mt-2" onClick={() => navigate("/solo")}>
            {t("home.play")}
          </Button>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="font-mono-display text-lg text-primary">{r.totalScore}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {r.mode === "solo" ? "SOLO" : "MULTI"} · {r.lang.toUpperCase()}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.wordsFound}/{r.rounds} · {r.theme} ·{" "}
                  {new Date(r.date).toLocaleDateString(settings.lang, {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {r.totalScore === best && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  RECORD
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
