'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Formateadores } from '@/lib/formateadores';
import { MENU_SECTIONS } from '@/lib/menu-config';
import { PeriodoSelector } from '@/components/layout/PeriodoSelector';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function resolvePageTitle(pathname: string | null): string | null {
  if (!pathname) return null;
  const items = MENU_SECTIONS.flatMap((s) => s.items);
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact.nombre;
  const partial = items
    .filter((i) => i.href !== '/dashboard' && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return partial?.nombre ?? null;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => resolvePageTitle(pathname), [pathname]);

  const visibleSections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission) return true;
      try {
        return can(item.permission);
      } catch (e) {
        console.warn(`Error verificando permiso ${item.permission}:`, e);
        return false;
      }
    }),
  })).filter((s) => s.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <span className="font-display text-base font-bold text-unt-blue">UNT</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-sm font-semibold tracking-tight">
            Gestión de Horarios
          </h1>
          <p className="truncate text-xs text-unt-gold-light">Ing. de Sistemas</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.titulo} className="mb-5">
            <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-unt-gold/90">
              {section.titulo}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={active ? 'nav-item-active' : 'nav-item-inactive'}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.nombre}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-unt-gold text-xs font-bold text-unt-blue shadow-sm">
              {user.nombre?.charAt(0)}
              {user.apellidos?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.nombre} {user.apellidos}
              </p>
              <p className="truncate text-xs text-blue-200">
                {Formateadores.rolUsuario(user.rol)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 bg-unt-blue text-white shadow-lg lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-unt-blue/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-unt-blue text-white shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-header backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8 lg:py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                {pageTitle && (
                  <p className="hidden truncate font-display text-lg font-semibold tracking-tight text-unt-blue dark:text-unt-gold-light sm:block">
                    {pageTitle}
                  </p>
                )}
                <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                  {pageTitle ?? 'UNT Horarios'}
                </p>
                {user && (
                  <p className="hidden text-xs text-slate-400 dark:text-slate-500 lg:block">
                    Bienvenido,{' '}
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {user.nombre}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle variant="ghost" />
              <PeriodoSelector />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 lg:p-8">
          <div className="animate-fadeIn">{children}</div>
        </main>
      </div>
    </div>
  );
}
