/**
 * PANIC WORD — moteur audio 100 % synthétisé (Web Audio API).
 * Aucun fichier audio externe : tous les sons (compte à rebours, victoire,
 * échec, ambiance horreur/cyberpunk) sont générés en temps réel.
 */

import type { SoundIntensity, ThemeId } from "@shared/game";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStopped = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function resumeAudio(): void {
  void getCtx().resume();
}

export function setVolume(v: number): void {
  if (masterGain) masterGain.gain.value = Math.min(1, Math.max(0, v));
}

/* ------------------------------------------------------------------ */
/* Bip court (compte à rebours)                                        */
/* ------------------------------------------------------------------ */
function beep(
  when: number,
  duration: number,
  freq: number,
  type: OscillatorType = "square",
  volume = 0.25,
): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

/** Bip du compte à rebours — fréquence qui monte avec le stress. */
export function countdownTick(progress: number): void {
  // progress 0..1 → bip plus aigu et plus fort à mesure que le temps passe
  const mult = intensity === "terrifying" ? 1.5 : intensity === "soft" ? 0.5 : 1;
  const base = intensity === "terrifying" ? 380 : 440;
  const max = intensity === "terrifying" ? 1320 : 1100;
  const freq = base + progress * (max - base);
  beep(getCtx().currentTime, 0.09, freq, "square", (0.15 + progress * 0.2) * mult);
}

/* ------------------------------------------------------------------ */
/* Son de victoire : accord majeur ascendant néon-pop (Ta-da!)         */
/* ------------------------------------------------------------------ */
export function playVictory(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = now + i * 0.09;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

/* ------------------------------------------------------------------ */
/* Son d'erreur de saisie : court "buzz" sec (n'interrompt pas le chrono) */
/* ------------------------------------------------------------------ */
export function playWrong(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const mult = intensity === "terrifying" ? 1.25 : intensity === "soft" ? 0.7 : 1;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.linearRampToValueAtTime(90, now + 0.18);
  gain.gain.setValueAtTime(0.25 * mult, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(gain);
  gain.connect(masterGain!);
  safeStart(osc, now);
  osc.stop(now + 0.3);
}

/* ------------------------------------------------------------------ */
/* Son d'échec : klaxon sourd descendant (Womp-womp)                   */
/* ------------------------------------------------------------------ */
export function playFailure(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.9);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
  osc.connect(gain);
  gain.connect(masterGain!);
  safeStart(osc, now);
  osc.stop(now + 1.05);
}

/* ------------------------------------------------------------------ */
/* Ambiance thématique de surpression (1s → 3s)                        */
/* ------------------------------------------------------------------ */
let ambientTimer: ReturnType<typeof setInterval> | null = null;
let ambientNodes: { stop: () => void }[] = [];
let intensity: SoundIntensity = "normal";

function stopAllAmbient(): void {
  if (ambientTimer) clearInterval(ambientTimer);
  ambientTimer = null;
  ambientNodes.forEach((n) => n.stop());
  ambientNodes = [];
  ambientStopped = true;
}

/**
 * Lance l'ambiance de surpression selon le thème.
 * S'intensifie de façon exponentielle durant 2000 ms (de 1s à 3s),
 * puis s'arrête brutalement à la fin du round.
 */
/** Définit le niveau d'intensité sonore global. */
export function setSoundIntensity(i: SoundIntensity): void {
  intensity = i;
}

/** Coefficients de pression selon l'intensité choisie. */
function pressureCoeffs(): { vol: number; lfoHz: number; lfoAmt: number; endFreq: number; tickBase: number } {
  switch (intensity) {
    case "soft":
      return { vol: 0.5, lfoHz: 12, lfoAmt: 250, endFreq: 900, tickBase: 560 };
    case "terrifying":
      return { vol: 1.3, lfoHz: 31, lfoAmt: 700, endFreq: 2400, tickBase: 420 };
    default:
      return { vol: 1, lfoHz: 23, lfoAmt: 400, endFreq: 1600, tickBase: 480 };
  }
}

export function startPressureAmbiance(theme: ThemeId, durationMs = 2000): () => void {
  stopAllAmbient();
  ambientStopped = false;
  const ac = getCtx();
  const start = ac.currentTime;
  const end = start + durationMs / 1000;
  const k = pressureCoeffs();

  if (theme === "horror") {
    // Grincement métallique strident qui monte + vibrato sismique + seconde voix dissonante
    const screech: OscillatorNode = ac.createOscillator();
    const screechGain = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const drone = ac.createOscillator();
    const droneGain = ac.createGain();
    const dissonant = ac.createOscillator();
    const dissonantGain = ac.createGain();
    screech.type = "sawtooth";
    screech.frequency.setValueAtTime(180, start);
    screech.frequency.linearRampToValueAtTime(k.endFreq, end);
    lfo.frequency.value = k.lfoHz;
    lfoGain.gain.value = k.lfoAmt;
    lfo.connect(lfoGain);
    lfoGain.connect(screech.frequency);
    screechGain.gain.setValueAtTime(0, start);
    screechGain.gain.linearRampToValueAtTime(0.16 * k.vol, end);
    screech.connect(screechGain);
    screechGain.connect(masterGain!);
    screech.start(start);
    lfo.start(start);
    ambientNodes.push({ stop: () => { try { screech.stop(); } catch { /* */ } try { lfo.stop(); } catch { /* */ } } });

    // Drone sourd qui vibre sous la peau (48 Hz) et seconde voix à triton
    drone.type = "sine";
    drone.frequency.setValueAtTime(48, start);
    droneGain.gain.setValueAtTime(0, start);
    droneGain.gain.linearRampToValueAtTime(0.3 * k.vol, end);
    drone.connect(droneGain);
    droneGain.connect(masterGain!);
    drone.start(start);
    dissonant.type = "square";
    dissonant.frequency.setValueAtTime(272, start); // triton par rapport à ~192
    dissonant.frequency.linearRampToValueAtTime(1414, end);
    dissonantGain.gain.setValueAtTime(0, start);
    dissonantGain.gain.linearRampToValueAtTime(0.05 * k.vol, end);
    dissonant.connect(dissonantGain);
    dissonantGain.connect(masterGain!);
    dissonant.start(start);
    ambientNodes.push({ stop: () => {
      try { drone.stop(); } catch { /* */ }
      try { dissonant.stop(); } catch { /* */ }
      droneGain.disconnect();
      dissonantGain.disconnect();
    } });
    // Craquements aléatoires (ampoule qui grille), plus fréquents en terrifying
    const crackRate = intensity === "terrifying" ? 0.55 : 0.35;
    ambientTimer = setInterval(() => {
      if (ambientStopped) return;
      if (Math.random() < crackRate) crackle(ac, k.vol);
    }, 160);
  } else if (theme === "cyberpunk") {
    // Sirene de bombe qui accélère + sub-bass écrasant
    let interval = 480;
    let nextAt = start + 0.1;
    const sub = ac.createOscillator();
    const subGain = ac.createGain();
    sub.type = "sine";
    sub.frequency.value = 42;
    subGain.gain.setValueAtTime(0.0, start);
    subGain.gain.linearRampToValueAtTime(0.4 * k.vol, end);
    sub.connect(subGain);
    subGain.connect(masterGain!);
    sub.start(start);
    ambientNodes.push({ stop: () => { try { sub.stop(); } catch { /* */ } } });

    const tickVol = 0.22 * k.vol;
    const decay = intensity === "terrifying" ? 0.55 : 0.72;
    ambientTimer = setInterval(() => {
      if (ambientStopped) return;
      const now = ac.currentTime;
      if (now >= nextAt) {
        beep(now, 0.06, k.tickBase + Math.random() * 300, "square", tickVol);
        nextAt = now + interval / 1000;
        interval = Math.max(45, interval * decay);
      }
    }, 16);
  } else {
    // Thème normal : tic-tac qui s'accélère, volume selon l'intensité
    let interval = 500;
    let nextAt = start + 0.1;
    const tickVol = 0.12 * k.vol;
    const decay = intensity === "terrifying" ? 0.6 : 0.78;
    ambientTimer = setInterval(() => {
      if (ambientStopped) return;
      const now = ac.currentTime;
      if (now >= nextAt) {
        beep(now, 0.05, 660, "sine", tickVol);
        nextAt = now + interval / 1000;
        interval = Math.max(110, interval * decay);
      }
    }, 16);
  }

  return () => {
    stopAllAmbient();
  };
}

/** Démarre un nœud en évitant le double-démarrage et le re-démarrage d'un nœud arrêté. */
function safeStart(node: AudioScheduledSourceNode, when: number): void {
  try {
    node.start(when);
  } catch {
    /* nœud déjà démarré, arrêté, ou contexte clos : on ignore */
  }
}

function crackle(ac: AudioContext, volMult = 1): void {
  const now = ac.currentTime;
  const bufferSize = ac.sampleRate * 0.08;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.35 * volMult, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2400;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  src.start(now);
}

/* ------------------------------------------------------------------ */
/* Coup de révélation : porte lourde (horreur) / impact cyber          */
/* ------------------------------------------------------------------ */
export function playReveal(theme: ThemeId): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const k = intensity === "terrifying" ? 1.35 : intensity === "soft" ? 0.6 : 1;
  if (theme === "horror") {
    // Porte lourde qui claque : impact basse fréquence + résonance
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(now);
    osc.stop(now + 0.55);
  } else if (theme === "cyberpunk") {
    // Impact électronique : chute rapide + shimmer
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(now);
    osc.stop(now + 0.35);
  } else {
    beep(now, 0.12, 520, "sine", 0.2);
  }
}

/** Nettoie le contexte audio (appelé au démontage de l'app). */
export function disposeAudio(): void {
  stopAllAmbient();
  if (ctx) {
    void ctx.close();
    ctx = null;
    masterGain = null;
  }
}
