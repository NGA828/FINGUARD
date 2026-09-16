'use client';

import { usePathname } from 'next/navigation';
import RequireRole from '@/lib/guard';
import AppShell from '@/components/AppShell';

const titles: Record<string, string> = {
  '/customer': 'Tableau de bord',
  '/customer/transactions': 'Mes transactions',
  '/customer/beneficiaries': 'Mes bénéficiaires',
  '/customer/disputes': 'Mes litiges',
  '/customer/profil': 'Mon profil & sécurité',
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = titles[pathname] || 'Espace client';
  return (
    <RequireRole role="CLIENT">
      <AppShell title={title}>{children}</AppShell>
    </RequireRole>
  );
}
