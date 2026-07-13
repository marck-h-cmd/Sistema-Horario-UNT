'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
      // Reglas específicas para módulos docentes
      if (item.href === '/dashboard/docente/declaracion-carga' && user?.rol !== 'DOCENTE') return false;
      if (item.nombre === 'Declarar Carga' && user?.rol !== 'DOCENTE') return false;
      
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
      <div className="flex items-center gap-3 border-b border-slate-200/50 dark:border-slate-800/80 px-6 py-5 bg-slate-50/50 dark:bg-slate-900/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white shadow-md overflow-hidden p-1 border border-slate-200">
          <Image src="/logo-unt.png" alt="UNT" width={32} height={32} className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            Gestión de Horarios
          </h1>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 font-medium">Ing. de Sistemas</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {visibleSections.map((section, idx) => (
          <div key={section.titulo} className="space-y-1">
            {idx > 0 && <div className="mx-3 my-2 h-[0.5px] bg-slate-200/60 dark:bg-slate-800/60" />}
            <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {section.titulo}
            </h3>
            <ul className="space-y-1">
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
                      <Icon className="h-[18px] w-[18px] shrink-0" />
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
        <div className="border-t border-slate-200/50 dark:border-slate-800/80 p-4 bg-slate-50/50 dark:bg-slate-900/10">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-xs font-semibold text-white shadow-sm">
              {user.nombre?.charAt(0)}
              {user.apellidos?.charAt(0)}
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111827]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                {user.nombre} {user.apellidos}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {Formateadores.rolUsuario(user.rol)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors duration-150"
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0F1E]">
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[240px] bg-white/90 backdrop-blur-md text-slate-800 border-r border-slate-200/60 dark:bg-[#111827]/85 dark:text-slate-100 dark:border-slate-800/50 shadow-sm transition-all duration-300 lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-[240px] bg-white/95 backdrop-blur-md text-slate-800 border-r border-slate-200/60 dark:bg-[#111827]/95 dark:text-slate-100 dark:border-slate-800/50 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ml-[240px]">
        <header className="sticky top-0 z-35 border-b border-slate-200/50 bg-white/75 shadow-sm shadow-slate-100/5 backdrop-blur-md dark:border-slate-800/40 dark:bg-[#0A0F1E]/80 dark:shadow-none">
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
                  <p className="hidden truncate font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:block">
                    {pageTitle}
                  </p>
                )}
                <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                  {pageTitle ?? 'UNT Horarios'}
                </p>
                {user && (
                  <p className="hidden text-xs text-slate-400 dark:text-slate-500 lg:block">
                    Bienvenido,{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
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
