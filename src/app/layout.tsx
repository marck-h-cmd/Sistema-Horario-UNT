import type { Metadata } from 'next';
import { AppProviders } from '@/providers/AppProviders';
import { ThemeScript } from '@/components/theme/ThemeScript';
import './globals.css';

// Temporal: usar fuentes de sistema mientras solucionamos la conexión a Google Fonts
const inter = { variable: '' };
const plusJakarta = { variable: '' };

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
        className={`font-sans antialiased bg-[rgb(var(--background))] text-[rgb(var(--foreground))]`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}