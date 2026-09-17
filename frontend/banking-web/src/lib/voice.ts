'use client';

/**
 * Helpers voix de l'Assistant Shield (Web Speech API du navigateur).
 * — Reconnaissance vocale (notes vocales du client → texte)
 * — Synthèse vocale (réponses de l'assistant → voix)
 * Aucune API externe requise : tout tourne dans le navigateur.
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function speechRecognitionSupported(): boolean {
  return !!getRecognitionCtor();
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface RecognizerHandle {
  stop: () => void;
}

/**
 * Démarre l'écoute micro. `onFinal` reçoit la transcription définitive,
 * `onInterim` le texte provisoire (affiché en direct dans la bulle micro).
 */
export function startRecognition(opts: {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}): RecognizerHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec: SpeechRecognitionLike = new Ctor();
  rec.lang = opts.lang || 'fr-FR';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    if (interim) opts.onInterim(interim);
    if (finalText) {
      opts.onInterim(finalText);
    }
  };
  rec.onerror = (event: any) => opts.onError?.(event?.error || 'unknown');
  rec.onend = () => {
    opts.onEnd?.();
    if (finalText.trim()) opts.onFinal(finalText.trim());
  };

  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* déjà arrêté */
      }
    },
  };
}

/** Nettoie un texte avant lecture à voix haute (emojis, puces, tirets TX-…). */
export function prepareForSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/✅|•/g, ',')
    .replace(/TX-(\d{4})-(\d+)/gi, 'référence T X $1 $2')
    .replace(/XAF/g, 'francs CFA')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SpeechHandle {
  cancel: () => void;
}

/** Lit un texte à voix haute. Retourne un handle pour interrompre. */
export function speak(text: string, opts: { lang?: string; onEnd?: () => void } = {}): SpeechHandle | null {
  if (!speechSynthesisSupported()) return null;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(prepareForSpeech(text));
  utterance.lang = opts.lang || 'fr-FR';
  utterance.rate = 1.02;
  utterance.pitch = 1;

  // Choix d'une voix française si disponible.
  const voices = synth.getVoices();
  const frVoice =
    voices.find((v) => v.lang === 'fr-FR') ||
    voices.find((v) => v.lang.startsWith('fr'));
  if (frVoice) utterance.voice = frVoice;

  utterance.onend = () => opts.onEnd?.();
  utterance.onerror = () => opts.onEnd?.();
  synth.speak(utterance);
  return {
    cancel: () => {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
