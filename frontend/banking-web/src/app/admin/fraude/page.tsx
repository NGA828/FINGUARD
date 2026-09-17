'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { ALERT_STATUS_LABELS, ALERT_STATUS_STYLES, RISK_LABELS } from '@/lib/labels';
import { Badge, Card, Skeleton, SkeletonRows, StatCard } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { RiskDonut } from '@/components/charts';
import { useToast } from '@/components/toast';
import ReviewModal from '@/components/ReviewModal';

export default function AdminFraud() {
  const stats = useApi(() => api.get('/admin/fraud/stats'));
  const cases = useApi(() => api.get('/admin/fraud/cases'));
  const rules = useApi(() => api.get('/admin/fraud/rules'));
  const { push } = useToast();
  const [txId, setTxId] = useState<string | null>(null);

  const toggleRule = async (r: any) => {
    await api.patch(`/admin/fraud/rules/${r.id}`, { isActive: !r.isActive });
    push(`Règle « ${r.name} » ${r.isActive ? 'désactivée' : 'activée'}.`, 'info');
    rules.reload();
  };

  const updatePoints = async (r: any, points: number) => {
    await api.patch(`/admin/fraud/rules/${r.id}`, { points });
    rules.reload(true);
  };

  return (
    <PageIn className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Radar className="h-5 w-5" />} label="Transactions analysées" value={stats.data?.totalAnalyses ?? 0} />
        <StatCard icon={<Radar className="h-5 w-5" />} label="Signalées (moyen/élevé)" value={stats.data?.flaggedCount ?? 0} accent="text-amber-600 bg-amber-50" delay={0.05} />
        <StatCard icon={<Radar className="h-5 w-5" />} label="Alertes ouvertes" value={stats.data?.openAlerts ?? 0} accent="text-rose-600 bg-rose-50" delay={0.1} />
        <StatCard icon={<Radar className="h-5 w-5" />} label="Score moyen" value={stats.data?.avgScore ?? 0} suffix="/100" accent="text-violet-600 bg-violet-50" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-black text-navy-900">Niveaux de risque</p>
          <div className="mt-2">{stats.data ? <RiskDonut data={stats.data.byLevel} /> : <Skeleton className="h-[220px]" />}</div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="flex items-center gap-2 text-sm font-black text-navy-900">
            <Settings2 className="h-4 w-4 text-brand-600" /> Règles de détection configurables
          </p>
          <div className="mt-4 space-y-2.5">
            {!rules.data ? (
              <SkeletonRows n={5} />
            ) : (
              rules.data.map((r: any, i: number) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-navy-900">{r.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.description}
                      {r.threshold != null ? ` · seuil : ${formatXAF(r.threshold)}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                    Poids
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={r.points}
                      onBlur={(e) => Number(e.target.value) !== r.points && updatePoints(r, Number(e.target.value))}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-black"
                    />
                  </label>
                  <button onClick={() => toggleRule(r)} className="text-slate-400 transition hover:text-brand-600">
                    {r.isActive ? <ToggleRight className="h-7 w-7 text-brand-600" /> : <ToggleLeft className="h-7 w-7" />}
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <p className="px-5 pt-5 text-sm font-black text-navy-900">Cas de fraude</p>
        <div className="p-3">
          {!cases.data ? (
            <SkeletonRows n={5} />
          ) : (
            cases.data.map((c: any, i: number) => (
              <motion.button
                key={c.id}
                onClick={() => setTxId(c.transactionId)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="flex w-full flex-wrap items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-navy-900">
                    {c.customerName || 'Client'} · {formatXAF(c.txAmount)} · réf. {c.txReference}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(c.createdAt)} · niveau {RISK_LABELS[c.level]}</p>
                </div>
                <span className="rounded-lg bg-navy-900 px-2.5 py-1 text-xs font-black text-white">Score {c.riskScore ?? '—'}</span>
                <Badge className={ALERT_STATUS_STYLES[c.status]}>{ALERT_STATUS_LABELS[c.status]}</Badge>
              </motion.button>
            ))
          )}
        </div>
      </Card>

      <ReviewModal txId={txId} open={!!txId} onClose={() => setTxId(null)} onDone={() => { cases.reload(true); stats.reload(true); }} />
    </PageIn>
  );
}
