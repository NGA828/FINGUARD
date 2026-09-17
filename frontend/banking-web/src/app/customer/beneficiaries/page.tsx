'use client';

import { motion } from 'framer-motion';
import { HeartHandshake, Plus, Send, Trash2, Landmark, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, initials } from '@/lib/format';
import { Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function BeneficiariesPage() {
  const { push } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/customer/beneficiaries'));
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [form, setForm] = useState({ name: '', accountNumber: '', bankLabel: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const list: any[] = Array.isArray(data) ? data : [];

  const submit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customer/beneficiaries', {
        name: form.name.trim(),
        accountNumber: form.accountNumber.trim().toUpperCase(),
        bankLabel: form.bankLabel.trim() || undefined,
      });
      push('Bénéficiaire ajouté avec succès.', 'success');
      setOpen(false);
      setForm({ name: '', accountNumber: '', bankLabel: '' });
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/customer/beneficiaries/${confirmDelete.id}`);
      push(`« ${confirmDelete.name} » a été retiré de vos bénéficiaires.`, 'success');
      setConfirmDelete(null);
      reload();
    } catch (err: any) {
      push(err.message || 'La suppression a échoué.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageIn className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-navy-900">Mes bénéficiaires</h2>
            <p className="text-xs text-slate-400">
              {list.length} bénéficiaire(s) enregistré(s) — vos virements sont plus rapides et plus sûrs.
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ajouter un bénéficiaire
        </Button>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-xs leading-relaxed text-emerald-800">
          Enregistrer un bénéficiaire ne déclenche aucun mouvement de fonds. Lors d’un virement, vous pourrez le
          sélectionner directement pour éviter toute erreur de saisie du numéro de compte.
        </p>
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={3} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="h-7 w-7" />}
            title="Aucun bénéficiaire enregistré"
            subtitle="Ajoutez les comptes vers lesquels vous effectuez régulièrement des virements."
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((b: any, i: number) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="card card-hover group relative flex flex-col gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-xs font-black text-white">
                    {initials(b.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-black text-navy-900">{b.name}</p>
                    <p className="truncate text-[11px] font-semibold text-slate-400">{b.accountNumber}</p>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(b)}
                    className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                    title="Retirer ce bénéficiaire"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Landmark className="h-3.5 w-3.5" />
                    {b.bankLabel || 'Shield Bank'}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    Ajouté le {formatDateTime(b.createdAt)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Modale d'ajout */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau bénéficiaire">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom complet">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex. : Amina Ndong"
              className="input"
            />
          </Field>
          <Field label="Numéro de compte (format FG-XXXXXXXX)" hint="Le compte doit exister chez Shield pour recevoir un virement.">
            <input
              required
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value.toUpperCase() })}
              placeholder="FG-10000102"
              className="input font-mono"
            />
          </Field>
          <Field label="Banque / libellé (optionnel)">
            <input
              value={form.bankLabel}
              onChange={(e) => setForm({ ...form, bankLabel: e.target.value })}
              placeholder="Shield Bank"
              className="input"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Plus className="h-4 w-4" /> Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Retirer ce bénéficiaire ?">
        <p className="text-sm leading-relaxed text-slate-500">
          Vous êtes sur le point de retirer <span className="font-bold text-navy-900">{confirmDelete?.name}</span>{' '}
          ({confirmDelete?.accountNumber}) de votre liste. Cette action n’annule aucune transaction passée.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
            Annuler
          </Button>
          <Button variant="danger" loading={deleting} className="flex-1" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Retirer
          </Button>
        </div>
      </Modal>
    </PageIn>
  );
}
