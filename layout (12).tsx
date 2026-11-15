import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DataProvider } from '@/lib/data';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'NEXORA Seller Center',
  description: 'Espace vendeur NEXORA : publiez, validez et suivez vos comptes Summoners War.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'NEXORA', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#05060D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DataProvider>{children}</DataProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
