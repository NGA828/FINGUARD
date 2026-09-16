'use client';

import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Card, Skeleton } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { StatusPieChart, TypeBarChart, VolumeAreaChart } from '@/components/charts';
import { formatXAF } from '@/lib/format';

export default function AdminReports() {
  const { data, loading } = useApi(() => api.get('/admin/reports/summary?days=30'));

  return (
    <PageIn className="space-y-6">
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
    </PageIn>
  );
}
