import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { AppProviders } from '@/providers/AppProviders';
import { ThemeScript } from '@/components/theme/ThemeScript';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Sistema de Gestión de Horarios - UNT',
  description: 'Sistema de Gestión de Horarios para la Escuela de Ingeniería de Sistemas de la Universidad Nacional de Trujillo',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased bg-[rgb(var(--background))] text-[rgb(var(--foreground))]`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}