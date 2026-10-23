import type { Metadata, Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';
import { AppShell } from '../web/src/App';
import '../web/src/styles.css';

export const metadata: Metadata = {
  description: 'Crie uma vela virtual e convide quem você ama para rezar por uma intenção.',
};

export const viewport: Viewport = { themeColor: '#faf5eb' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" data-scroll-behavior="smooth"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet" />
  </head><body><AppShell><Suspense fallback={<div className="container loading-screen">Preparando sua experiência…</div>}>{children}</Suspense></AppShell></body></html>;
}
