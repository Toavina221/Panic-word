import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Home as HomeIcon, RotateCcw, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGame } from "@/contexts/GameContext";
import { addRecord, bestScore } from "@/lib/storage";

/**
 * Écran de fin de partie : reçoit le résultat en paramètres d'URL
 * (?s=score&f=motsTrouvés&n=manches&b=meilleurAvant&m=solo|multi),
 * affiche le tableau, signale le record, et propose Rejouer / Partager.
 */
export default function GameEnd() {
  const { settings, t } = useGame();
  const [, navigate] = useLocation();
  const search = useSearch();

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const mode = (params.get("m") === "multi" ? "multi" : "solo") as "solo" | "multi";
  const total = Number(params.get("s") ?? 0);
  const foundCount = Number(params.get("f") ?? 0);
  const rounds = Number(params.get("n") ?? 10);
  const previousBest = Number(params.get("b") ?? 0);
  const isNewRecord = previousBest > 0 && total > previousBest;

  // Dernière partie jouée en solo : détail des manches pour le tableau
  const [lastDetail] = useState(() => {
    try {
      const raw = localStorage.getItem("panicword.lastSoloDetails");
      return raw ? (JSON.parse(raw) as { word: string; score: number; found: boolean }[]) : null;
    } catch {
      return null;
    }
  });
  const perRound = mode === "solo" && lastDetail ? lastDetail : null;

  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `PANIC WORD 🎯 ${total} pts · ${foundCount}/${rounds} mots trouvés · ${settings.lang.toUpperCase()} · Thème ${settings.theme} 🔥`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "PANIC WORD", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(t("end.copied"));
      }
    } catch {
      /* annulé */
    }
  };

  const playAgain = () => {
    // Rejouer : en solo, on enregistre le score puis on relance
    if (mode === "solo") {
      addRecord({
        lang: settings.lang,
        theme: settings.theme,
        mode,
        totalScore: total,
        bestRoundScore: 0,
        wordsFound: foundCount,
        rounds,
      });
    }
    navigate("/");
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-12">
      <div className="animate-scale-in mx-auto w-full max-w-md text-center">
        <Trophy
          className={`mx-auto h-14 w-14 ${isNewRecord ? "text-primary" : "text-muted-foreground/60"}`}
        />
        <h1 className="font-display mt-3 text-3xl font-bold">{t("end.title")}</h1>

        {isNewRecord && (
          <div className="animate-scale-in mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
            🏆 {t("end.newRecord")}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("end.total")}
          </div>
          <div className="font-mono-display mt-1 text-6xl font-bold text-primary">
            {total}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <strong className="font-mono-display text-foreground">{foundCount}</strong>{" "}
            {t("end.wordsFound").toLowerCase()} / {rounds}
            {previousBest > 0 && (
              <>
                {" · "}
                {t("end.best")}{" "}
                <span className="font-mono-display">{previousBest}</span>
              </>
            )}
          </div>
        </div>

        {/* Tableau des scores par manche */}
        {perRound && (
          <div className="animate-fade-up mt-5 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2 text-left">{t("end.round")}</th>
                  <th className="px-4 py-2 text-left">{t("end.word")}</th>
                  <th className="px-4 py-2 text-right">{t("end.points")}</th>
                </tr>
              </thead>
              <tbody>
                {perRound.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-1.5 font-mono-display text-xs">{i + 1}</td>
                    <td className="px-4 py-1.5 font-display font-semibold">{r.word}</td>
                    <td className={`px-4 py-1.5 text-right font-mono-display font-bold ${r.found ? "text-success" : "text-muted-foreground/50"}`}>
                      {r.found ? r.score : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bandeau de progression par manche */}
        <div className="mt-4 grid grid-cols-10 gap-1">
          {Array.from({ length: rounds }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full ${i < foundCount ? "bg-primary" : "bg-muted/60"}`}
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button size="lg" className="btn-press font-bold" onClick={playAgain}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("end.playAgain")}
          </Button>
          <Button variant="outline" className="btn-press" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" />
            {copied ? t("end.copied") : t("end.share")}
          </Button>
          <Button
            variant="ghost"
            className="btn-press text-muted-foreground"
            onClick={() => navigate("/")}
          >
            <HomeIcon className="mr-2 h-4 w-4" />
            {t("end.home")}
          </Button>
        </div>
      </div>
    </div>
  );
}
