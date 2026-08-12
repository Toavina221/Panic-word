import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Headphones, Keyboard, Mic, Trophy, Zap, Users, Skull } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGame } from "@/contexts/GameContext";
import { LANGUAGES, SOUND_INTENSITIES, THEMES } from "@/contexts/GameContext";
import {
  bestScore,
  getPrefs,
  updatePrefs,
} from "@/lib/storage";
import { loadWordBank, countsByDifficulty } from "@/lib/wordBank";
import { DIFFICULTY_LABELS, ROUND_DURATION_OPTIONS } from "@shared/game";
import type { Difficulty, LangCode, SoundIntensity, ThemeId } from "@shared/game";

function HeadsetDialog() {
  const { prefs, t } = useGame();
  const [open, setOpen] = useState(!prefs.headsetWarningSeen);

  const accept = () => {
    updatePrefs({ headsetWarningSeen: true });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm border-destructive/40 bg-card text-center">
        <DialogTitle className="font-display text-xl text-destructive">
          {t("headset.title")}
        </DialogTitle>
        <DialogDescription className="text-base leading-relaxed">
          🎧 {t("headset.msg")}
        </DialogDescription>
        <Button className="btn-press w-full font-semibold" onClick={accept}>
          {t("headset.ok")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { settings, prefs, setLang, setTheme, setInputMode, setRoundDuration, setSoundIntensity, t } = useGame();
  const [, navigate] = useLocation();
  const [best, setBest] = useState(0);
  const [counts, setCounts] = useState<Record<Difficulty, number> | null>(null);

  useEffect(() => {
    setBest(bestScore());
    loadWordBank(settings.lang)
      .then((bank) => setCounts(countsByDifficulty(bank)))
      .catch(() => setCounts(null));
  }, [settings.lang]);

  const go = (path: string) => navigate(path);

  return (
    <div className="relative flex min-h-full flex-col">
      <HeadsetDialog />

      {/* En-tête */}
      <header className="px-6 pb-1 pt-8 text-center sm:pt-10">
        <h1 className="font-display animate-fade-up text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-primary">PANIC</span> WORD
        </h1>
        <p className="animate-fade-up mt-2 text-sm text-muted-foreground" style={{ animationDelay: "60ms" }}>
          {t("app.subtitle")}
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-8">
        {/* Modes de jeu */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "100ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.mode")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => go("/solo")}
              className="btn-press flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Zap className="h-7 w-7 text-primary" />
              <span className="font-display text-lg font-bold">{t("home.solo")}</span>
              <span className="text-xs text-muted-foreground">{t("home.solo.desc")}</span>
            </button>
            <button
              onClick={() => go("/multi")}
              className="btn-press flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Users className="h-7 w-7 text-primary" />
              <span className="font-display text-lg font-bold">{t("home.multi")}</span>
              <span className="text-xs text-muted-foreground">{t("home.multi.desc")}</span>
            </button>
          </div>
        </section>

        {/* Langue */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "160ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.lang")}
          </h2>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as LangCode)}
                className={`btn-press flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  settings.lang === l.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="mr-1.5">{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
          {counts && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {counts.easy} {DIFFICULTY_LABELS.easy[settings.lang].toLowerCase()} ·{" "}
              {counts.medium} {DIFFICULTY_LABELS.medium[settings.lang].toLowerCase()} ·{" "}
              {counts.hard} {DIFFICULTY_LABELS.hard[settings.lang].toLowerCase()}
            </p>
          )}
        </section>

        {/* Thème */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "220ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.theme")}
          </h2>
          <div className="flex gap-2">
            {THEMES.map((th) => (
              <button
                key={th.id}
                onClick={() => setTheme(th.id as ThemeId)}
                className={`btn-press flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                  settings.theme === th.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {th.id === "horror" && <Skull className="h-4 w-4" />}
                {th.id === "cyberpunk" && <Zap className="h-4 w-4" />}
                {th.label[settings.lang]}
              </button>
            ))}
          </div>
        </section>

        {/* Durée du chrono */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "250ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.timer")}
          </h2>
          <div className="flex gap-2">
            {ROUND_DURATION_OPTIONS.map((ms, i) => (
              <button
                key={ms}
                onClick={() => setRoundDuration(ms)}
                className={`btn-press flex-1 rounded-lg border px-1 py-2.5 text-sm font-semibold transition-colors ${
                  settings.roundDurationMs === ms
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
                aria-label={`${Math.round(ms / 1000)} s`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {Math.round(ms / 1000)}s
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("home.timerLabel")}</p>
        </section>

        {/* Intensité sonore */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "280ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.intensity")}
          </h2>
          <div className="flex gap-2">
            {SOUND_INTENSITIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSoundIntensity(s.id as SoundIntensity)}
                className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors ${
                  settings.soundIntensity === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {s.label[settings.lang]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("home.intensityLabel")}</p>
        </section>

        {/* Mode de saisie (verrouillage équité) */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "310ms" }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.inputMode")}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("keyboard")}
              className={`btn-press flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                settings.inputMode === "keyboard"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <Keyboard className="h-4 w-4" />
              {t("home.keyboard")}
            </button>
            <button
              onClick={() => setInputMode("voice")}
              className={`btn-press flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                settings.inputMode === "voice"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <Mic className="h-4 w-4" />
              {t("home.voice")}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("home.locked")}</p>
        </section>

        {/* Record + lien historique */}
        <section className="animate-fade-up mt-7 flex items-center justify-center gap-2 text-sm text-muted-foreground" style={{ animationDelay: "340ms" }}>
          <button
            onClick={() => go("/history")}
            className="btn-press flex items-center gap-2 hover:text-foreground"
            aria-label={t("home.history")}
          >
            <Trophy className="h-4 w-4 text-primary" />
            <span>
              {t("home.best")} :{" "}
              <strong className="font-mono-display text-foreground">{best || 0}</strong>
            </span>
            <span className="text-xs underline underline-offset-2">{t("home.history")}</span>
          </button>
        </section>

        {/* CTA principal */}
        <div className="animate-fade-up mt-6" style={{ animationDelay: "400ms" }}>
          <Button
            size="lg"
            className="btn-press w-full py-6 text-lg font-bold tracking-wide"
            onClick={() => go("/solo")}
          >
            {t("home.play")}
          </Button>
        </div>

        {/* Comment jouer */}
        <p className="animate-fade-up mx-auto mt-6 max-w-xs text-center text-xs leading-relaxed text-muted-foreground" style={{ animationDelay: "460ms" }}>
          {t("home.howto")}
        </p>
      </main>

      <footer className="flex flex-col items-center gap-1.5 pb-3 text-center text-[10px] text-muted-foreground">
        <nav className="flex items-center gap-3">
          <Link href="/legal" className="underline underline-offset-2 hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Confidentialité
          </Link>
          <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
            Contact
          </Link>
        </nav>
        <span>
          PANIC WORD · 100 % hors-ligne · {prefs.lang.toUpperCase()}
        </span>
      </footer>
    </div>
  );
}
