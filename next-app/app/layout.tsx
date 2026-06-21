import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistration from './_components/ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'Golf Scorer',
  description: 'Track scores, Stableford, Skins, Nassau, Wolf, and more',
};

export const viewport: Viewport = {
  themeColor: '#0d2818',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
