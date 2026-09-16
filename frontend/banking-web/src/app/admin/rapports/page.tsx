'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileDown, ScrollText } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button, Card, Skeleton } from '@/components/ui';
import { PageIn } from '@/components/motion';
import PageHero from '@/components/PageHero';
import { StatusPieChart, TypeBarChart, VolumeAreaChart } from '@/components/charts';
import { formatXAF } from '@/lib/format';
import { TX_STATUS_LABELS, TX_TYPE_LABELS } from '@/lib/labels';
import { useToast } from '@/components/toast';

export default function AdminReports() {
  const { data, loading } = useApi(() => api.get('/admin/reports/summary?days=30'));
  const employees = useApi(() => api.get('/admin/employees'));
  const { push } = useToast();
  const [exportStatus, setExportStatus] = useState('');
  const [exportType, setExportType] = useState('');
  const [exporting, setExporting] = useState<'tx' | 'audit' | null>(null);

  const exportCsv = async (kind: 'tx' | 'audit') => {
    setExporting(kind);
    try {
      if (kind === 'tx') {
        const qs = new URLSearchParams();
        if (exportStatus) qs.set('status', exportStatus);
        if (exportType) qs.set('type', exportType);
        const suffix = qs.toString() ? `?${qs}` : '';
        await downloadFile(`/admin/reports/transactions.csv${suffix}`, 'transactions-finguard.csv');
      } else {
        await downloadFile('/admin/reports/audit.csv', 'audit-finguard.csv');
      }
      push('Export CSV téléchargé avec succès.', 'success');
    } catch (e: any) {
      push(e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

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

      {/* Exports CSV */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-black text-navy-900">
              <FileDown className="h-4 w-4 text-brand-600" /> Exports CSV
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Téléchargez les données brutes pour Excel : toutes les transactions du système ou le journal d'audit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} className="input w-auto py-2 text-xs">
              <option value="">Tous les statuts</option>
              {Object.entries(TX_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="input w-auto py-2 text-xs">
              <option value="">Tous les types</option>
              {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button loading={exporting === 'tx'} onClick={() => exportCsv('tx')} className="px-3 py-2 text-xs">
              <FileDown className="h-3.5 w-3.5" /> Transactions
            </Button>
            <Button variant="secondary" loading={exporting === 'audit'} onClick={() => exportCsv('audit')} className="px-3 py-2 text-xs">
              <ScrollText className="h-3.5 w-3.5" /> Journal d'audit
            </Button>
          </div>
        </div>
      </Card>

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
