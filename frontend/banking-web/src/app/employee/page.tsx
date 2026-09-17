'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, FlaskConical, Scale, ShieldAlert, Users, Wallet, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { ALERT_STATUS_STYLES, ALERT_STATUS_LABELS, TX_TYPE_LABELS } from '@/lib/labels';
import { Badge, Button, Card, SkeletonRows, StatCard, TxStatusBadge } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { VolumeAreaChart } from '@/components/charts';
import TxRowIcon from '@/components/TxRowIcon';
import FraudSimulatorModal from '@/components/FraudSimulatorModal';

export default function EmployeeDashboard() {
  const { data, loading } = useApi(() => api.get('/employee/dashboard'));
  const [simOpen, setSimOpen] = useState(false);

  return (
    <PageIn className="space-y-6">
      {/* Simulateur de fraude */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-brand-900 p-6 text-white shadow-xl"
      >
        <div className="bg-grid-dark absolute inset-0" />
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <FlaskConical className="h-6 w-6 text-brand-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black">Simulateur de fraude</p>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-300">
              Testez le moteur de détection sur une opération fictive : score de risque, indicateurs déclenchés et
              décision automatique — sans aucun mouvement de fonds.
            </p>
          </div>
          <Button variant="glass" onClick={() => setSimOpen(true)}>
            <FlaskConical className="h-4 w-4" /> Lancer une simulation
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total clients" value={data?.stats?.totalCustomers ?? 0} delay={0} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Comptes actifs" value={data?.stats?.activeAccounts ?? 0} accent="text-sky-600 bg-sky-50" delay={0.05} />
        <StatCard icon={<ArrowLeftRight className="h-5 w-5" />} label="Transactions aujourd'hui" value={data?.stats?.txTodayCount ?? 0} sub={data ? formatXAF(data.stats.txTodayVolume) : ''} accent="text-violet-600 bg-violet-50" delay={0.1} />
        <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Cas suspects ouverts" value={data?.stats?.suspicious ?? 0} accent="text-rose-600 bg-rose-50" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-navy-900">Volume des 7 derniers jours</p>
            <Badge className="bg-brand-50 text-brand-700 ring-brand-600/20">
              <Activity className="h-3 w-3" /> Temps réel
            </Badge>
          </div>
          <div className="mt-4">
            {data ? <VolumeAreaChart data={data.dailyStats} /> : <div className="skeleton h-[260px]" />}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Alertes récentes</p>
          <div className="mt-4 space-y-3">
            {!data && loading ? (
              <SkeletonRows n={3} />
            ) : (
              (data?.recentAlerts || []).map((a: any, i: number) => (
                <Link key={a.id} href="/employee/suspicieuses">
                  <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-xl border border-slate-200 p-3 transition hover:border-rose-200 hover:bg-rose-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-navy-900">{formatXAF(a.txAmount)}</p>
                      <Badge className={ALERT_STATUS_STYLES[a.status]}>{ALERT_STATUS_LABELS[a.status]}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {a.customerName || 'Client'} · {TX_TYPE_LABELS[a.txType]} · score {a.riskScore}
                    </p>
                  </motion.div>
                </Link>
              ))
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xl font-black text-amber-600">{data?.stats?.pendingReview ?? '–'}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">À examiner</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xl font-black text-violet-600">{data?.stats?.openDisputes ?? '–'}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Litiges ouverts</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-sm font-black text-navy-900">Dernières transactions</p>
          <Link href="/employee/transactions" className="text-xs font-bold text-brand-600 hover:underline">
            Toutes les transactions →
          </Link>
        </div>
        <div className="p-3">
          {loading && !data ? (
            <SkeletonRows n={5} />
          ) : (
            (data?.recentTransactions || []).map((t: any, i: number) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-50"
              >
                <TxRowIcon type={t.type} direction={t.sourceAccountId ? 'out' : 'in'} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-navy-900">
                    {t.customerName || '—'} · {TX_TYPE_LABELS[t.type]}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(t.createdAt)} · {t.reference}</p>
                </div>
                <div className="hidden sm:block">
                  <TxStatusBadge status={t.status} />
                </div>
                <p className="w-24 text-right text-[13px] font-black text-slate-700 sm:w-28">{formatXAF(t.amount)}</p>
              </motion.div>
            ))
          )}
        </div>
      </Card>

      <FraudSimulatorModal open={simOpen} onClose={() => setSimOpen(false)} />
    </PageIn>
  );
}
