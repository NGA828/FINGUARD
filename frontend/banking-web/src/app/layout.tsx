import type { Metadata } from 'next';
import '@/styles/globals.css';
import Providers from '@/components/providers';

export const metadata: Metadata = {
  title: 'FinGuard — Banque intelligente & détection de fraude',
  description:
    'Système intelligent de gestion des transactions bancaires et de détection de fraude par IA. Opérations bancaires sécurisées, analyse de risque en temps réel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
