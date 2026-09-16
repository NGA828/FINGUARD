'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export default function ForgotPage() {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [step, setStep] = useState<'ask' | 'reset'>('ask');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setDemoCode(res.demoCode);
      setStep('reset');
      push('Si un compte existe, un code de réinitialisation a été envoyé.', 'info');
    } catch (err: any) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, newPassword: password });
      push('Mot de passe réinitialisé. Connectez-vous.', 'success');
      window.location.href = '/auth/login';
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
      transition={{ duration: 0.55 }}
      className="w-full max-w-md"
    >
      <h1 className="text-3xl font-black tracking-tight text-navy-900">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-slate-500">
        {step === 'ask'
          ? 'Saisissez votre e-mail : nous vous enverrons un code de réinitialisation.'
          : 'Saisissez le code reçu et votre nouveau mot de passe.'}
      </p>

      {demoCode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-center"
        >
          <p className="text-xs font-semibold text-brand-700">
            Mode démonstration — votre code : <span className="font-black tracking-widest">{demoCode}</span>
          </p>
        </motion.div>
      )}

      {step === 'ask' ? (
        <form onSubmit={ask} className="mt-8 space-y-5">
          <Field label="Adresse e-mail">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Button type="submit" loading={loading} className="w-full py-3">
            <Send className="h-4 w-4" /> Envoyer le code
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-8 space-y-5">
          <Field label="Code de réinitialisation">
            <input required value={code} onChange={(e) => setCode(e.target.value)} className="input tracking-widest" placeholder="000000" />
          </Field>
          <Field label="Nouveau mot de passe">
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </Field>
          <Button type="submit" loading={loading} className="w-full py-3">
            <MailCheck className="h-4 w-4" /> Réinitialiser
          </Button>
        </form>
      )}

      <Link href="/auth/login" className="mt-6 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
      </Link>
    </motion.div>
  );
}
