'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, initials } from '@/lib/format';
import { Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function AdminEmployees() {
  const { data, loading, reload } = useApi(() => api.get('/admin/employees'));
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const create = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/employees', form);
      push('Employé créé.', 'success');
      setOpen(false);
      setForm({});
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/employees/${edit.id}`, form);
      push('Employé mis à jour.', 'success');
      setEdit(null);
      setForm({});
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (emp: any) => {
    try {
      await api.patch(`/admin/employees/${emp.id}`, { isActive: !emp.isActive });
      push(emp.isActive ? 'Employé désactivé.' : 'Employé réactivé.', emp.isActive ? 'warning' : 'success');
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  const resetPassword = async (emp: any) => {
    try {
      await api.patch(`/admin/employees/${emp.id}`, { password: 'Nouveau123!' });
      push('Mot de passe réinitialisé : Nouveau123!', 'info');
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setForm({}); setOpen(true); }}>
          <UserPlus className="h-4 w-4" /> Créer un employé
        </Button>
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={4} />
        ) : !data?.length ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Aucun employé" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((emp: any, i: number) => (
              <motion.div key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">
                  {initials(emp.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-navy-900">
                    {emp.name}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${emp.role === 'ADMIN' ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20' : 'bg-sky-50 text-sky-700 ring-sky-600/20'}`}>
                      {emp.role === 'ADMIN' ? 'Admin' : 'Employé'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">{emp.email} · {emp.position} — {emp.department}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>Dernière connexion</p>
                  <p className="font-bold text-slate-500">{formatDateTime(emp.lastLoginAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${emp.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'}`}>
                  {emp.isActive ? 'Actif' : 'Désactivé'}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setForm({ ...emp }); setEdit(emp); }}>Modifier</Button>
                  <Button variant="secondary" onClick={() => resetPassword(emp)}>
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={emp.isActive ? 'danger' : 'primary'} onClick={() => toggleActive(emp)}>
                    {emp.isActive ? 'Désactiver' : 'Activer'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Créer un employé">
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom"><input required className="input" value={form.firstName || ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input required className="input" value={form.lastName || ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><input type="email" required className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Mot de passe initial"><input required minLength={8} className="input" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Poste"><input required className="input" value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Département"><input required className="input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          </div>
          <Button type="submit" loading={saving} className="w-full">Créer</Button>
        </form>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Modifier ${edit?.name || ''}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom"><input className="input" value={form.firstName || ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className="input" value={form.lastName || ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Poste"><input className="input" value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Département"><input className="input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          </div>
          <Field label="Rôle (permissions d'accès)" hint="ADMIN : configuration système, règles de fraude, audit. EMPLOYÉ : opérations et examen.">
            <select className="input" value={form.role || 'EMPLOYEE'} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="EMPLOYEE">Employé de banque</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </Field>
          <Button type="submit" loading={saving} className="w-full">Enregistrer</Button>
        </form>
      </Modal>
    </PageIn>
  );
}
