'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Snowflake, Sun, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, formatXAF } from '@/lib/format';
import { ACCOUNT_STATUS_LABELS, ACCOUNT_STATUS_STYLES } from '@/lib/labels';
import { Badge, Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';
import PageHero from '@/components/PageHero';

export default function EmployeeAccounts() {
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi(() => api.get(`/employee/accounts?q=${encodeURIComponent(q)}`), [q]);
  const { push } = useToast();
  const [limitsFor, setLimitsFor] = useState<any>(null);
  const [limits, setLimits] = useState({ dailyLimit: '', perTxLimit: '' });

  const openLimits = (a: any) => {
    setLimits({ dailyLimit: String(a.dailyLimit), perTxLimit: String(a.perTxLimit) });
    setLimitsFor(a);
  };

  const saveLimits = async (e: any) => {
    e.preventDefault();
    try {
      await api.patch(`/employee/accounts/${limitsFor.id}`, {
        dailyLimit: Number(limits.dailyLimit),
        perTxLimit: Number(limits.perTxLimit),
      });
      push('Limites du compte mises à jour.', 'success');
      setLimitsFor(null);
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    }
  };

  const toggle = async (a: any) => {
    try {
      if (a.status === 'FROZEN') {
        await api.post(`/employee/accounts/${a.id}/unfreeze`);
        push(`Compte ${a.accountNumber} dégelé.`, 'success');
      } else {
        await api.post(`/employee/accounts/${a.id}/freeze`, { reason: 'Gel décidé par l’employé (examen)' });
        push(`Compte ${a.accountNumber} gelé.`, 'warning');
      }
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      <PageHero
        icon={Wallet}
        title="Gestion des comptes"
        subtitle="Ouvrir, consulter, geler/dégeler et ajuster les limites des comptes clients."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par numéro de compte ou propriétaire…" className="input pl-9" />
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={6} />
        ) : !data?.length ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="Aucun compte trouvé" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((a: any, i: number) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-black text-navy-900">{a.accountNumber}</p>
                  <p className="text-[11px] text-slate-400">{a.customerName} · ouvert le {formatDate(a.openedAt)}</p>
                </div>
                <p className="text-[13.5px] font-black text-navy-900">{formatXAF(a.balance)}</p>
                <Badge className={ACCOUNT_STATUS_STYLES[a.status]}>{ACCOUNT_STATUS_LABELS[a.status]}</Badge>
                <Button variant="secondary" onClick={() => openLimits(a)}>
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Limites
                </Button>
                <Button variant="secondary" onClick={() => toggle(a)}>
                  {a.status === 'FROZEN' ? (<><Sun className="h-3.5 w-3.5" /> Dégeler</>) : (<><Snowflake className="h-3.5 w-3.5" /> Geler</>)}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!limitsFor} onClose={() => setLimitsFor(null)} title={`Limites — ${limitsFor?.accountNumber || ''}`}>
        <form onSubmit={saveLimits} className="space-y-4">
          <Field label="Limite par transaction (XAF)">
            <input type="number" min={1} required className="input" value={limits.perTxLimit} onChange={(e) => setLimits({ ...limits, perTxLimit: e.target.value })} />
          </Field>
          <Field label="Limite quotidienne (XAF)">
            <input type="number" min={1} required className="input" value={limits.dailyLimit} onChange={(e) => setLimits({ ...limits, dailyLimit: e.target.value })} />
          </Field>
          <Button type="submit" className="w-full">Enregistrer les limites</Button>
        </form>
      </Modal>
    </PageIn>
  );
}
