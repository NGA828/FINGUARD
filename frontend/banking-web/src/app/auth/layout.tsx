'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Panneau formulaire */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-brand-500/40 blur-lg" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-navy-900">
            Fin<span className="text-brand-600">Guard</span>
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="text-center text-xs text-slate-400">
          © 2026 FinGuard — transactions sécurisées, fraude détectée.
        </p>
      </div>

      {/* Panneau visuel */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image src="/images/auth-side.jpg" alt="Sécurité bancaire FinGuard" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/30 to-navy-950/20" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="absolute bottom-12 left-12 right-12"
        >
          <div className="flex items-center gap-2 text-brand-300">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Protection active</p>
          </div>
          <p className="mt-3 text-2xl font-black leading-snug text-white">
            « Chaque transaction est analysée avant d’exister. C’est ça, la banque intelligente. »
          </p>
          <p className="mt-3 text-sm text-slate-300">Moteur de fraude FinGuard · analyse en moins de 50 ms</p>
        </motion.div>
      </div>
    </div>
  );
}
