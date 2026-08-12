import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { InputMode, LangCode, SoundIntensity, ThemeId } from "@shared/game";
import { LANGUAGES, SOUND_INTENSITIES, THEMES } from "@shared/game";
import { getPrefs, updatePrefs, type PlayerPrefs } from "@/lib/storage";

interface GameSettings {
  lang: LangCode;
  theme: ThemeId;
  inputMode: InputMode;
  roundDurationMs: number;
  soundIntensity: SoundIntensity;
  nickname: string;
}

interface GameContextValue {
  settings: GameSettings;
  prefs: PlayerPrefs;
  setLang: (lang: LangCode) => void;
  setTheme: (theme: ThemeId) => void;
  setInputMode: (mode: InputMode) => void;
  setRoundDuration: (ms: number) => void;
  setSoundIntensity: (intensity: SoundIntensity) => void;
  setNickname: (name: string) => void;
  t: (key: string) => string;
}

const GameContext = createContext<GameContextValue | null>(null);

/** Traductions de l'interface utilisateur. */
const UI: Record<string, Record<LangCode, string>> = {
  "app.title": { fr: "PANIC WORD", en: "PANIC WORD", es: "PANIC WORD" },
  "app.subtitle": {
    fr: "Devinez le mot. Avant qu'il ne soit trop tard.",
    en: "Guess the word. Before time runs out.",
    es: "Adivina la palabra. Antes de que sea tarde.",
  },
  "home.mode": { fr: "Mode de jeu", en: "Game mode", es: "Modo de juego" },
  "home.solo": { fr: "Solo", en: "Solo", es: "Solo" },
  "home.solo.desc": {
    fr: "Affrontez le chrono seul",
    en: "Race against the clock alone",
    es: "Compite contra el reloj",
  },
  "home.multi": { fr: "Multijoueur", en: "Multiplayer", es: "Multijugador" },
  "home.multi.desc": {
    fr: "Défiez vos amis en temps réel",
    en: "Challenge friends in real time",
    es: "Reta a tus amigos en tiempo real",
  },
  "home.lang": { fr: "Langue", en: "Language", es: "Idioma" },
  "home.theme": { fr: "Thème", en: "Theme", es: "Tema" },
  "home.play": { fr: "Jouer", en: "Play", es: "Jugar" },
  "home.best": { fr: "Meilleur score", en: "Best score", es: "Mejor puntuación" },
  "home.howto": {
    fr: "Un mot mélangé apparaît. Vous avez 3 secondes pour le deviner. Chaque lettre vit dans sa propre bulle. Tapez ou criez la réponse !",
    en: "A scrambled word appears. You have 3 seconds to guess it. Each letter lives in its own bubble. Type or shout your answer!",
    es: "Aparece una palabra desordenada. Tienes 3 segundos para adivinarla. ¡Escribe o grita tu respuesta!",
  },
  "home.inputMode": { fr: "Saisie", en: "Input", es: "Entrada" },
  "home.voice": { fr: "Voix seule", en: "Voice only", es: "Solo voz" },
  "home.keyboard": { fr: "Clavier seul", en: "Keyboard only", es: "Solo teclado" },
  "home.locked": {
    fr: "Mode de saisie verrouillé pour toute la partie",
    en: "Input mode locked for the whole game",
    es: "Modo de entrada bloqueado durante la partida",
  },
  "home.timer": { fr: "Chrono", en: "Timer", es: "Tiempo" },
  "home.timerLabel": {
    fr: "Temps par mot (2 à 10 s)",
    en: "Time per word (2 to 10 s)",
    es: "Tiempo por palabra (2 a 10 s)",
  },
  "home.intensity": { fr: "Intensité sonore", en: "Sound intensity", es: "Intensidad sonora" },
  "home.intensityLabel": {
    fr: "Niveau de pression sonore",
    en: "Sound pressure level",
    es: "Nivel de presión sonora",
  },
  "game.start": { fr: "COMMENCER", en: "START", es: "EMPEZAR" },
  "game.perRound": { fr: "par mot", en: "per word", es: "por palabra" },
  "headset.title": {
    fr: "⚠️ Alerte immersive",
    en: "⚠️ Immersive warning",
    es: "⚠️ Advertencia inmersiva",
  },
  "headset.msg": {
    fr: "Pour une expérience traumatisante maximale, branchez votre casque.",
    en: "For maximum traumatic experience, plug in your headphones.",
    es: "Para una experiencia traumática máxima, conéctate los auriculares.",
  },
  "headset.ok": { fr: "J'accepte le danger", en: "I accept the danger", es: "Acepto el peligro" },
  "game.ready": { fr: "Prêt ?", en: "Ready?", es: "¿Listo?" },
  "game.go": { fr: "GO !", en: "GO!", es: "¡GO!" },
  "game.input.ph": {
    fr: "Tapez le mot...",
    en: "Type the word...",
    es: "Escribe la palabra...",
  },
  "game.validate": { fr: "VALIDER", en: "SUBMIT", es: "ENVIAR" },
  "game.correct": { fr: "TROUVÉ !", en: "FOUND!", es: "¡ENCONTRADO!" },
  "game.missed": { fr: "TEMPS ÉCOULÉ", en: "TIME'S UP", es: "SE ACABÓ EL TIEMPO" },
  "game.wrong": {
    fr: "Pas ce mot… le temps file !",
    en: "Not the word… time is running!",
    es: "No es la palabra… ¡el tiempo corre!",
  },
  "game.round": { fr: "Manche", en: "Round", es: "Ronda" },
  "game.score": { fr: "Score", en: "Score", es: "Puntos" },
  "game.listening": { fr: "Écoute...", en: "Listening...", es: "Escuchando..." },
  "game.voiceError": {
    fr: "Reconnaissance vocale indisponible",
    en: "Voice recognition unavailable",
    es: "Reconocimiento de voz no disponible",
  },
  "end.title": { fr: "Partie terminée", en: "Game over", es: "Fin de la partida" },
  "end.total": { fr: "Score total", en: "Total score", es: "Puntuación total" },
  "end.best": { fr: "Record", en: "Record", es: "Récord" },
  "end.newRecord": {
    fr: "NOUVEAU RECORD !",
    en: "NEW RECORD!",
    es: "¡NUEVO RÉCORD!",
  },
  "end.wordsFound": {
    fr: "mots trouvés",
    en: "words found",
    es: "palabras encontradas",
  },
  "end.playAgain": { fr: "Rejouer", en: "Play again", es: "Jugar de nuevo" },
  "end.home": { fr: "Accueil", en: "Home", es: "Inicio" },
  "end.share": { fr: "Partager", en: "Share", es: "Compartir" },
  "end.copied": {
    fr: "Résultat copié !",
    en: "Result copied!",
    es: "¡Resultado copiado!",
  },
  "end.round": { fr: "Manche", en: "Round", es: "Ronda" },
  "end.word": { fr: "Mot", en: "Word", es: "Palabra" },
  "end.points": { fr: "Points", en: "Points", es: "Puntos" },
  "room.create": { fr: "Créer une salle", en: "Create room", es: "Crear sala" },
  "room.join": { fr: "Rejoindre", en: "Join", es: "Unirse" },
  "room.code": { fr: "Code de la salle", en: "Room code", es: "Código de sala" },
  "room.code.ph": { fr: "Ex. K7QZ", en: "e.g. K7QZ", es: "ej. K7QZ" },
  "room.yourCode": {
    fr: "Votre code",
    en: "Your code",
    es: "Tu código",
  },
  "room.waiting": {
    fr: "En attente de joueurs... Partagez le code !",
    en: "Waiting for players... Share the code!",
    es: "Esperando jugadores... ¡Comparte el código!",
  },
  "room.start": { fr: "Lancer la partie", en: "Start game", es: "Empezar" },
  "room.players": { fr: "Joueurs", en: "Players", es: "Jugadores" },
  "room.enter": { fr: "Entrer", en: "Enter", es: "Entrar" },
  "room.error": {
    fr: "Salle introuvable. Vérifiez le code.",
    en: "Room not found. Check the code.",
    es: "Sala no encontrada. Verifica el código.",
  },
  "room.nickname": { fr: "Votre pseudo", en: "Your nickname", es: "Tu apodo" },
  "room.nickname.ph": { fr: "Ex. ShadowHunter", en: "e.g. ShadowHunter", es: "ej. ShadowHunter" },
  "voiceNotSupported": {
    fr: "La reconnaissance vocale n'est pas supportée par ce navigateur.",
    en: "Voice recognition is not supported by this browser.",
    es: "Este navegador no soporta el reconocimiento de voz.",
  },
  "history.title": { fr: "Historique", en: "History", es: "Historial" },
  "history.subtitle": { fr: "Vos 50 dernières parties", en: "Your last 50 games", es: "Tus últimas 50 partidas" },
  "history.empty": {
    fr: "Aucune partie enregistrée. Jouez pour commencer !",
    en: "No games recorded. Play to start!",
    es: "Sin partidas registradas. ¡Juega para empezar!",
  },
  "history.clear": { fr: "Effacer", en: "Clear", es: "Borrar" },
  "home.history": { fr: "Historique", en: "History", es: "Historial" },
};

export function useTranslation(key: string): string {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useTranslation must be used within GameProvider");
  return ctx.t(key);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<PlayerPrefs>(() => getPrefs());

  const setPrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefsState((prev) => {
      const next = updatePrefs(patch);
      return { ...prev, ...next };
    });
  }, []);

  // Applique le thème sur le document (sans rechargement)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.theme);
    document.documentElement.lang = prefs.lang;
  }, [prefs.theme, prefs.lang]);

  const settings = useMemo<GameSettings>(
    () => ({
      lang: prefs.lang,
      theme: prefs.theme,
      inputMode: prefs.inputMode,
      roundDurationMs: prefs.roundDurationMs,
      soundIntensity: prefs.soundIntensity,
      nickname: prefs.nickname,
    }),
    [prefs],
  );

  const t = useCallback(
    (key: string): string => {
      const entry = UI[key];
      if (!entry) return key;
      return entry[prefs.lang] ?? entry.fr ?? key;
    },
    [prefs.lang],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      settings,
      prefs,
      setLang: (lang) => setPrefs({ lang }),
      setTheme: (theme) => setPrefs({ theme }),
      setInputMode: (inputMode) => setPrefs({ inputMode }),
      setRoundDuration: (roundDurationMs) => setPrefs({ roundDurationMs }),
      setSoundIntensity: (soundIntensity) => setPrefs({ soundIntensity }),
      setNickname: (nickname) => setPrefs({ nickname }),
      t,
    }),
    [settings, prefs, setPrefs, t],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export { LANGUAGES, SOUND_INTENSITIES, THEMES };
