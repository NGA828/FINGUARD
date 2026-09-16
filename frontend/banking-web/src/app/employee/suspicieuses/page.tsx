'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Radar, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { ALERT_STATUS_LABELS, ALERT_STATUS_STYLES, TX_TYPE_LABELS } from '@/lib/labels';
import { Badge, Button, Card, EmptyState, SkeletonRows } from '@/components/ui';
import { PageIn, LiveDot } from '@/components/motion';
import ReviewModal from '@/components/ReviewModal';
import { useToast } from '@/components/toast';

export default function EmployeeSuspicious() {
  const { data, loading, reload } = useApi(() => api.get('/employee/alerts'));
  const [txId, setTxId] = useState<string | null>(null);
  const { push } = useToast();

  const escalate = async (alertId: string) => {
    try {
      await api.post(`/employee/alerts/${alertId}/escalate`, { notes: 'Escalade vers l’administration (cas grave).' });
      push('Cas escaladé vers l’administrateur.', 'warning');
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  const open = (data?.filter((a: any) => ['OPEN', 'UNDER_REVIEW'].includes(a.status)) || []).length;

  return (
    <PageIn className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50 p-4">
        <div className="flex items-center gap-3">
          <LiveDot color="bg-rose-500" />
          <div>
            <p className="text-sm font-black text-rose-700">{open} alerte(s) nécessitant une action</p>
            <p className="text-xs text-rose-500">Le moteur de fraude a signalé ces transactions pour examen humain.</p>
          </div>
        </div>
        <Radar className="h-8 w-8 text-rose-300" />
      </div>

      <Card>
        {loading && !data ? (
          <SkeletonRows n={5} />
        ) : !data?.length ? (
          <EmptyState icon={<Radar className="h-6 w-6" />} title="Aucune alerte" subtitle="Aucune transaction suspecte signalée pour le moment." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((a: any, i: number) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.5) }}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    a.level === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">
                    {a.customerName || 'Client'} — {TX_TYPE_LABELS[a.txType]} de {formatXAF(a.txAmount)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {a.accountNumber} · {formatDateTime(a.createdAt)} · réf. {a.txReference}
                    {a.escalatedToAdmin ? ' · escaladé à l’admin' : ''}
                  </p>
                  {a.notes && <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">📝 {a.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-navy-900 px-2.5 py-1 text-xs font-black text-white">Score {a.riskScore ?? '—'}</span>
                  <Badge className={ALERT_STATUS_STYLES[a.status]}>{ALERT_STATUS_LABELS[a.status]}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setTxId(a.transactionId)}>
                    <ArrowUpRight className="h-4 w-4" /> Examiner
                  </Button>
                  {['OPEN', 'UNDER_REVIEW'].includes(a.status) && (
                    <Button variant="warning" onClick={() => escalate(a.id)}>
                      Escalader
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <ReviewModal txId={txId} open={!!txId} onClose={() => setTxId(null)} onDone={() => reload(true)} />
    </PageIn>
  );
}
