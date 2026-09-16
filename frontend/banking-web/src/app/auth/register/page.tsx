'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: any) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      push('Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      push('Compte créé ! Votre premier compte bancaire est prêt.', 'success');
      router.push('/customer');
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
      transition={{ duration: 0.55 }}
      className="w-full max-w-md"
    >
      <h1 className="text-3xl font-black tracking-tight text-navy-900">Ouvrir un compte</h1>
      <p className="mt-2 text-sm text-slate-500">
        Quelques informations suffisent : votre compte bancaire est créé automatiquement.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom">
            <input required value={form.firstName} onChange={set('firstName')} placeholder="Awa" className="input" />
          </Field>
          <Field label="Nom">
            <input required value={form.lastName} onChange={set('lastName')} placeholder="Diallo" className="input" />
          </Field>
        </div>
        <Field label="Adresse e-mail">
          <input type="email" required value={form.email} onChange={set('email')} placeholder="vous@exemple.com" className="input" />
        </Field>
        <Field label="Téléphone (optionnel)">
          <input value={form.phone} onChange={set('phone')} placeholder="+237 6 XX XX XX XX" className="input" />
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum, avec au moins une lettre et un chiffre.">
          <input type="password" required value={form.password} onChange={set('password')} className="input" />
        </Field>
        <Field label="Confirmer le mot de passe">
          <input type="password" required value={form.confirm} onChange={set('confirm')} className="input" />
        </Field>
        <Button type="submit" loading={loading} className="w-full py-3">
          <UserPlus className="h-4 w-4" />
          Créer mon compte
        </Button>
        <p className="text-center text-xs text-slate-500">
          Déjà client ?{' '}
          <Link href="/auth/login" className="font-bold text-brand-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </form>
    </motion.div>
  );
}
