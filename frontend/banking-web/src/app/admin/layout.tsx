'use client';

import { usePathname } from 'next/navigation';
import RequireRole from '@/lib/guard';
import AppShell from '@/components/AppShell';

const titles: Record<string, string> = {
  '/admin': 'Vue d’ensemble du système',
  '/admin/employes': 'Gestion des employés',
  '/admin/clients': 'Supervision des clients',
  '/admin/fraude': 'Fraude, cas & règles',
  '/admin/configuration': 'Configuration du système',
  '/admin/audit': 'Journaux d’audit',
  '/admin/rapports': 'Rapports système',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireRole role="ADMIN">
      <AppShell title={titles[pathname] || 'Administration'}>{children}</AppShell>
    </RequireRole>
  );
}
