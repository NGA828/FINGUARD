'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { TX_STATUS_LABELS, TX_TYPE_LABELS } from '@/lib/labels';
import { Card, EmptyState, RiskBadge, SkeletonRows, TxStatusBadge } from '@/components/ui';
import { PageIn } from '@/components/motion';
import ReviewModal from '@/components/ReviewModal';
import TxRowIcon from '@/components/TxRowIcon';

export default function EmployeeTransactions() {
  const [filters, setFilters] = useState({ type: '', status: '', q: '' });
  const { data, loading, reload } = useApi(
    () => api.get(`/employee/transactions?type=${filters.type}&status=${filters.status}&q=${encodeURIComponent(filters.q)}&limit=80`),
    [filters],
  );
  const [txId, setTxId] = useState<string | null>(null);

  return (
    <PageIn className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Référence, bénéficiaire…" className="input pl-9" />
          </div>
          <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="input">
            <option value="">Tous les types</option>
            {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="input">
            <option value="">Tous les statuts</option>
            {Object.entries(TX_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </div>
      </Card>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={8} />
        ) : !data?.items?.length ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="Aucune transaction" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((t: any, i: number) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                onClick={() => setTxId(t.id)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50"
              >
                <TxRowIcon type={t.type} direction={t.sourceAccountId ? 'out' : 'in'} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-navy-900">
                    {TX_TYPE_LABELS[t.type]} · {t.reference}
                    {t.beneficiaryName ? ` · ${t.beneficiaryName}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(t.createdAt)}</p>
                </div>
                <RiskBadge level={t.riskLevel} score={t.riskScore} />
                <TxStatusBadge status={t.status} />
                <p className="w-28 text-right text-[13px] font-black text-slate-700">{formatXAF(t.amount)}</p>
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <ReviewModal txId={txId} open={!!txId} onClose={() => setTxId(null)} onDone={() => reload(true)} />
    </PageIn>
  );
}
