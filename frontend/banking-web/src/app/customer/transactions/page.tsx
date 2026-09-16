'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatXAF } from '@/lib/format';
import { RISK_LABELS, TX_STATUS_LABELS, TX_TYPE_LABELS } from '@/lib/labels';
import { Button, Card, EmptyState, Modal, RiskBadge, SkeletonRows, TxStatusBadge } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';
import NewTransactionModal from '@/components/NewTransactionModal';
import TxRowIcon from '@/components/TxRowIcon';

export default function CustomerTransactions() {
  const [filters, setFilters] = useState({ type: '', status: '', q: '' });
  const { data, loading, reload } = useApi(
    () =>
      api.get(
        `/customer/transactions?type=${filters.type}&status=${filters.status}&q=${encodeURIComponent(filters.q)}&limit=60`,
      ),
    [filters],
  );
  const [detail, setDetail] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const { push } = useToast();

  const openDetail = async (id: string) => {
    const d = await api.get(`/customer/transactions/${id}`);
    setDetail(d);
    setOpen(true);
  };

  const confirm = async (legitimate: boolean) => {
    try {
      await api.post(`/customer/transactions/${detail.id}/confirm`, { legitimate });
      push(legitimate ? 'Transaction confirmée et traitée.' : 'Transaction rejetée, un litige a été créé.', legitimate ? 'success' : 'warning');
      setOpen(false);
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      {/* Filtres */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Rechercher une référence, un bénéficiaire…"
              className="input pl-9"
            />
          </div>
          <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="input">
            <option value="">Tous les types</option>
            {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="input">
            <option value="">Tous les statuts</option>
            {Object.entries(TX_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Liste */}
      <Card>
        {loading && !data ? (
          <SkeletonRows n={6} />
        ) : !data?.items?.length ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="Aucune transaction" subtitle="Modifiez vos filtres ou lancez votre première opération." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((t: any, i: number) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => openDetail(t.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <TxRowIcon type={t.type} direction={t.sourceAccountId ? 'out' : 'in'} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-navy-900">
                    {TX_TYPE_LABELS[t.type]}
                    {t.beneficiaryName ? ` · ${t.beneficiaryName}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(t.createdAt)} · Réf. {t.reference}
                  </p>
                </div>
                <RiskBadge level={t.riskLevel} score={t.riskScore} />
                <div className="hidden sm:block">
                  <TxStatusBadge status={t.status} />
                </div>
                <p className={`w-28 text-right text-[13.5px] font-black ${t.sourceAccountId ? 'text-slate-700' : 'text-emerald-600'}`}>
                  {t.sourceAccountId ? '−' : '+'}
                  {formatXAF(t.amount)}
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setTxOpen(true)}>Nouvelle transaction</Button>
      </div>

      {/* Détail */}
      <Modal open={open} onClose={() => setOpen(false)} title={`Transaction ${detail?.reference || ''}`} wide>
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-2xl font-black text-navy-900">{formatXAF(detail.amount)}</p>
                <p className="text-xs text-slate-400">{TX_TYPE_LABELS[detail.type]} · {formatDateTime(detail.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <TxStatusBadge status={detail.status} />
                <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
              </div>
            </div>

            {detail.status === 'PENDING' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-800">Vérification requise</p>
                <p className="mt-1 text-xs text-amber-700">Confirmez que vous avez initié cette opération, ou signalez-la comme non autorisée.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="dark" onClick={() => confirm(true)}>C’est moi</Button>
                  <Button variant="danger" onClick={() => confirm(false)}>Non autorisé</Button>
                </div>
              </div>
            )}

            {detail.analysis && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Analyse du moteur de fraude
                </p>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16">
                      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                        <circle
                          cx="18" cy="18" r="15" fill="none"
                          stroke={detail.riskLevel === 'HIGH' ? '#f43f5e' : detail.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981'}
                          strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${(detail.analysis.riskScore / 100) * 94} 94`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-navy-900">{detail.analysis.riskScore}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy-900">Risque {RISK_LABELS[detail.riskLevel]?.toLowerCase()}</p>
                      <p className="text-xs text-slate-500">{detail.analysis.summary}</p>
                    </div>
                  </div>
                  {detail.analysis.indicators?.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {detail.analysis.indicators.map((ind: any, i: number) => (
                        <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-600">{ind.label}</span>
                          <span className="font-black text-rose-500">+{ind.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {detail.statusReason && (
              <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600">{detail.statusReason}</p>
            )}
          </div>
        )}
      </Modal>

      <NewTransactionModal open={txOpen} onClose={() => setTxOpen(false)} onDone={() => reload(true)} />
    </PageIn>
  );
}
