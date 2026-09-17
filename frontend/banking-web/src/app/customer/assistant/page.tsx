'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bot,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Cpu,
} from 'lucide-react';
import PageHero from '@/components/PageHero';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatXAF } from '@/lib/format';
import { RISK_LABELS, RISK_STYLES, TX_STATUS_LABELS, TX_STATUS_STYLES } from '@/lib/labels';
import {
  speak,
  speechRecognitionSupported,
  speechSynthesisSupported,
  startRecognition,
  stopSpeaking,
  type RecognizerHandle,
  type SpeechHandle,
} from '@/lib/voice';

interface Msg {
  role: 'user' | 'bot';
  text: string;
  time: string;
  voiceIn?: boolean;
  txs?: any[];
  suggestions?: string[];
  engine?: 'builtin' | 'llm';
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function TxMiniCard({ tx }: { tx: any }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800">{tx.typeLabel}</span>
          <span className="font-mono text-[10px] text-slate-500">{tx.reference}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={TX_STATUS_STYLES[tx.status] || 'bg-slate-100 text-slate-600 ring-slate-500/20'}>
            {TX_STATUS_LABELS[tx.status] || tx.status}
          </Badge>
          {tx.riskLevel && (
            <Badge tone={RISK_STYLES[tx.riskLevel] || 'bg-slate-100 text-slate-600 ring-slate-500/20'}>
              Risque {RISK_LABELS[tx.riskLevel]?.toLowerCase()}{tx.riskScore != null ? ` · ${tx.riskScore}/100` : ''}
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-black text-slate-900">{formatXAF(tx.amount)}</div>
        <div className="text-[10px] text-slate-500">{formatDateTime(tx.createdAt)}</div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const recognizer = useRef<RecognizerHandle | null>(null);
  const speech = useRef<SpeechHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Déterminés après montage (APIs navigateur) pour éviter tout décalage d'hydratation.
  const [micSupported, setMicSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setMicSupported(speechRecognitionSupported());
    setTtsSupported(speechSynthesisSupported());
  }, []);

  // ------------------------------------------------------------- envoi
  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const clean = text.trim();
      if (!clean || thinking) return;
      setInput('');
      setInterim('');
      stopSpeaking();
      setSpeaking(false);
      setMessages((m) => [...m, { role: 'user', text: clean, time: new Date().toISOString(), voiceIn: viaVoice }]);
      setThinking(true);
      try {
        const res = await api.post('/customer/assistant/chat', { message: clean });
        const bot: Msg = {
          role: 'bot',
          text: res.reply,
          time: new Date().toISOString(),
          txs: res.transactions,
          suggestions: res.suggestions,
          engine: res.engine,
        };
        setMessages((m) => [...m, bot]);
        if (voiceOn && ttsSupported && res.spoken) {
          speech.current = speak(res.spoken, { onEnd: () => setSpeaking(false) });
          if (speech.current) setSpeaking(true);
        }
      } catch (e: any) {
        setMessages((m) => [
          ...m,
          {
            role: 'bot',
            text: e?.message || 'Une erreur est survenue, veuillez réessayer.',
            time: new Date().toISOString(),
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, voiceOn, ttsSupported],
  );

  // ------------------------------------------------------------- accueil
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/customer/assistant/welcome');
        if (!cancelled) {
          setMessages([
            { role: 'bot', text: res.reply, time: new Date().toISOString(), suggestions: res.suggestions },
          ]);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: 'bot',
              text: 'Bonjour ! Je suis Shield, votre assistant bancaire. Posez-moi vos questions sur votre solde, vos transactions ou la sécurité.',
              time: new Date().toISOString(),
              suggestions: ['Quel est mon solde ?', 'Mes dernières transactions'],
            },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
      recognizer.current?.stop();
    };
  }, []);

  // ------------------------------------------------------------- scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, interim]);

  // ------------------------------------------------------------- micro
  const toggleMic = () => {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const handle = startRecognition({
      lang: 'fr-FR',
      onInterim: (t) => setInterim(t),
      onFinal: (t) => send(t, true),
      onError: (err) => {
        if (err !== 'aborted' && err !== 'no-speech') {
          setMessages((m) => [
            ...m,
            {
              role: 'bot',
              text: "Je n'ai pas pu accéder au micro. Vérifiez les autorisations du navigateur, ou écrivez-moi votre message.",
              time: new Date().toISOString(),
            },
          ]);
        }
      },
      onEnd: () => {
        setListening(false);
        setInterim('');
      },
    });
    if (handle) {
      recognizer.current = handle;
      setListening(true);
    } else {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: "La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilisez Chrome ou Edge, ou écrivez-moi votre message.",
          time: new Date().toISOString(),
        },
      ]);
    }
  };

  const stopSpeech = () => {
    stopSpeaking();
    setSpeaking(false);
  };

  const lastSuggestions = [...messages].reverse().find((m) => m.role === 'bot' && m.suggestions?.length)?.suggestions;

  return (
    <div className="space-y-4">
      <PageHero
        icon={Bot}
        title="Assistant IA Shield"
        subtitle="Solde, suivi de transactions, niveau de risque, frais & sécurité — par écrit ou en note vocale."
        actions={
          <button
            onClick={() => (voiceOn ? stopSpeech() : undefined, setVoiceOn(!voiceOn))}
            className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            title={voiceOn ? 'Couper la lecture vocale des réponses' : 'Activer la lecture vocale des réponses'}
          >
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {voiceOn ? 'Voix activée' : 'Voix coupée'}
          </button>
        }
      />

      <Card className="flex h-[calc(100vh-320px)] min-h-[480px] flex-col overflow-hidden">
        {/* ------------------------------------------------ messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] gap-2.5 sm:max-w-[75%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'bot' && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-sm bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                          : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm'
                      }`}
                    >
                      {m.voiceIn && (
                        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                          <Mic className="h-3 w-3" /> Note vocale
                        </span>
                      )}
                      <span className="whitespace-pre-line">{m.text}</span>
                      {m.role === 'bot' && m.engine === 'llm' && (
                        <span className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                          <Sparkles className="h-3 w-3" /> généré par IA
                        </span>
                      )}
                    </div>

                    {m.txs?.length > 0 && (
                      <div className="space-y-1.5">
                        {m.txs.map((tx) => (
                          <TxMiniCard key={tx.id} tx={tx} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Indicateur "en train d'écrire" */}
          {thinking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                {[0, 150, 300].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-slate-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: d / 1000 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Écoute en cours */}
          {listening && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white">
                <span className="absolute inset-0 animate-ping rounded-xl bg-rose-400 opacity-40" />
                <Mic className="relative h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {interim ? <em>« {interim}… »</em> : 'Je vous écoute… parlez puis cliquez à nouveau sur le micro.'}
              </div>
            </motion.div>
          )}
        </div>

        {/* ------------------------------------------------ suggestions */}
        {lastSuggestions && !thinking && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 pt-3 sm:px-6">
            {lastSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ------------------------------------------------ saisie */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-6"
        >
          <button
            type="button"
            onClick={toggleMic}
            disabled={!micSupported}
            title={micSupported ? 'Envoyer une note vocale' : 'Reconnaissance vocale non disponible sur ce navigateur'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : micSupported
                  ? 'border border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600'
                  : 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-300'
            }`}
          >
            {listening ? <Square className="h-4 w-4" fill="currentColor" /> : micSupported ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrivez votre message… ou cliquez sur le micro 🎤"
            className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          {speaking ? (
            <button
              type="button"
              onClick={stopSpeech}
              title="Arrêter la lecture vocale"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition hover:bg-slate-700"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
        <Cpu className="h-3 w-3" />
        Moteur conversationnel Shield — réponses basées sur vos données en temps réel.
        {ttsSupported ? '' : ' La lecture vocale est indisponible sur ce navigateur.'}
      </p>
    </div>
  );
}
