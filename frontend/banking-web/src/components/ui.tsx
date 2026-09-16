'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { ReactNode } from 'react';
import { RISK_LABELS, RISK_STYLES, TX_STATUS_LABELS, TX_STATUS_STYLES } from '@/lib/labels';
import { AnimatedNumber } from './motion';

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

export function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  ...props
}: any) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/30 hover:shadow-md hover:shadow-brand-600/30',
    dark: 'bg-navy-900 text-white hover:bg-navy-800',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    ghost: 'text-slate-600 hover:bg-slate-100',
    glass: 'glass text-white hover:bg-white/10',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Cartes & statistiques                                               */
/* ------------------------------------------------------------------ */

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>;
}

export function StatCard({
  icon,
  label,
  value,
  format,
  suffix,
  accent = 'text-brand-600 bg-brand-50',
  sub,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  accent?: string;
  sub?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="card card-hover p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-navy-900">
            <AnimatedNumber value={value} format={format} />
            {suffix && <span className="ml-1 text-sm font-semibold text-slate-400">{suffix}</span>}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>{icon}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export function TxStatusBadge({ status }: { status: string }) {
  return <Badge className={TX_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-500/20'}>{TX_STATUS_LABELS[status] || status}</Badge>;
}

export function RiskBadge({ level, score }: { level?: string | null; score?: number | null }) {
  if (!level) return <span className="text-xs text-slate-400">—</span>;
  return (
    <Badge className={RISK_STYLES[level]}>
      {RISK_LABELS[level]}
      {score != null && <span className="font-semibold opacity-70">· {score}</span>}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaires                                                         */
/* ------------------------------------------------------------------ */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modale animée                                                       */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-navy-950/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-2 py-14 text-center"
    >
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">{icon}</div>
      <p className="mt-2 text-sm font-bold text-slate-600">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-slate-400">{subtitle}</p>}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-8 text-center">
      <p className="text-sm font-semibold text-rose-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
