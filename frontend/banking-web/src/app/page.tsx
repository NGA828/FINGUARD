'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  CreditCard,
  Fingerprint,
  Gauge,
  LineChart,
  Lock,
  Radar,
  Scale,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { AnimatedNumber, LiveDot, Reveal, Stagger, StaggerItem } from '@/components/motion';

const steps = [
  {
    icon: Wallet,
    title: 'Initiation',
    text: 'Le client lance un dépôt, un retrait, un virement ou un paiement depuis son espace sécurisé.',
  },
  {
    icon: Lock,
    title: 'Validation',
    text: 'Le backend vérifie l’authentification, le solde, les limites du compte et les informations requises.',
  },
  {
    icon: BrainCircuit,
    title: 'Analyse IA',
    text: 'Le moteur de fraude évalue montant, fréquence, historique, heure et bénéficiaires pour générer un score de risque.',
  },
  {
    icon: ShieldCheck,
    title: 'Décision & action',
    text: 'Risque faible : traitement immédiat. Moyen : vérification client. Élevé : mise en attente et examen humain.',
  },
];

const features = [
  {
    icon: CreditCard,
    title: 'Opérations bancaires complètes',
    text: 'Dépôts, retraits, virements et paiements avec limites intelligentes et historique détaillé en temps réel.',
  },
  {
    icon: Radar,
    title: 'Détection de fraude intelligente',
    text: 'Score de risque sur trois niveaux (faible, moyen, élevé) calculé à chaque transaction par un moteur de règles configurable.',
  },
  {
    icon: BellRing,
    title: 'Alertes & vérifications',
    text: 'Le client confirme les opérations suspectes ; les employés examinent les cas à haut risque ; chacun est notifié.',
  },
  {
    icon: Scale,
    title: 'Gestion des litiges',
    text: 'Signalement des transactions non autorisées, investigation par les employés et suivi complet des résolutions.',
  },
  {
    icon: Fingerprint,
    title: 'Sécurité & RBAC',
    text: 'Authentification JWT et contrôle d’accès par rôle : client, employé et administrateur disposent d’espaces strictement séparés.',
  },
  {
    icon: ScrollText,
    title: 'Audit & conformité',
    text: 'Chaque action sensible est journalisée : connexions, gels de comptes, approbations, configurations.',
  },
];

const riskRows = [
  { level: 'FAIBLE', score: 12, action: 'Autoriser / traiter', color: 'bg-emerald-500', bar: 'w-[12%]' },
  { level: 'MOYEN', score: 45, action: 'Vérification supplémentaire', color: 'bg-amber-500', bar: 'w-[45%]' },
  { level: 'ÉLEVÉ', score: 85, action: 'Mettre en attente / signaler', color: 'bg-rose-500', bar: 'w-[85%]' },
];

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {/* ---------------------------------------------------------- */}
      {/* Navigation                                                  */}
      {/* ---------------------------------------------------------- */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-6">
          <motion.nav
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass mt-4 flex items-center justify-between rounded-2xl px-5 py-3"
          >
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-brand-500/50 blur-lg" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Shield
              </span>
            </Link>
            <div className="hidden items-center gap-7 text-[13.5px] font-semibold text-slate-300 md:flex">
              <a href="#fonctionnement" className="transition hover:text-white">Fonctionnement</a>
              <a href="#fonctionnalites" className="transition hover:text-white">Fonctionnalités</a>
              <a href="#securite" className="transition hover:text-white">Sécurité</a>
              <a href="#apercu" className="transition hover:text-white">Aperçu</a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="hidden text-[13.5px] font-semibold text-slate-300 transition hover:text-white sm:block">
                Se connecter
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl bg-brand-600 px-4 py-2 text-[13.5px] font-bold text-white shadow-glow transition hover:bg-brand-500"
              >
                Créer un compte
              </Link>
              <button
                onClick={() => setMobileMenu((m) => !m)}
                className="glass rounded-xl p-2 text-white md:hidden"
                aria-label="Menu"
              >
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </motion.nav>

          {/* Menu mobile */}
          <AnimatePresence>
            {mobileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass mt-2 rounded-2xl p-4 md:hidden"
              >
                <div className="flex flex-col gap-1 text-sm font-semibold text-slate-200">
                  {[
                    ['#fonctionnement', 'Fonctionnement'],
                    ['#fonctionnalites', 'Fonctionnalités'],
                    ['#securite', 'Sécurité'],
                    ['#apercu', 'Aperçu'],
                  ].map(([href, label]) => (
                    <a key={href} href={href} onClick={() => setMobileMenu(false)} className="rounded-lg px-3 py-2.5 transition hover:bg-white/10">
                      {label}
                    </a>
                  ))}
                  <Link href="/auth/login" onClick={() => setMobileMenu(false)} className="rounded-lg px-3 py-2.5 text-brand-300 transition hover:bg-white/10">
                    Se connecter
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Héro                                                        */}
      {/* ---------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-36 pb-24">
        <div className="bg-grid-dark absolute inset-0" />
        <div className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-brand-600/20 blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-0 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[110px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                Moteur intelligent de détection de fraude
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                Votre banque,
                <br />
                <span className="text-gradient animate-gradient-x bg-[length:200%_auto]">protégée par l’IA.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-6 max-w-lg text-[15.5px] leading-relaxed text-slate-400">
                Shield analyse chaque transaction — montant, fréquence, historique, heure — et attribue un
                niveau de risque avant tout traitement. Les opérations sûres passent instantanément, les
                opérations suspectes sont vérifiées ou mises en attente.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/auth/register"
                  className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-glow-lg transition-all hover:bg-brand-500 hover:shadow-glow"
                >
                  Ouvrir mon compte
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#fonctionnement"
                  className="glass inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <Zap className="h-4 w-4 text-brand-400" />
                  Voir le flux de sécurité
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <div className="mt-12 grid max-w-md grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <p className="text-2xl font-black text-white sm:text-3xl">
                    <AnimatedNumber value={99.2} format={(n) => n.toFixed(1)} /> %
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">de détection des anomalies</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white sm:text-3xl">
                    &lt;<AnimatedNumber value={50} /> ms
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">d’analyse par transaction</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white sm:text-3xl">
                    <AnimatedNumber value={3} />
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">niveaux de risque pilotés</p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Visuel héro */}
          <Reveal delay={0.25} y={40}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-brand-500/30 via-transparent to-cyan-400/20 blur-2xl" />
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
              >
                <Image
                  src="/images/hero-fintech.jpg"
                  alt="Bouclier de protection bancaire Shield"
                  width={1280}
                  height={720}
                  className="h-full w-full object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
              </motion.div>

              {/* Carte flottante : score de risque */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.7, type: 'spring', stiffness: 200, damping: 22 }}
                className="glass absolute -left-1 bottom-6 w-56 rounded-2xl p-4 shadow-2xl sm:-left-6 sm:bottom-10 sm:w-64"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-300">Analyse en direct</p>
                  <LiveDot />
                </div>
                <p className="mt-2 text-2xl font-black text-white">
                  85<span className="text-sm font-bold text-slate-400">/100</span>
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '85%' }}
                    transition={{ delay: 1.1, duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
                  />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-rose-300">Risque élevé — mise en attente</p>
              </motion.div>

              {/* Carte flottante : transaction autorisée */}
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.9, type: 'spring', stiffness: 200, damping: 22 }}
                className="glass absolute -right-1 top-4 w-48 rounded-2xl p-3.5 shadow-2xl sm:-right-4 sm:top-8 sm:w-56 sm:p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Transaction autorisée</p>
                    <p className="text-[11px] text-slate-400">Virement · 25 000 XAF</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Fonctionnement                                              */}
      {/* ---------------------------------------------------------- */}
      <section id="fonctionnement" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-400">Le flux Shield</p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl">
              De l’initiation à la décision, <span className="text-gradient">en quelques millisecondes</span>
            </h2>
          </Reveal>

          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent md:block" />
            <Stagger className="contents">
              {steps.map((s, i) => (
                <StaggerItem key={s.title}>
                  <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-500/40 hover:bg-white/[0.06]">
                    <div className="relative inline-flex">
                      <div className="absolute inset-0 rounded-2xl bg-brand-500/30 blur-lg opacity-0 transition group-hover:opacity-100" />
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-500/30 bg-navy-900">
                        <s.icon className="h-6 w-6 text-brand-400" />
                      </div>
                      <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-black">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-[15px] font-extrabold">{s.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.text}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* Niveaux de risque */}
          <Reveal delay={0.15}>
            <div className="glass mt-14 rounded-3xl p-8">
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5 text-brand-400" />
                <h3 className="text-lg font-extrabold">Les trois niveaux de risque</h3>
              </div>
              <div className="mt-6 space-y-5">
                {riskRows.map((r, i) => (
                  <div key={r.level} className="grid items-center gap-4 md:grid-cols-[110px_1fr_260px]">
                    <p className="text-sm font-black tracking-wide">{r.level}</p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: undefined }}
                        viewport={{ once: true }}
                        animate={{ width: r.bar }}
                        transition={{ delay: 0.2 + i * 0.15, duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${r.color}`}
                      />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-400">
                      Score {r.score} → <span className="text-white">{r.action}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Fonctionnalités                                             */}
      {/* ---------------------------------------------------------- */}
      <section id="fonctionnalites" className="relative bg-navy-900/60 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-400">Fonctionnalités</p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl">
              Une plateforme bancaire complète, <span className="text-gradient">pensée pour la confiance</span>
            </h2>
          </Reveal>

          <Stagger className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-500/40">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 transition group-hover:scale-110 group-hover:bg-brand-500/25">
                    <f.icon className="h-5.5 w-5.5 h-6 w-6 text-brand-400" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-extrabold">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{f.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Trois espaces                                               */}
      {/* ---------------------------------------------------------- */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-400">Un système, trois espaces</p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl">
              Chacun son rôle, <span className="text-gradient">chacun ses outils</span>
            </h2>
          </Reveal>
          <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Wallet,
                title: 'Client',
                accent: 'from-brand-500 to-emerald-700',
                items: ['Dépôts, retraits, virements, paiements', 'Confirmation des opérations suspectes', 'Litiges et notifications en temps réel'],
              },
              {
                icon: Radar,
                title: 'Employé de banque',
                accent: 'from-sky-500 to-cyan-700',
                items: ['Examen des transactions à haut risque', 'Gestion des clients, comptes et gels', 'Investigation des litiges, rapports'],
              },
              {
                icon: ShieldCheck,
                title: 'Administrateur',
                accent: 'from-violet-500 to-fuchsia-700',
                items: ['Employés, rôles et permissions', 'Règles de fraude et limites configurables', 'Audit complet et rapports système'],
              },
            ].map((r) => (
              <StaggerItem key={r.title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/25">
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${r.accent} opacity-70 transition group-hover:opacity-100`} />
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${r.accent} shadow-glow`}>
                    <r.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold">{r.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {r.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Sécurité                                                    */}
      {/* ---------------------------------------------------------- */}
      <section id="securite" className="relative overflow-hidden py-24">
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-brand-600/10 blur-[120px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2">
          <Reveal y={36}>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-brand-500/20 blur-2xl" />
              <motion.div
                animate={{ rotate: [0, 1.2, -1.2, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                className="relative overflow-hidden rounded-3xl border border-white/10"
              >
                <Image src="/images/security-ai.jpg" alt="Radar IA de détection de fraude" width={1280} height={720} className="w-full object-cover" />
              </motion.div>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-400">Sécurité de bout en bout</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                Chaque transaction passe au crible <span className="text-gradient">avant d’exister</span>
              </h2>
            </Reveal>
            <Stagger className="mt-8 space-y-4">
              {[
                'Score de risque calculé sur 8 indicateurs configurables par l’administration',
                'Vérification client pour les opérations inhabituelles, examen humain pour les cas graves',
                'Comptes gelables instantanément, limites quotidiennes et par transaction',
                'Journal d’audit complet : connexions, décisions, configurations, escalades',
                'Notifications en temps réel pour les clients, employés et administrateurs',
              ].map((t) => (
                <StaggerItem key={t}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
                    </div>
                    <p className="text-[14px] leading-relaxed text-slate-300">{t}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Aperçu produit                                              */}
      {/* ---------------------------------------------------------- */}
      <section id="apercu" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
              Une expérience bancaire <span className="text-gradient">moderne et limpide</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[14.5px] text-slate-400">
              Tableaux de bord dédiés par rôle, graphiques en temps réel et alertes de fraude visibles d’un coup d’œil.
            </p>
          </Reveal>
          <Reveal delay={0.15} y={48}>
            <div className="group relative mt-14">
              <div className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-tr from-brand-500/25 to-cyan-400/15 blur-3xl transition group-hover:from-brand-500/35" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl transition-transform duration-500 group-hover:scale-[1.015]">
                <div className="flex items-center gap-2 border-b border-white/10 bg-navy-950/80 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-[11px] text-slate-500">
                    app.finguard.cm/customer
                  </div>
                </div>
                <Image src="/images/app-preview.jpg" alt="Aperçu du tableau de bord Shield" width={1280} height={720} className="w-full" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* CTA final                                                   */}
      {/* ---------------------------------------------------------- */}
      <section className="pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-emerald-700 to-navy-900 p-12 text-center shadow-glow-lg">
              <div className="bg-grid-dark absolute inset-0 opacity-60" />
              <div className="relative">
                <h2 className="text-3xl font-black tracking-tight md:text-4xl">Prêt à sécuriser vos transactions ?</h2>
                <p className="mx-auto mt-3 max-w-md text-[14.5px] text-emerald-100/80">
                  Ouvrez votre compte en moins d’une minute et laissez le moteur de fraude veiller sur chaque franc.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Link href="/auth/register" className="rounded-xl bg-white px-7 py-3.5 text-sm font-black text-navy-900 shadow-xl transition hover:scale-[1.03]">
                    Créer mon compte
                  </Link>
                  <Link href="/auth/login" className="glass rounded-xl px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                    Accéder à mon espace
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Pied de page                                                */}
      {/* ---------------------------------------------------------- */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-emerald-700">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-extrabold text-white">Shield</span>
          </div>
          <p className="text-xs text-slate-500">
            © 2026 Shield — Système intelligent de gestion des transactions bancaires et de détection de fraude.
          </p>
          <div className="flex gap-6 text-xs font-semibold text-slate-400">
            <a href="#fonctionnement" className="transition hover:text-white">Fonctionnement</a>
            <a href="#securite" className="transition hover:text-white">Sécurité</a>
            <a href="/auth/login" className="transition hover:text-white">Connexion</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
