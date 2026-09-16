'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, initials } from '@/lib/format';
import { Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function EmployeeClients() {
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi(() => api.get(`/employee/customers?q=${encodeURIComponent(q)}`), [q]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: 'Client123!', firstName: '', lastName: '', phone: '', city: '', initialDeposit: '' });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  const submit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/employee/customers', { ...form, initialDeposit: form.initialDeposit ? Number(form.initialDeposit) : undefined });
      push(`Client créé, compte ouvert.`, 'success');
      setOpen(false);
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageIn className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client (nom, e-mail, téléphone)…" className="input pl-9" />
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Créer un client
        </Button>
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={6} />
        ) : !data?.length ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Aucun client trouvé" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((c: any, i: number) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => router.push(`/employee/clients/${c.id}`)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-xs font-black text-white">
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.email} · {c.city || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500">{c.accountsCount} compte(s)</p>
                  <p className="text-[10px] text-slate-400">Client depuis {formatDate(c.createdAt)}</p>
                </div>
                {!c.isActive && <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 ring-1 ring-inset ring-rose-600/20">Désactivé</span>}
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Créer un client et ouvrir un compte">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom"><input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mot de passe initial"><input required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ville"><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Dépôt initial (XAF)"><input type="number" min={0} className="input" value={form.initialDeposit} onChange={(e) => setForm({ ...form, initialDeposit: e.target.value })} /></Field>
          </div>
          <Button type="submit" loading={saving} className="w-full">Créer le client</Button>
        </form>
      </Modal>
    </PageIn>
  );
}
