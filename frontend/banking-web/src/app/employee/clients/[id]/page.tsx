'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FileDown, Snowflake, Sun } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatDate, formatXAF, initials } from '@/lib/format';
import { ACCOUNT_STATUS_STYLES, ACCOUNT_STATUS_LABELS, TX_STATUS_LABELS } from '@/lib/labels';
import { Badge, Button, Card, SkeletonRows, TxStatusBadge } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

export default function EmployeeClientDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { push } = useToast();
  const { data, loading, reload } = useApi(() => api.get(`/employee/customers/${id}`), [id]);

  const freeze = async (account: any) => {
    try {
      if (account.status === 'FROZEN') {
        await api.post(`/employee/accounts/${account.id}/unfreeze`);
        push('Compte dégelé.', 'success');
      } else {
        await api.post(`/employee/accounts/${account.id}/freeze`, { reason: 'Gel préventif décidé par l’employé' });
        push('Compte gelé.', 'warning');
      }
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    }
  };

  return (
    <PageIn className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </button>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 text-lg font-black text-white">
            {initials(`${data?.user?.firstName ?? ''} ${data?.user?.lastName ?? ''}`)}
          </div>
          <div className="flex-1">
            <p className="text-xl font-black text-navy-900">{data?.user?.firstName} {data?.user?.lastName}</p>
            <p className="text-xs text-slate-400">{data?.user?.email} · {data?.user?.phone || '—'} · {data?.city || ''}</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Client depuis {formatDate(data?.createdAt)}</p>
            <p>Dernière connexion : {formatDateTime(data?.user?.lastLoginAt)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(data?.accounts || []).map((a: any, i: number) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-navy-900">{a.accountNumber}</p>
                <Badge className={ACCOUNT_STATUS_STYLES[a.status]}>{ACCOUNT_STATUS_LABELS[a.status]}</Badge>
              </div>
              <p className="mt-3 text-2xl font-black text-navy-900">{formatXAF(a.balance)}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Limites : {formatXAF(a.perTxLimit)} / opération · {formatXAF(a.dailyLimit)} / jour
              </p>
              {a.frozenReason && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700">❄️ {a.frozenReason}</p>}
              <div className="mt-4 grid gap-2">
                <Button variant={a.status === 'FROZEN' ? 'primary' : 'secondary'} onClick={() => freeze(a)} className="w-full">
                  {a.status === 'FROZEN' ? (<><Sun className="h-4 w-4" /> Dégeler le compte</>) : (<><Snowflake className="h-4 w-4" /> Geler le compte</>)}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full border border-slate-200 text-slate-600"
                  onClick={() =>
                    downloadFile(`/employee/accounts/${a.id}/statement`, `releve-${a.accountNumber}.csv`)
                      .then(() => push(`Relevé du compte ${a.accountNumber} téléchargé.`, 'success'))
                      .catch((e) => push(e.message, 'error'))
                  }
                >
                  <FileDown className="h-4 w-4" /> Relevé CSV
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <p className="px-5 pt-5 text-sm font-black text-navy-900">Activité récente</p>
        <div className="p-3">
          {loading && !data ? (
            <SkeletonRows n={4} />
          ) : (
            (data?.recentTransactions || []).map((t: any, i: number) => (
              <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-4 rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-navy-900">{t.reference}</p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(t.createdAt)}</p>
                </div>
                <TxStatusBadge status={t.status} />
                <p className="w-28 text-right text-[13px] font-black text-slate-700">{formatXAF(t.amount)}</p>
              </motion.div>
            ))
          )}
        </div>
      </Card>
    </PageIn>
  );
}
