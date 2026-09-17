'use client';

import { motion } from 'framer-motion';

/**
 * En-tête de page « hub » inspiré des dashboards fintech Dribbble :
 * fond navy, grille, halo dégradé, tuile icône lumineuse.
 */
export default function PageHero({
  icon: Icon,
  title,
  subtitle,
  actions,
  accent = 'from-brand-500 to-emerald-700',
}: {
  icon: any;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-navy-950 p-5 text-white sm:p-6"
    >
      <div className="bg-grid-dark absolute inset-0" />
      <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="relative">
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accent} opacity-60 blur-lg`} />
          <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-glow`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-400 sm:text-[13px]">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  );
}
