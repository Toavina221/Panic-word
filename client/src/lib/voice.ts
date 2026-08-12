/**
 * PANIC WORD — module de reconnaissance vocale (Web Speech API).
 * Traitement 100 % local (reconnaissance embarquée du navigateur),
 * aucune donnée transmise volontairement par notre application.
 * Fallback gracieux si l'API n'est pas disponible.
 */

export interface VoiceResult {
  transcript: string;
  raw: string;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechResultEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  item(i: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  item(i: number): { transcript: string; confidence: number };
  [index: number]: { transcript: string; confidence: number };
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Le navigateur supporte-t-il la reconnaissance vocale ? */
export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * Écoute la voix et résout dès qu'un transcript est produit.
 * Retourne un objet contrôlable pour arrêter l'écoute.
 */
export function listenVoice(
  langCode: string,
  onTranscript: (r: VoiceResult) => void,
  onError?: (err: string) => void,
): () => void {
  const Ctor = getRecognitionCtor();
  let rec: SpeechRecognitionLike | null = null;
  let stopped = false;
  /** Évite les redémarrages en double (onend + onend concurrents, ou onend après abort). */
  let running = false;

  function startRec(): void {
    if (stopped || running || !rec) return;
    running = true;
    try {
      rec.start();
    } catch {
      running = false;
      /* déjà démarrée ou détruite */
    }
  }

  function release(): void {
    running = false;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignoré */
      }
      rec = null;
    }
  }

  if (!Ctor) {
    onError?.("unsupported");
    return () => {};
  }

  try {
    rec = new Ctor();
  } catch {
    onError?.("unsupported");
    return () => {};
  }

  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = mapLangToSpeechLocale(langCode);

  const onResultHandler = (ev: SpeechResultEvent) => {
    if (stopped) return;
    const list = ev.results[ev.resultIndex];
    if (list && list.length > 0) {
      const alt = list[0];
      onTranscript({ transcript: alt.transcript.trim(), raw: alt.transcript });
    }
  };
  const onErrorHandler = (ev: { error: string }) => {
    if (stopped) return;
    running = false;
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    onError?.(ev.error);
    // Reprise automatique : recrée une instance fraîche (une instance arrêtée ne peut plus démarrer)
    if (!stopped && Ctor) {
      try {
        release();
        rec = new Ctor();
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 3;
        rec.lang = mapLangToSpeechLocale(langCode);
        rec.onresult = onResultHandler;
        rec.onerror = onErrorHandler;
        rec.onend = onEndHandler;
        startRec();
      } catch {
        onError?.("unsupported");
      }
    }
  };
  const onEndHandler = () => {
    running = false;
    // Redémarrage automatique tant que l'utilisateur n'a pas arrêté
    if (!stopped && rec) {
      startRec();
    }
  };

  rec.onresult = onResultHandler;
  rec.onerror = onErrorHandler;
  rec.onend = onEndHandler;

  try {
    startRec();
  } catch {
    onError?.("unsupported");
    return () => {};
  }

  return () => {
    stopped = true;
    release();
  };
}

/**
 * Mappe un code de langue (fr/en/es/mg/de) vers une locale SpeechRecognition
 * (fr-FR, en-US, es-ES, mg-MG, de-DE).
 */
export function mapLangToSpeechLocale(langCode: string): string {
  switch (langCode) {
    case "en":
      return "en-US";
    case "es":
      return "es-ES";
    case "mg":
      return "mg-MG";
    case "de":
      return "de-DE";
    case "fr":
    default:
      return "fr-FR";
  }
}
