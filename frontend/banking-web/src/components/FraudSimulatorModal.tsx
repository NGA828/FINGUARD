'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Field, Modal, RiskBadge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { formatXAF } from '@/lib/format';
import { TX_TYPE_LABELS } from '@/lib/labels';

const TYPES = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT'];

const ACTION_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  AUTHORIZE: { label: 'Autorisation immédiate', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck },
  VERIFY: { label: 'Vérification client requise', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: ShieldQuestion },
  HOLD: { label: 'Blocage + examen employé', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert },
};

/**
 * Simulateur de fraude (espace employé) : évalue le score de risque d'une
 * opération fictive — aucun mouvement de fonds, aucune écriture en base.
 */
export default function FraudSimulatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('TRANSFER');
  const [amount, setAmount] = useState('2500000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      api.get('/employee/accounts').then((a) => {
        setAccounts(a);
        if (a.length) setAccountId((prev) => prev || a[0].id);
      });
    }
  }, [open]);

  const run = async (e: any) => {
    e.preventDefault();
    if (!accountId) {
      push('Sélectionnez un compte à analyser.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/employee/transactions/simulate', {
        accountId,
        type,
        amount: Number(amount),
      });
      setResult(res);
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const analysis = result?.analysis;
  const decision = analysis ? ACTION_LABELS[analysis.action] : null;

  return (
    <Modal open={open} onClose={onClose} title="Simulateur de fraude" wide>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Paramètres */}
        <form onSubmit={run} className="space-y-4">
          <p className="rounded-xl bg-sky-50 p-3 text-[11.5px] leading-relaxed text-sky-700">
            Évaluez le score de risque d'une opération <span className="font-black">fictive</span> : aucun mouvement de
            fonds n'est effectué et rien n'est enregistré.
          </p>
          <Field label="Compte analysé">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} · {a.customerName || ''} · {formatXAF(a.balance)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type d'opération">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TX_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Montant (XAF)">
            <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
          </Field>
          <Button type="submit" loading={loading} className="w-full py-3">
            <FlaskConical className="h-4 w-4" /> Lancer l'analyse
          </Button>
        </form>

        {/* Résultat */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          {!result ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <FlaskConical className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-semibold text-slate-400">
                {loading ? 'Analyse en cours…' : 'Le verdict du moteur de fraude s’affichera ici.'}
              </p>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Score de risque</p>
                  <p className="text-3xl font-black text-navy-900">{analysis.riskScore}<span className="text-sm font-bold text-slate-400"> / 100</span></p>
                </div>
                <RiskBadge level={analysis.riskLevel} score={analysis.riskScore} />
              </div>

              {/* Jauge */}
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${analysis.riskScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    analysis.riskLevel === 'HIGH'
                      ? 'bg-gradient-to-r from-rose-500 to-red-600'
                      : analysis.riskLevel === 'MEDIUM'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                        : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                  }`}
                />
              </div>

              {decision && (
                <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${decision.cls}`}>
                  <decision.icon className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-black">{decision.label}</p>
                    <p className="text-[10.5px] opacity-80">Décision automatique du moteur pour cette opération.</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicateurs détectés</p>
                {analysis.indicators?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {analysis.indicators.map((i: any, idx: number) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.08 }}
                        className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs shadow-sm"
                      >
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="flex-1 text-slate-600">
                          <span className="font-bold text-navy-900">{i.label}</span>
                          {i.detail ? <span className="text-slate-400"> — {i.detail}</span> : null}
                        </span>
                        <span className="font-black text-slate-500">+{i.points}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                    Aucun indicateur de risque : opération conforme au profil habituel du compte.
                  </p>
                )}
              </div>

              <p className="border-t border-slate-200 pt-3 text-[11px] italic leading-relaxed text-slate-500">{analysis.summary}</p>
            </motion.div>
          )}
        </div>
      </div>
    </Modal>
  );
}
