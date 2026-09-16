'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const { data, loading } = useApi(() => api.get(`/admin/audit?q=${encodeURIComponent(q)}&entity=${entity}&limit=120`), [q, entity]);

  const entities = ['USER', 'TRANSACTION', 'ACCOUNT', 'DISPUTE', 'FRAUD_ALERT', 'SYSTEM_CONFIG', 'EMPLOYEE', 'CUSTOMER'];

  return (
    <PageIn className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans l'audit…" className="input pl-9" />
          </div>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input">
            <option value="">Toutes les entités</option>
            {entities.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </div>
      </Card>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={8} />
        ) : !data?.length ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="Aucune entrée d'audit" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((l: any, i: number) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="w-40 shrink-0">
                  <p className="text-[11px] font-black text-slate-400">{formatDateTime(l.createdAt)}</p>
                </div>
                <span className="rounded-md bg-navy-900 px-2 py-0.5 text-[10px] font-black tracking-wide text-white">{l.action}</span>
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{l.description}</p>
                <p className="text-[11px] text-slate-400">{l.user ? `${l.user.name} (${l.user.role})` : 'Système'}</p>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </PageIn>
  );
}
