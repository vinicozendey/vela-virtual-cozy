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
    {/* Google Tag Manager */}
    <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P7MZTG5H');` }} />
    {/* End Google Tag Manager */}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet" />
  </head><body>
    {/* Google Tag Manager (noscript) */}
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-P7MZTG5H" height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>
    {/* End Google Tag Manager (noscript) */}
    <AppShell><Suspense fallback={<div className="container loading-screen">Preparando sua experiência…</div>}>{children}</Suspense></AppShell></body></html>;
}
