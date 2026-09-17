'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  Bot,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldAlert,
  Users,
  Wallet,
  ArrowLeftRight,
  CreditCard,
  ScrollText,
  UserRound,
  Scale,
  HeartHandshake,
  X,
} from 'lucide-react';
import { useAuth, roleHome } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatDateTime, initials } from '@/lib/format';
import { NOTIF_TYPE_LABELS } from '@/lib/labels';
import { LiveDot } from './motion';
import { Skeleton } from './ui';

export interface NavItem {
  href: string;
  label: string;
  icon: any;
  end?: boolean;
}

export const CUSTOMER_NAV: NavItem[] = [
  { href: '/customer', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { href: '/customer/assistant', label: 'Assistant IA', icon: Bot },
  { href: '/customer/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/customer/beneficiaries', label: 'Bénéficiaires', icon: HeartHandshake },
  { href: '/customer/disputes', label: 'Litiges', icon: Scale },
  { href: '/customer/profil', label: 'Mon profil', icon: UserRound },
];

export const EMPLOYEE_NAV: NavItem[] = [
  { href: '/employee', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { href: '/employee/clients', label: 'Clients', icon: Users },
  { href: '/employee/comptes', label: 'Comptes', icon: Wallet },
  { href: '/employee/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/employee/suspicieuses', label: 'Suspicieuses', icon: ShieldAlert },
  { href: '/employee/litiges', label: 'Litiges', icon: Scale },
  { href: '/employee/rapports', label: 'Rapports', icon: BarChart3 },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { href: '/admin/employes', label: 'Employés', icon: Users },
  { href: '/admin/clients', label: 'Clients', icon: CreditCard },
  { href: '/admin/fraude', label: 'Fraude & règles', icon: ShieldAlert },
  { href: '/admin/configuration', label: 'Configuration', icon: Settings },
  { href: '/admin/audit', label: "Journaux d'audit", icon: ScrollText },
  { href: '/admin/rapports', label: 'Rapports', icon: BarChart3 },
];

const roleNav = (role: string) => (role === 'ADMIN' ? ADMIN_NAV : role === 'EMPLOYEE' ? EMPLOYEE_NAV : CUSTOMER_NAV);
const roleLabel = (role: string) => (role === 'ADMIN' ? 'Administrateur' : role === 'EMPLOYEE' ? 'Employé de banque' : 'Client');

export default function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifs, setNotifs] = useState<any>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const nav = roleNav(user?.role || 'CLIENT');

  const loadNotifs = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifs(res);
    } catch {
      /* silencieux */
    }
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Ferme le tiroir mobile à chaque changement de page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Verrouille le scroll quand le tiroir est ouvert.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const unread = notifs?.unreadCount ?? 0;

  const doLogout = async () => {
    await logout();
    router.push('/');
  };

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-brand-500/40 blur-lg" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 shadow-glow">
            <Shield className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-lg font-extrabold tracking-tight text-white">Shield</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {roleLabel(user?.role || '')}
          </p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = item.end ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className="group relative block">
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ${
                  active ? 'text-white' : 'text-slate-400 group-hover:text-white'
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-400' : ''}`} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <LiveDot />
          <p className="text-xs font-bold text-white">Moteur de fraude actif</p>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Chaque transaction est analysée en temps réel avant traitement.
        </p>
      </div>

      <button
        onClick={doLogout}
        className="mx-3 mb-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-[18px] w-[18px]" />
        Se déconnecter
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ---------------------------------------------------------- */}
      {/* Barre latérale (desktop)                                    */}
      {/* ---------------------------------------------------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-950 text-white lg:flex">
        <SidebarContent />
      </aside>

      {/* ---------------------------------------------------------- */}
      {/* Tiroir mobile                                               */}
      {/* ---------------------------------------------------------- */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-navy-950 text-white lg:hidden"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------- */}
      {/* Contenu                                                     */}
      {/* ---------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
          <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-brand-300 hover:text-brand-600 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-navy-900 sm:text-[17px]">
                {title}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Cloche de notifications */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => {
                    setNotifOpen((o) => !o);
                    loadNotifs();
                  }}
                  className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-brand-300 hover:text-brand-600"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
                      {unread}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-12 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-bold text-navy-900">Notifications</p>
                        {unread > 0 && (
                          <button onClick={markAll} className="text-xs font-semibold text-brand-600 hover:underline">
                            Tout marquer lu
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {!notifs ? (
                          <SkeletonRowsNotif />
                        ) : notifs.items.length === 0 ? (
                          <p className="py-10 text-center text-sm text-slate-400">Aucune notification.</p>
                        ) : (
                          notifs.items.map((n: any) => (
                            <button
                              key={n.id}
                              onClick={async () => {
                                await api.post(`/notifications/${n.id}/read`);
                                loadNotifs();
                              }}
                              className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                                !n.isRead ? 'bg-brand-50/40' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                                <p className="truncate text-[13px] font-bold text-slate-800">{n.title}</p>
                                <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  {NOTIF_TYPE_LABELS[n.type] || n.type}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.message}</p>
                              <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Utilisateur */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-xs font-extrabold text-white">
                  {initials(`${user?.firstName} ${user?.lastName}`)}
                </div>
                <div className="hidden md:block">
                  <p className="text-[13px] font-bold leading-tight text-navy-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );

  async function markAll() {
    await api.post('/notifications/read-all');
    loadNotifs();
  }
}

function SkeletonRowsNotif() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
