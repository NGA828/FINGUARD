'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, StickyNote } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_STYLES, TX_TYPE_LABELS } from '@/lib/labels';
import { Badge, Button, Card, EmptyState, Field, Modal, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function EmployeeDisputes() {
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useApi(() => api.get(`/employee/disputes?status=${status}`), [status]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState('');
  const { push } = useToast();

  const open = async (id: string) => {
    setDetail(await api.get(`/employee/disputes/${id}`));
    setOpenId(id);
  };

  const act = async (kind: 'status' | 'note' | 'resolve' | 'reject', body?: any) => {
    if (!openId) return;
    try {
      if (kind === 'status') await api.post(`/employee/disputes/${openId}/status`, body);
      if (kind === 'note') {
        await api.post(`/employee/disputes/${openId}/notes`, { content: note });
        setNote('');
      }
      if (kind === 'resolve') await api.post(`/employee/disputes/${openId}/resolve`, body);
      push('Litige mis à jour.', 'success');
      setDetail(await api.get(`/employee/disputes/${openId}`));
      reload(true);
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      <div className="flex items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input max-w-64">
          <option value="">Tous les statuts</option>
          {Object.entries(DISPUTE_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={5} />
        ) : !data?.length ? (
          <EmptyState icon={<Scale className="h-6 w-6" />} title="Aucun litige" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((d: any, i: number) => (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                onClick={() => open(d.id)}
                className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">{d.reference} — {d.reason}</p>
                  <p className="text-[11px] text-slate-400">
                    {d.customerName} · {d.transaction ? `${TX_TYPE_LABELS[d.transaction.type]} de ${formatXAF(d.transaction.amount)}` : ''} · {formatDateTime(d.createdAt)}
                  </p>
                </div>
                <Badge className={DISPUTE_STATUS_STYLES[d.status]}>{DISPUTE_STATUS_LABELS[d.status]}</Badge>
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!openId} onClose={() => setOpenId(null)} title={`Litige ${detail?.reference || ''}`} wide>
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-black text-navy-900">{detail.reason}</p>
                <p className="mt-0.5 text-xs text-slate-500">{detail.description}</p>
              </div>
              <Badge className={DISPUTE_STATUS_STYLES[detail.status]}>{DISPUTE_STATUS_LABELS[detail.status]}</Badge>
            </div>

            {detail.transaction && (
              <div className="rounded-xl border border-slate-200 p-4 text-xs">
                <p className="font-black text-navy-900">
                  {TX_TYPE_LABELS[detail.transaction.type]} de {formatXAF(detail.transaction.amount)} — {detail.transaction.reference}
                </p>
                <p className="mt-1 text-slate-500">{formatDateTime(detail.transaction.createdAt)} · Statut : {detail.transaction.status}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Notes d'investigation</p>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {detail.notes?.map((n: any) => (
                  <div key={n.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                    <p className="font-bold text-slate-600">{n.author} · {formatDateTime(n.createdAt)}</p>
                    <p className="mt-1 leading-relaxed text-slate-500">{n.content}</p>
                  </div>
                ))}
                {!detail.notes?.length && <p className="text-xs text-slate-400">Aucune note pour le moment.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note d'investigation…" className="input" />
                <Button variant="secondary" onClick={() => act('note')}>
                  <StickyNote className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select className="input" defaultValue={detail.status} onChange={(e) => act('status', { status: e.target.value })}>
                {Object.entries(DISPUTE_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => act('resolve', { resolution: 'Litige fondé : remboursement / correction effectuée.' })}>Résoudre</Button>
                <Button variant="danger" className="flex-1" onClick={() => act('reject', { resolution: 'Litige non fondé après investigation.', reject: true })}>Rejeter</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageIn>
  );
}
