'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeftRight, CreditCard, FileWarning, ScrollText, ShieldAlert, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { Badge, Card, Skeleton, StatCard } from '@/components/ui';
import { PageIn, LiveDot } from '@/components/motion';
import { RiskDonut, VolumeAreaChart } from '@/components/charts';
import { RISK_COLORS } from '@/lib/labels';

export default function AdminDashboard() {
  const { data, loading } = useApi(() => api.get('/admin/dashboard'));

  return (
    <PageIn className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Clients" value={data?.totals?.customers ?? 0} delay={0} />
        <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Employés" value={data?.totals?.employees ?? 0} accent="text-sky-600 bg-sky-50" delay={0.05} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Comptes" value={data?.totals?.accounts ?? 0} sub={data ? `${data.totals.frozenAccounts} gelé(s)` : ''} accent="text-violet-600 bg-violet-50" delay={0.1} />
        <StatCard icon={<ArrowLeftRight className="h-5 w-5" />} label="Volume traité (30 j)" value={data?.totals?.volume30d ?? 0} format={(n) => formatXAF(n)} accent="text-emerald-600 bg-emerald-50" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-navy-900">Activité & signalements (14 jours)</p>
            <Badge className="bg-brand-50 text-brand-700 ring-brand-600/20">
              <LiveDot /> Système actif
            </Badge>
          </div>
          <div className="mt-4">{data ? <VolumeAreaChart data={data.dailyStats} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Répartition du risque</p>
          <div className="mt-2">{data ? <RiskDonut data={data.fraud?.byLevel ?? { LOW: 0, MEDIUM: 0, HIGH: 0 }} /> : <Skeleton className="h-[220px]" />}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((l) => (
              <div key={l} className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-lg font-black" style={{ color: RISK_COLORS[l] }}>
                  {data?.fraud?.byLevel?.[l] ?? 0}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-400">{l === 'LOW' ? 'Faible' : l === 'MEDIUM' ? 'Moyen' : 'Élevé'}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-xl font-black text-rose-600">{data?.pendingReviews ?? 0}</p>
              <p className="text-[10px] font-bold uppercase text-rose-500">Révisions ouvertes</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xl font-black text-violet-600">{data?.disputes?.open ?? 0}</p>
              <p className="text-[10px] font-bold uppercase text-violet-500">Litiges ouverts</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-navy-900">Événements de sécurité (7 j)</p>
            <Link href="/admin/audit" className="text-xs font-bold text-brand-600 hover:underline">Audit complet →</Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {(data?.securityEvents || []).map((e: any, i: number) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                <ScrollText className="h-4 w-4 shrink-0 text-slate-400" />
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{e.description || e.action}</p>
                <p className="shrink-0 text-[10px] text-slate-400">{formatDateTime(e.createdAt)}</p>
              </motion.div>
            ))}
            {!data?.securityEvents?.length && <p className="text-xs text-slate-400">Aucun événement récent.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Top clients (volume 30 j)</p>
          <div className="mt-4 space-y-2.5">
            {(data?.topCustomers || []).map((c: any, i: number) => (
              <motion.div key={c.email} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-[10px] font-black text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-navy-900">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.txCount} transactions</p>
                </div>
                <p className="text-xs font-black text-slate-700">{formatXAF(c.volume)}</p>
              </motion.div>
            ))}
            {!data?.topCustomers?.length && <p className="text-xs text-slate-400">Pas encore d'activité.</p>}
          </div>
        </Card>
      </div>
    </PageIn>
  );
}
