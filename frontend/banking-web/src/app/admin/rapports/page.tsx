'use client';

import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Card, Skeleton } from '@/components/ui';
import { PageIn } from '@/components/motion';
import PageHero from '@/components/PageHero';
import { StatusPieChart, TypeBarChart, VolumeAreaChart } from '@/components/charts';
import { formatXAF } from '@/lib/format';

export default function AdminReports() {
  const { data, loading } = useApi(() => api.get('/admin/reports/summary?days=30'));
  const employees = useApi(() => api.get('/admin/employees'));

  return (
    <PageIn className="space-y-6">
      <PageHero
        icon={BarChart3}
        title="Rapports système"
        subtitle="Statistiques globales : volumes, types, statuts et activité sur 30 jours."
        accent="from-sky-500 to-cyan-700"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-slate-500">Volume traité (30 j)</p>
          <p className="mt-2 text-2xl font-black text-navy-900">{data ? formatXAF(data.overview.totals.volume30d) : '…'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-slate-500">Transactions totales</p>
          <p className="mt-2 text-2xl font-black text-navy-900">{data?.overview?.totals?.transactions ?? '…'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-slate-500">Événements d'audit (7 j)</p>
          <p className="mt-2 text-2xl font-black text-navy-900">{data?.overview?.auditEventsLast7d ?? '…'}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-black text-navy-900">Volume quotidien (30 jours)</p>
        <div className="mt-4">{data ? <VolumeAreaChart data={data.daily} /> : <Skeleton className="h-[260px]" />}</div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Par type de transaction</p>
          <div className="mt-4">{data ? <TypeBarChart data={data.typeDistribution} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Par statut</p>
          <div className="mt-4">{data ? <StatusPieChart data={data.statusDistribution} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
      </div>

      <Card>
        <p className="px-5 pt-5 text-sm font-black text-navy-900">Rapport des employés</p>
        <div className="divide-y divide-slate-100 p-3">
          {(employees.data || []).map((e: any, i: number) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-navy-900">{e.name}</p>
                <p className="text-[11px] text-slate-400">{e.position} — {e.department}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ring-1 ring-inset ${e.role === 'ADMIN' ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20' : 'bg-sky-50 text-sky-700 ring-sky-600/20'}`}>
                {e.role === 'ADMIN' ? 'Admin' : 'Employé'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${e.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'}`}>
                {e.isActive ? 'Actif' : 'Désactivé'}
              </span>
            </motion.div>
          ))}
        </div>
      </Card>
    </PageIn>
  );
}
