'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, LogIn, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useAuth, roleHome } from '@/lib/auth';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

const demoAccounts = [
  { label: 'Client', email: 'client@demo.com', password: 'Client123!', icon: UserRound, cls: 'text-brand-600 bg-brand-50' },
  { label: 'Employé', email: 'marie.kouassi@finguard.com', password: 'Employe123!', icon: Wrench, cls: 'text-sky-600 bg-sky-50' },
  { label: 'Admin', email: 'admin@finguard.com', password: 'Admin123!', icon: ShieldCheck, cls: 'text-violet-600 bg-violet-50' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e?: any, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const user = await login(creds?.email ?? email, creds?.password ?? password);
      push(`Bienvenue, ${user.firstName} !`, 'success');
      router.push(roleHome(user.role));
      router.refresh();
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      <h1 className="text-3xl font-black tracking-tight text-navy-900">Bon retour parmi nous</h1>
      <p className="mt-2 text-sm text-slate-500">Connectez-vous à votre espace sécurisé Shield.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Adresse e-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className="input"
          />
        </Field>
        <Field label="Mot de passe">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input"
          />
        </Field>
        <div className="flex items-center justify-between">
          <Link href="/auth/forgot" className="text-xs font-bold text-brand-600 hover:underline">
            Mot de passe oublié ?
          </Link>
          <Link href="/auth/register" className="text-xs font-bold text-slate-500 hover:underline">
            Créer un compte
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full py-3">
          <LogIn className="h-4 w-4" />
          Se connecter
        </Button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Comptes de démonstration</p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {demoAccounts.map((a) => (
            <motion.button
              key={a.label}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              disabled={loading}
              onClick={() => submit(undefined, a)}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-300 hover:shadow-md"
            >
              <span className={`rounded-lg p-2 ${a.cls}`}>
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-slate-600">{a.label}</span>
            </motion.button>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <KeyRound className="h-3 w-3" />
          Un clic remplit et connecte le compte choisi.
        </p>
      </div>
    </motion.div>
  );
}
