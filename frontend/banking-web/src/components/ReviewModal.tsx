'use client';

import { useState } from 'react';
import { CheckCircle2, PauseCircle, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Modal, RiskBadge, TxStatusBadge, Field } from '@/components/ui';
import { formatDateTime, formatXAF } from '@/lib/format';
import { RISK_LABELS, TX_TYPE_LABELS } from '@/lib/labels';
import { useToast } from '@/components/toast';

/**
 * Modale d'examen d'une transaction par un employé :
 * analyse de fraude, indicateurs, approbation / rejet / maintien.
 */
export default function ReviewModal({ txId, open, onClose, onDone, allowReview = true }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { push } = useToast();

  const load = async () => {
    if (!txId) return;
    setDetail(await api.get(`/employee/transactions/${txId}`));
  };

  // Chargement à l'ouverture
  if (open && txId && !detail) load();

  const act = async (action: 'approve' | 'reject' | 'hold') => {
    setBusy(action);
    try {
      await api.post(`/employee/transactions/${txId}/${action}`, {
        notes: note || undefined,
        reason: action === 'reject' ? note || 'Rejetée après examen manuel.' : undefined,
      });
      push(
        action === 'approve' ? 'Transaction approuvée et traitée.' : action === 'reject' ? 'Transaction rejetée.' : 'Transaction maintenue en attente.',
        action === 'approve' ? 'success' : action === 'reject' ? 'warning' : 'info',
      );
      setNote('');
      setDetail(null);
      onDone?.();
      onClose();
    } catch (e: any) {
      push(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const reviewable = detail && ['PENDING', 'PROCESSING', 'UNDER_REVIEW'].includes(detail.status);

  return (
    <Modal open={open} onClose={() => { onClose(); setDetail(null); }} title={`Examen — ${detail?.reference || ''}`} wide>
      {detail && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-2xl font-black text-navy-900">{formatXAF(detail.amount)}</p>
              <p className="text-xs text-slate-500">
                {TX_TYPE_LABELS[detail.type]} · {formatDateTime(detail.createdAt)}
              </p>
              {detail.sourceAccount && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Source : {detail.sourceAccount.accountNumber} ({detail.sourceAccount.owner})
                </p>
              )}
              {detail.targetAccount && (
                <p className="text-xs font-semibold text-slate-500">
                  Destination : {detail.targetAccount.accountNumber} ({detail.targetAccount.owner})
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <TxStatusBadge status={detail.status} />
              <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
            </div>
          </div>

          {detail.analysis && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Analyse du moteur de fraude
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{detail.analysis.summary}</p>
              {detail.analysis.indicators?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {detail.analysis.indicators.map((ind: any, i: number) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-600">
                        {ind.label}
                        {ind.detail ? <span className="text-slate-400"> — {ind.detail}</span> : null}
                      </span>
                      <span className="font-black text-rose-500">+{ind.points}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {detail.alerts?.length > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-700">
              <p className="font-black">Alerte de fraude liée : {detail.alerts[0].status}</p>
              {detail.alerts[0].notes && <p className="mt-1 whitespace-pre-line text-rose-600/80">{detail.alerts[0].notes}</p>}
            </div>
          )}

          {detail.relatedTransactions?.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Activité antérieure connexe</p>
              <div className="space-y-1.5">
                {detail.relatedTransactions.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">
                      {TX_TYPE_LABELS[r.type]} · {formatDateTime(r.createdAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-black text-slate-700">{formatXAF(r.amount)}</span>
                      <TxStatusBadge status={r.status} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allowReview && reviewable && (
            <div className="space-y-3">
              <Field label="Note d'examen (optionnel)">
                <textarea rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Justification de la décision…" />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button onClick={() => act('approve')} loading={busy === 'approve'} className="w-full">
                  <CheckCircle2 className="h-4 w-4" /> Approuver
                </Button>
                <Button variant="secondary" onClick={() => act('hold')} loading={busy === 'hold'}>
                  <PauseCircle className="h-4 w-4" /> Maintenir
                </Button>
                <Button variant="danger" onClick={() => act('reject')} loading={busy === 'reject'}>
                  <XCircle className="h-4 w-4" /> Rejeter
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
