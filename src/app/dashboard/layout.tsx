'use client';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user && pathname === '/dashboard') {
      if (user.rol === 'DOCENTE') {
        router.replace('/dashboard/docente');
      }
    }
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
