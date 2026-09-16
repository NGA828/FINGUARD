'use client';

import { usePathname } from 'next/navigation';
import RequireRole from '@/lib/guard';
import AppShell from '@/components/AppShell';

const titles: Record<string, string> = {
  '/employee': 'Tableau de bord opérationnel',
  '/employee/clients': 'Gestion des clients',
  '/employee/comptes': 'Gestion des comptes',
  '/employee/transactions': 'Transactions',
  '/employee/suspicieuses': 'Transactions suspectes',
  '/employee/litiges': 'Litiges',
  '/employee/rapports': 'Rapports opérationnels',
};

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireRole role="EMPLOYEE">
      <AppShell title={titles[pathname] || 'Espace employé'}>{children}</AppShell>
    </RequireRole>
  );
}
