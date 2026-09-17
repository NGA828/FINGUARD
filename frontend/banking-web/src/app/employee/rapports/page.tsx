'use client';

import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Card, Skeleton } from '@/components/ui';
import PageHero from '@/components/PageHero';
import { PageIn } from '@/components/motion';
import { StatusPieChart, TypeBarChart, VolumeAreaChart } from '@/components/charts';

export default function EmployeeReports() {
  const { data, loading } = useApi(() => api.get('/employee/reports/daily?days=14'));

  return (
    <PageIn className="space-y-6">
      <PageHero
        icon={BarChart3}
        title="Rapports opérationnels"
        subtitle="Volume de transactions, signalements de fraude et répartition par type et statut."
        accent="from-sky-500 to-cyan-700"
      />
      <Card className="p-5">
        <p className="text-sm font-black text-navy-900">Volume & signalements (14 jours)</p>
        <div className="mt-4">{data ? <VolumeAreaChart data={data.days} /> : <Skeleton className="h-[260px]" />}</div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Transactions par type</p>
          <div className="mt-4">{data ? <TypeBarChart data={data.typeDistribution} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Répartition par statut</p>
          <div className="mt-4">{data ? <StatusPieChart data={data.statusDistribution} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
      </div>
    </PageIn>
  );
}
