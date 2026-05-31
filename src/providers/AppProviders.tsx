'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { PeriodoProvider } from '@/contexts/PeriodoContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      theme={theme}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PeriodoProvider>
          {children}
          <ThemedToaster />
        </PeriodoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
