'use client';

import { motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Clock,
  CreditCard,
  Eye,
  Plus,
  Send,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatXAF } from '@/lib/format';
import { TX_TYPE_LABELS } from '@/lib/labels';
import { Button, Card, SkeletonRows, StatCard, TxStatusBadge } from '@/components/ui';
import { PageIn, LiveDot } from '@/components/motion';
import { useToast } from '@/components/toast';
import NewTransactionModal from '@/components/NewTransactionModal';
import TxRowIcon from '@/components/TxRowIcon';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/customer/dashboard'));
  const [txOpen, setTxOpen] = useState(false);

  const pendingVerifications = (data?.recentTransactions || []).filter((t: any) => t.status === 'PENDING');

  const confirm = async (tx: any, legitimate: boolean) => {
    try {
      const res = await api.post(`/customer/transactions/${tx.id}/confirm`, { legitimate });
      if (legitimate) push('Transaction confirmée et traitée avec succès.', 'success');
      else push('Transaction rejetée. Un litige a été créé pour investigation.', 'warning');
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      {/* Vérifications en attente */}
      {pendingVerifications.map((tx: any) => (
        <motion.div
          key={tx.id}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-amber-800">
                Un {TX_TYPE_LABELS[tx.type]?.toLowerCase()} de {formatXAF(tx.amount)} attend votre confirmation
              </p>
              <p className="mt-0.5 text-xs text-amber-700/80">
                Détecté comme inhabituel par le moteur de fraude (réf. {tx.reference}). Avez-vous initié cette opération ?
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="dark" onClick={() => confirm(tx, true)}>
                C’est moi, confirmer
              </Button>
              <Button variant="danger" onClick={() => confirm(tx, false)}>
                Je ne reconnais pas
              </Button>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Carte solde héro */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-navy-950 p-7 text-white shadow-xl lg:col-span-2"
        >
          <div className="bg-grid-dark absolute inset-0" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <LiveDot />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Solde total disponible</p>
              </div>
              <p className="mt-3 text-5xl font-black tracking-tight">
                {loading ? '…' : formatXAF(data?.balance ?? 0)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {data?.accounts?.length || 0} compte(s) · {data?.pendingCount || 0} opération(s) en cours
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button onClick={() => setTxOpen(true)}>
                <Plus className="h-4 w-4" /> Nouvelle transaction
              </Button>
              <Link href="/customer/transactions">
                <Button variant="glass">
                  <Eye className="h-4 w-4" /> Voir les transactions
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Comptes */}
        <Card className="p-5">
          <p className="text-[13px] font-bold text-slate-500">Mes comptes</p>
          <div className="mt-4 space-y-3">
            {!data && loading ? (
              <SkeletonRows n={2} />
            ) : (
              (data?.accounts || []).map((a: any, i: number) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-white">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-navy-900">{a.accountNumber}</p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {a.status === 'ACTIVE' ? 'Actif' : a.status === 'FROZEN' ? 'Gelé' : 'Fermé'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-navy-900">{formatXAF(a.balance)}</p>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ArrowDownToLine className="h-5 w-5" />} label="Dépôts (30 j)" value={data?.monthlyTotals?.deposits ?? 0} format={(n) => formatXAF(n)} delay={0.05} />
        <StatCard icon={<ArrowUpFromLine className="h-5 w-5" />} label="Retraits (30 j)" value={data?.monthlyTotals?.withdrawals ?? 0} format={(n) => formatXAF(n)} accent="text-rose-600 bg-rose-50" delay={0.1} />
        <StatCard icon={<Send className="h-5 w-5" />} label="Virements (30 j)" value={data?.monthlyTotals?.transfers ?? 0} format={(n) => formatXAF(n)} accent="text-sky-600 bg-sky-50" delay={0.15} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Opérations en cours" value={data?.pendingCount ?? 0} accent="text-amber-600 bg-amber-50" delay={0.2} />
      </div>

      {/* Transactions récentes + alertes */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="text-sm font-black text-navy-900">Transactions récentes</p>
            <Link href="/customer/transactions" className="text-xs font-bold text-brand-600 hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="p-3">
            {loading && !data ? (
              <SkeletonRows n={5} />
            ) : (
              (data?.recentTransactions || []).map((t: any, i: number) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                >
                  <TxRowIcon type={t.type} direction={t.sourceAccountId ? 'out' : 'in'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-navy-900">
                      {TX_TYPE_LABELS[t.type]}
                      {t.beneficiaryName ? ` · ${t.beneficiaryName}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(t.createdAt)} · {t.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13.5px] font-black ${t.sourceAccountId ? 'text-slate-700' : 'text-emerald-600'}`}>
                      {t.sourceAccountId ? '−' : '+'}
                      {formatXAF(t.amount)}
                    </p>
                    <TxStatusBadge status={t.status} />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Alertes de sécurité</p>
          <div className="mt-4 space-y-3">
            {(!data?.securityAlerts || data.securityAlerts.length === 0) && (
              <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                Aucune alerte récente. Votre compte est protégé. 🛡️
              </p>
            )}
            {(data?.securityAlerts || []).map((n: any, i: number) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="rounded-xl border border-rose-100 bg-rose-50/50 p-3"
              >
                <p className="text-xs font-black text-rose-700">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(n.createdAt)}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <NewTransactionModal open={txOpen} onClose={() => setTxOpen(false)} onDone={() => reload(true)} />
    </PageIn>
  );
}
