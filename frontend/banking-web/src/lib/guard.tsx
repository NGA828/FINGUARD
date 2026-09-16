'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, roleHome } from './auth';
import { Shield } from 'lucide-react';

/** Garde de page : redirection selon le rôle (RBAC côté interface). */
export default function RequireRole({ role, children }: { role: 'CLIENT' | 'EMPLOYEE' | 'ADMIN'; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (user.role !== role && !(role === 'EMPLOYEE' && user.role === 'ADMIN')) {
      router.replace(roleHome(user.role));
    }
  }, [ready, user, role, router]);

  if (!ready || !user || (user.role !== role && !(role === 'EMPLOYEE' && user.role === 'ADMIN'))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-brand-500/40 blur-xl animate-pulse-glow" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-700">
              <Shield className="h-7 w-7 text-white" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-400">Chargement de votre espace sécurisé…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
