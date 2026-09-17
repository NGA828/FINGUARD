'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Scale } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_STYLES, TX_TYPE_LABELS } from '@/lib/labels';
import { Badge, Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function CustomerDisputes() {
  const { data, loading, reload } = useApi(() => api.get('/customer/disputes'));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ transactionId: '', reason: '', description: '' });
  const [txs, setTxs] = useState<any>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const { push } = useToast();

  const openModal = async () => {
    setOpen(true);
    if (!txs) setTxs(await api.get('/customer/transactions?limit=50'));
  };

  const submit = async (e: any) => {
    e.preventDefault();
    setLoadingSubmit(true);
    try {
      await api.post('/customer/disputes', form);
      push('Litige soumis. Un employé va l’examiner rapidement.', 'success');
      setOpen(false);
      setForm({ transactionId: '', reason: '', description: '' });
      reload();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <PageIn className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Signalez une transaction non autorisée ou incorrecte : notre équipe investigate chaque litige.
        </p>
        <Button onClick={openModal} className="shrink-0">
          <Flag className="h-4 w-4" /> Signaler une transaction
        </Button>
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={4} />
        ) : !data?.length ? (
          <EmptyState icon={<Scale className="h-6 w-6" />} title="Aucun litige" subtitle="Tout est en ordre. Signalez ici toute transaction suspecte." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((d: any, i: number) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">
                    {d.reference} — {d.reason}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {d.transaction ? `${TX_TYPE_LABELS[d.transaction.type]} de ${formatXAF(d.transaction.amount)} · ${formatDateTime(d.createdAt)}` : formatDateTime(d.createdAt)}
                  </p>
                </div>
                {d.resolution && <p className="max-w-xs text-xs text-slate-500">{d.resolution}</p>}
                <Badge className={DISPUTE_STATUS_STYLES[d.status]}>{DISPUTE_STATUS_LABELS[d.status]}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Signaler une transaction">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Transaction concernée">
            <select
              required
              value={form.transactionId}
              onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))}
              className="input"
            >
              <option value="">Sélectionner…</option>
              {(txs?.items || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.reference} · {TX_TYPE_LABELS[t.type]} · {formatXAF(t.amount)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motif">
            <input required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Transaction non autorisée" className="input" />
          </Field>
          <Field label="Description (optionnel)">
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="input" placeholder="Décrivez la situation…" />
          </Field>
          <Button type="submit" loading={loadingSubmit} className="w-full">
            Soumettre le litige
          </Button>
        </form>
      </Modal>
    </PageIn>
  );
}
