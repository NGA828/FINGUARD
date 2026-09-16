'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, Search, Users } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, initials } from '@/lib/format';
import { Button, Card, EmptyState, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function AdminClients() {
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi(() => api.get(`/admin/customers?q=${encodeURIComponent(q)}`), [q]);
  const { push } = useToast();

  const toggle = async (c: any) => {
    try {
      const res = await api.post(`/admin/customers/${c.id}/toggle-active`);
      push(res.isActive ? 'Client réactivé.' : 'Client désactivé.', res.isActive ? 'success' : 'warning');
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      <PageHero
        icon={Users}
        title="Supervision des clients"
        subtitle="Vue d'ensemble des clients du système, statut et contrôle d'accès."
        accent="from-violet-500 to-fuchsia-700"
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="input pl-9" />
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={6} />
        ) : !data?.length ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Aucun client" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((c: any, i: number) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-xs font-black text-white">{initials(c.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.email} · {c.city || '—'} · depuis {formatDate(c.createdAt)}</p>
                </div>
                <p className="text-xs font-bold text-slate-500">{c.accountsCount} compte(s)</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${c.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'}`}>
                  {c.isActive ? 'Actif' : 'Désactivé'}
                </span>
                <Button variant={c.isActive ? 'danger' : 'primary'} onClick={() => toggle(c)}>
                  <Power className="h-3.5 w-3.5" /> {c.isActive ? 'Désactiver' : 'Activer'}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </PageIn>
  );
}
