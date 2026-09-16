'use client';

import { ArrowDownLeft, ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, CreditCard, Send } from 'lucide-react';

const styles: Record<string, { cls: string; icon: any }> = {
  DEPOSIT: { cls: 'bg-emerald-50 text-emerald-600', icon: ArrowDownToLine },
  WITHDRAWAL: { cls: 'bg-rose-50 text-rose-600', icon: ArrowUpFromLine },
  TRANSFER: { cls: 'bg-sky-50 text-sky-600', icon: Send },
  PAYMENT: { cls: 'bg-violet-50 text-violet-600', icon: CreditCard },
};

export default function TxRowIcon({ type, direction }: { type: string; direction?: 'in' | 'out' }) {
  const s = styles[type] || styles.PAYMENT;
  const Icon = direction === 'in' ? ArrowDownLeft : direction === 'out' ? ArrowUpRight : s.icon;
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.cls}`}>
      <Icon className="h-4.5 w-4.5 h-5 w-5" />
    </div>
  );
}
