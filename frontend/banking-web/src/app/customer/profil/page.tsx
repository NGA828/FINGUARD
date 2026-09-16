'use client';

import { useState } from 'react';
import { KeyRound, UserRound, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, formatXAF, initials } from '@/lib/format';
import { Button, Card, Field } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth';

export default function CustomerProfile() {
  const { user, refresh } = useAuth();
  const { data, reload } = useApi(() => api.get('/customer/profile'));
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const f = form ?? data ?? {};

  const saveProfile = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/customer/profile', {
        firstName: f.firstName,
        lastName: f.lastName,
        phone: f.phone,
        address: f.address,
        city: f.city,
      });
      push('Profil mis à jour.', 'success');
      await refresh();
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePwd = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/change-password', pwd);
      push('Mot de passe modifié.', 'success');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageIn className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 text-2xl font-black text-white shadow-lg">
          {initials(`${data?.user?.firstName ?? ''} ${data?.user?.lastName ?? ''}`)}
        </div>
        <p className="mt-4 text-lg font-black text-navy-900">
          {data?.user?.firstName} {data?.user?.lastName}
        </p>
        <p className="text-xs text-slate-400">{data?.user?.email}</p>
        <div className="mt-5 space-y-2 text-left text-xs">
          <p className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-500">Client depuis</span>
            <span className="font-bold text-navy-900">{formatDate(data?.createdAt)}</span>
          </p>
          {(data?.accounts || []).map((a: any) => (
            <p key={a.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-semibold text-slate-500">{a.accountNumber}</span>
              <span className="font-bold text-navy-900">{formatXAF(a.balance)}</span>
            </p>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm font-black text-navy-900">
          <UserRound className="h-4 w-4 text-brand-600" /> Informations personnelles
        </p>
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom">
              <input className="input" value={f.firstName || ''} onChange={(e) => setForm({ ...f, firstName: e.target.value })} />
            </Field>
            <Field label="Nom">
              <input className="input" value={f.lastName || ''} onChange={(e) => setForm({ ...f, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Téléphone">
            <input className="input" value={f.phone || ''} onChange={(e) => setForm({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <input className="input" value={f.address || ''} onChange={(e) => setForm({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Ville">
            <input className="input" value={f.city || ''} onChange={(e) => setForm({ ...f, city: e.target.value })} />
          </Field>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </form>
      </Card>

      <Card className="h-fit p-6">
        <p className="flex items-center gap-2 text-sm font-black text-navy-900">
          <KeyRound className="h-4 w-4 text-brand-600" /> Sécurité
        </p>
        <form onSubmit={savePwd} className="mt-5 space-y-4">
          <Field label="Mot de passe actuel">
            <input type="password" required className="input" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
          </Field>
          <Field label="Nouveau mot de passe">
            <input type="password" required minLength={8} className="input" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
          </Field>
          <Button type="submit" loading={saving} variant="dark" className="w-full">
            Changer le mot de passe
          </Button>
        </form>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          <p className="font-bold text-slate-600">Limites de vos comptes</p>
          <p className="mt-1">Les informations bancaires sensibles (limites, statut) sont gérées par votre banque. Contactez un employé pour toute modification.</p>
        </div>
      </Card>
    </PageIn>
  );
}
