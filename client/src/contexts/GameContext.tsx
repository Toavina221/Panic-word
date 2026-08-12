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
  "app.title": { fr: "PANIC WORD", en: "PANIC WORD", es: "PANIC WORD", mg: "PANIC WORD", de: "PANIC WORD" },
  "app.subtitle": {
    fr: "Devinez le mot. Avant qu'il ne soit trop tard.",
    en: "Guess the word. Before time runs out.",
    es: "Adivina la palabra. Antes de que sea tarde.",
    mg: "Tsindrio ny teny. Alohan'ny ho tara.",
    de: "Errate das Wort. Bevor es zu spät ist.",
  },
  "home.mode": { fr: "Mode de jeu", en: "Game mode", es: "Modo de juego", mg: "Fomba filalaovana", de: "Spielmodus" },
  "home.solo": { fr: "Solo", en: "Solo", es: "Solo", mg: "Irery", de: "Einzeln" },
  "home.solo.desc": {
    fr: "Affrontez le chrono seul",
    en: "Race against the clock alone",
    es: "Compite contra el reloj",
    mg: "Miatrika ny fotoana irery",
    de: "Kämpfe allein gegen die Uhr",
  },
  "home.multi": { fr: "Multijoueur", en: "Multiplayer", es: "Multijugador", mg: "Mpilalao maro", de: "Mehrspieler" },
  "home.multi.desc": {
    fr: "Défiez vos amis en temps réel",
    en: "Challenge friends in real time",
    es: "Reta a tus amigos en tiempo real",
    mg: "Mieritreritra ny namanao amin'ny fotoana tena",
    de: "Fordere Freunde in Echtzeit heraus",
  },
  "home.lang": { fr: "Langue", en: "Language", es: "Idioma", mg: "Fiteny", de: "Sprache" },
  "home.theme": { fr: "Thème", en: "Theme", es: "Tema", mg: "Loko", de: "Thema" },
  "home.play": { fr: "Jouer", en: "Play", es: "Jugar", mg: "Milalao", de: "Spielen" },
  "home.best": { fr: "Meilleur score", en: "Best score", es: "Mejor puntuación", mg: "Naoty tsara indrindra", de: "Bester Punktestand" },
  "home.howto": {
    fr: "Un mot mélangé apparaît. Vous avez 3 secondes pour le deviner. Chaque lettre vit dans sa propre bulle. Tapez ou criez la réponse !",
    en: "A scrambled word appears. You have 3 seconds to guess it. Each letter lives in its own bubble. Type or shout your answer!",
    es: "Aparece una palabra desordenada. Tienes 3 segundos para adivinarla. ¡Escribe o grita tu respuesta!",
    mg: "Miseho teny mifangaro. 3 segondra hahitana azy. Ny litera tsirairay ao anaty baomba. Soraty na teriky ny valiny!",
    de: "Ein gemischtes Wort erscheint. Du hast 3 Sekunden zum Raten. Jeder Buchstabe lebt in seiner eigenen Blase. Tippe oder rufe die Antwort!",
  },
  "home.inputMode": { fr: "Saisie", en: "Input", es: "Entrada", mg: "Fidirana", de: "Eingabe" },
  "home.voice": { fr: "Voix seule", en: "Voice only", es: "Solo voz", mg: "Feo ihany", de: "Nur Sprache" },
  "home.keyboard": { fr: "Clavier seul", en: "Keyboard only", es: "Solo teclado", mg: "Klaviye ihany", de: "Nur Tastatur" },
  "home.locked": {
    fr: "Mode de saisie verrouillé pour toute la partie",
    en: "Input mode locked for the whole game",
    es: "Modo de entrada bloqueado durante la partida",
    mg: "Ny fomba fampidirana voahidy mandritra ny lalao manontolo",
    de: "Eingabemodus für das gesamte Spiel gesperrt",
  },
  "home.timer": { fr: "Chrono", en: "Timer", es: "Tiempo", mg: "Fotoana", de: "Timer" },
  "home.timerLabel": {
    fr: "Temps par mot (2 à 10 s)",
    en: "Time per word (2 to 10 s)",
    es: "Tiempo por palabra (2 a 10 s)",
    mg: "Fotoana isaky ny teny (2 ka hatramin'ny 10 s)",
    de: "Zeit pro Wort (2 bis 10 s)",
  },
  "home.intensity": { fr: "Intensité sonore", en: "Sound intensity", es: "Intensidad sonora", mg: "Hatevitry ny feo", de: "Klangintensität" },
  "home.intensityLabel": {
    fr: "Niveau de pression sonore",
    en: "Sound pressure level",
    es: "Nivel de presión sonora",
    mg: "Ambaratongan'ny herin'ny feo",
    de: "Geräuschdrucklevel",
  },
  "game.start": { fr: "COMMENCER", en: "START", es: "EMPEZAR", mg: "ATOMBOHY", de: "STARTEN" },
  "game.perRound": { fr: "par mot", en: "per word", es: "por palabra", mg: "isaky ny teny", de: "pro Wort" },
  "headset.title": {
    fr: "⚠️ Alerte immersive",
    en: "⚠️ Immersive warning",
    es: "⚠️ Advertencia inmersiva",
    mg: "⚠️ Fampitandremana",
    de: "⚠️ Immersive Warnung",
  },
  "headset.msg": {
    fr: "Pour une expérience traumatisante maximale, branchez votre casque.",
    en: "For maximum traumatic experience, plug in your headphones.",
    es: "Para una experiencia traumática máxima, conéctate los auriculares.",
    mg: "Mba hahazoana traikefa mahatsiravina indrindra, ampifandraiso ny casque.",
    de: "Für maximale traumatische Erfahrung: Kopfhörer anschließen.",
  },
  "headset.ok": { fr: "J'accepte le danger", en: "I accept the danger", es: "Acepto el peligro", mg: "Ako ny loza", de: "Ich nehme die Gefahr an" },
  "game.ready": { fr: "Prêt ?", en: "Ready?", es: "¿Listo?", mg: "Vonona ve?", de: "Bereit?" },
  "game.go": { fr: "GO !", en: "GO!", es: "¡GO!", mg: "ANDAO!", de: "LOS!" },
  "game.input.ph": {
    fr: "Tapez le mot...",
    en: "Type the word...",
    es: "Escribe la palabra...",
    mg: "Soraty ny teny...",
    de: "Tippe das Wort...",
  },
  "game.validate": { fr: "VALIDER", en: "SUBMIT", es: "ENVIAR", mg: "VALIDER", de: "BESTÄTIGEN" },
  "game.correct": { fr: "TROUVÉ !", en: "FOUND!", es: "¡ENCONTRADO!", mg: "HITANY!", de: "GEFUNDEN!" },
  "game.missed": { fr: "TEMPS ÉCOULÉ", en: "TIME'S UP", es: "SE ACABÓ EL TIEMPO", mg: "VITA NY FOTOANA", de: "ZEIT ABGELAUFEN" },
  "game.wrong": {
    fr: "Pas ce mot… le temps file !",
    en: "Not the word… time is running!",
    es: "No es la palabra… ¡el tiempo corre!",
    mg: "Tsy io no teny… mandeha ny fotoana!",
    de: "Nicht das Wort… die Zeit rennt!",
  },
  "game.round": { fr: "Manche", en: "Round", es: "Ronda", mg: "Faritra", de: "Runde" },
  "game.score": { fr: "Score", en: "Score", es: "Puntos", mg: "Naoty", de: "Punkte" },
  "game.listening": { fr: "Écoute...", en: "Listening...", es: "Escuchando...", mg: "Mihaino...", de: "Höre zu..." },
  "game.voiceError": {
    fr: "Reconnaissance vocale indisponible",
    en: "Voice recognition unavailable",
    es: "Reconocimiento de voz no disponible",
    mg: "Tsy misy ny fanavahana feo",
    de: "Spracherkennung nicht verfügbar",
  },
  "end.title": { fr: "Partie terminée", en: "Game over", es: "Fin de la partida", mg: "Vita ny lalao", de: "Spiel beendet" },
  "end.total": { fr: "Score total", en: "Total score", es: "Puntuación total", mg: "Naoty manontolo", de: "Gesamtpunktzahl" },
  "end.best": { fr: "Record", en: "Record", es: "Récord", mg: "Rekôrdra", de: "Rekord" },
  "end.newRecord": {
    fr: "NOUVEAU RECORD !",
    en: "NEW RECORD!",
    es: "¡NUEVO RÉCORD!",
    mg: "REKÔRDRA VAOVAO!",
    de: "NEUER REKORD!",
  },
  "end.wordsFound": {
    fr: "mots trouvés",
    en: "words found",
    es: "palabras encontradas",
    mg: "teny hitany",
    de: "Wörter gefunden",
  },
  "end.playAgain": { fr: "Rejouer", en: "Play again", es: "Jugar de nuevo", mg: "Hilalao indray", de: "Nochmal spielen" },
  "end.home": { fr: "Accueil", en: "Home", es: "Inicio", mg: "Fandraisana", de: "Startseite" },
  "end.share": { fr: "Partager", en: "Share", es: "Compartir", mg: "Hizarana", de: "Teilen" },
  "end.copied": {
    fr: "Résultat copié !",
    en: "Result copied!",
    es: "¡Resultado copiado!",
    mg: "Voadika ny valiny!",
    de: "Ergebnis kopiert!",
  },
  "end.round": { fr: "Manche", en: "Round", es: "Ronda", mg: "Faritra", de: "Runde" },
  "end.word": { fr: "Mot", en: "Word", es: "Palabra", mg: "Teny", de: "Wort" },
  "end.points": { fr: "Points", en: "Points", es: "Puntos", mg: "Naoty", de: "Punkte" },
  "room.create": { fr: "Créer une salle", en: "Create room", es: "Crear sala", mg: "Hamorona efitrano", de: "Raum erstellen" },
  "room.join": { fr: "Rejoindre", en: "Join", es: "Unirse", mg: "Hiditra", de: "Beitreten" },
  "room.code": { fr: "Code de la salle", en: "Room code", es: "Código de sala", mg: "Kaodin'ny efitrano", de: "Raumcode" },
  "room.code.ph": { fr: "Ex. K7QZ", en: "e.g. K7QZ", es: "ej. K7QZ", mg: "Oh. K7QZ", de: "z. B. K7QZ" },
  "room.yourCode": {
    fr: "Votre code",
    en: "Your code",
    es: "Tu código",
    mg: "Ny kaodinao",
    de: "Dein Code",
  },
  "room.waiting": {
    fr: "En attente de joueurs... Partagez le code !",
    en: "Waiting for players... Share the code!",
    es: "Esperando jugadores... ¡Comparte el código!",
    mg: "Miandry mpilalao... Zarao ny kaody!",
    de: "Warte auf Spieler... Teile den Code!",
  },
  "room.start": { fr: "Lancer la partie", en: "Start game", es: "Empezar", mg: "Manomboka ny lalao", de: "Spiel starten" },
  "room.players": { fr: "Joueurs", en: "Players", es: "Jugadores", mg: "Mpilalao", de: "Spieler" },
  "room.enter": { fr: "Entrer", en: "Enter", es: "Entrar", mg: "Hiditra", de: "Betreten" },
  "room.error": {
    fr: "Salle introuvable. Vérifiez le code.",
    en: "Room not found. Check the code.",
    es: "Sala no encontrada. Verifica el código.",
    mg: "Tsy hita ny efitrano. Jereo ny kaody.",
    de: "Raum nicht gefunden. Prüfe den Code.",
  },
  "room.nickname": { fr: "Votre pseudo", en: "Your nickname", es: "Tu apodo", mg: "Anaranao", de: "Dein Spitzname" },
  "room.nickname.ph": { fr: "Ex. ShadowHunter", en: "e.g. ShadowHunter", es: "ej. ShadowHunter", mg: "Oh. ShadowHunter", de: "z. B. ShadowHunter" },
  "voiceNotSupported": {
    fr: "La reconnaissance vocale n'est pas supportée par ce navigateur.",
    en: "Voice recognition is not supported by this browser.",
    es: "Este navegador no soporta el reconocimiento de voz.",
    mg: "Tsy tohanan'ity mpitety tranonkala ity ny fanavahana feo.",
    de: "Dieser Browser unterstützt keine Spracherkennung.",
  },
  "history.title": { fr: "Historique", en: "History", es: "Historial", mg: "Tantaran'ny lalao", de: "Verlauf" },
  "history.subtitle": { fr: "Vos 50 dernières parties", en: "Your last 50 games", es: "Tus últimas 50 partidas", mg: "Lalao 50 farany", de: "Deine letzten 50 Spiele" },
  "history.empty": {
    fr: "Aucune partie enregistrée. Jouez pour commencer !",
    en: "No games recorded. Play to start!",
    es: "Sin partidas registradas. ¡Juega para empezar!",
    mg: "Tsy misy lalao voatahiry. Milalao hanombohana!",
    de: "Keine Spiele aufgezeichnet. Spiele los!",
  },
  "history.clear": { fr: "Effacer", en: "Clear", es: "Borrar", mg: "Fafana", de: "Löschen" },
  "home.history": { fr: "Historique", en: "History", es: "Historial", mg: "Tantaran'ny lalao", de: "Verlauf" },
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
