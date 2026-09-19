'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Check, CreditCard, Send, Smartphone, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Field, Modal, RiskBadge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { formatXAF } from '@/lib/format';
import { RISK_LABELS } from '@/lib/labels';

const TYPES = [
  { id: 'DEPOSIT', label: 'Dépôt', icon: ArrowDownToLine },
  { id: 'WITHDRAWAL', label: 'Retrait', icon: ArrowUpFromLine },
  { id: 'TRANSFER', label: 'Virement', icon: Send },
  { id: 'PAYMENT', label: 'Paiement', icon: CreditCard },
];

const PAYMENT_METHODS = [
  {
    id: 'ORANGE_MONEY',
    label: 'Orange Money',
    shortLabel: 'OM',
    iconClass: 'bg-orange-500 text-white',
    activeClass: 'border-orange-400 bg-orange-50 ring-2 ring-orange-100',
  },
  {
    id: 'MTN_MOMO',
    label: 'MTN MoMo',
    shortLabel: 'MTN',
    iconClass: 'bg-yellow-400 text-slate-950',
    activeClass: 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-100',
  },
];

export default function NewTransactionModal({
  open,
  onClose,
  onDone,
  initialType,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  initialType?: string;
}) {
  const { push } = useToast();
  const [type, setType] = useState('DEPOSIT');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ORANGE_MONEY');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [savedBeneficiaries, setSavedBeneficiaries] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      api.get('/customer/accounts').then((a) => {
        setAccounts(a);
        if (a.length) setAccountId((prev) => prev || a[0].id);
      });
      api.get('/customer/beneficiaries').then(setSavedBeneficiaries).catch(() => setSavedBeneficiaries([]));
      if (initialType) setType(initialType);
      setResult(null);
      setAmount('');
      setTarget('');
      setBeneficiary('');
      setPaymentMethod('ORANGE_MONEY');
      setPaymentPhone('');
      setDescription('');
    }
  }, [open, initialType]);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/customer/transactions', {
        type,
        accountId,
        amount: Number(amount),
        targetAccountNumber: type === 'TRANSFER' ? target : undefined,
        beneficiaryName: type === 'PAYMENT' ? beneficiary : undefined,
        paymentMethod: ['DEPOSIT', 'WITHDRAWAL', 'PAYMENT'].includes(type) ? paymentMethod : undefined,
        paymentPhone: ['DEPOSIT', 'WITHDRAWAL', 'PAYMENT'].includes(type) ? paymentPhone : undefined,
        description: description || undefined,
      });
      setResult(res);
      onDone();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resultMessage = (r: any) => {
    if (!r) return null;
    if (r.status === 'COMPLETED')
      return { icon: '✅', title: 'Transaction terminée', text: `Votre opération de ${formatXAF(r.amount)} a été autorisée et traitée immédiatement (risque ${RISK_LABELS[r.riskLevel]?.toLowerCase()}).` };
    if (r.status === 'PENDING')
      return { icon: '🔐', title: 'Vérification requise', text: 'Le moteur de fraude a détecté des caractéristiques inhabituelles. Confirmez cette opération depuis votre tableau de bord ou vos transactions.' };
    return { icon: '🛡️', title: 'Transaction mise en attente', text: 'Risque élevé détecté : la transaction est soumise à l’examen d’un employé de banque. Vous serez notifié.' };
  };

  const msg = resultMessage(result);

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle transaction">
      {result ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl">{msg?.icon}</div>
          <h4 className="mt-4 text-lg font-black text-navy-900">{msg?.title}</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{msg?.text}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <RiskBadge level={result.riskLevel} score={result.riskScore} />
            <span className="text-sm font-bold text-slate-600">{formatXAF(result.amount)}</span>
          </div>
          {result.analysis?.indicators?.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-left">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Indicateurs détectés</p>
              <ul className="mt-2 space-y-1">
                {result.analysis.indicators.map((i: any, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    {i.label} <span className="font-bold text-slate-400">+{i.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button className="mt-6 w-full" onClick={onClose}>
            Fermer
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => (
              <motion.button
                key={t.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                  type === t.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </motion.button>
            ))}
          </div>

          <Field label="Compte">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} — {formatXAF(a.balance)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Montant (XAF)">
            <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25 000" className="input" />
          </Field>

          {type === 'TRANSFER' && (
            <>
              {savedBeneficiaries.length > 0 && (
                <Field label="Bénéficiaire enregistré" hint="Sélectionnez un bénéficiaire pour pré-remplir le compte.">
                  <select
                    value={savedBeneficiaries.find((b) => b.accountNumber === target)?.id || ''}
                    onChange={(e) => {
                      const b = savedBeneficiaries.find((x) => x.id === e.target.value);
                      if (b) setTarget(b.accountNumber);
                    }}
                    className="input"
                  >
                    <option value="">— Choisir dans ma liste —</option>
                    {savedBeneficiaries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.accountNumber}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Compte bénéficiaire">
                <input required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="FG-10000106" className="input" />
              </Field>
            </>
          )}
          {['DEPOSIT', 'WITHDRAWAL', 'PAYMENT'].includes(type) && (
            <>
              {type === 'PAYMENT' && (
                <Field label="Bénéficiaire / commerçant">
                  <input required value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Supermarché Santa Lucia" className="input" />
                </Field>
              )}
              <Field label="Moyen de paiement">
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((method) => {
                    const selected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        aria-pressed={selected}
                        className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          selected
                            ? method.activeClass
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${method.iconClass}`}>
                          <span className="text-[11px] font-black">{method.shortLabel}</span>
                        </span>
                        <span>
                          <span className="block text-xs font-black text-navy-900">{method.label}</span>
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <Smartphone className="h-3 w-3" /> Mobile Money
                          </span>
                        </span>
                        {selected && (
                          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Numéro Mobile Money" hint="L'opération sera simulée dans cet environnement.">
                <input
                  required
                  type="tel"
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="+237 6 90 00 00 00"
                  className="input"
                />
              </Field>
            </>
          )}

          <Field label="Description (optionnel)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Référence de l'opération" className="input" />
          </Field>

          <Button type="submit" loading={loading} className="w-full py-3">
            Analyser et envoyer
          </Button>
          <p className="text-center text-[11px] text-slate-400">
            Chaque opération est analysée par le moteur de fraude avant traitement.
          </p>
        </form>
      )}
    </Modal>
  );
}
