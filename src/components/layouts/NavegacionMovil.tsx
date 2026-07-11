'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X,
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  FileText,
  Bell,
  Settings,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utilidades';

interface NavegacionMovilProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavegacionMovil({ isOpen, onClose }: NavegacionMovilProps) {
  const pathname = usePathname();

  const menuItems = [
    {
      icono: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      icono: Calendar,
      label: 'Períodos',
      href: '/dashboard/periodos',
    },
    {
      icono: Users,
      label: 'Docentes',
      href: '/dashboard/docentes',
    },
    {
      icono: BookOpen,
      label: 'Cursos',
      href: '/dashboard/cursos',
    },
    {
      icono: Building2,
      label: 'Ambientes',
      href: '/dashboard/ambientes',
    },
    {
      icono: Calendar,
      label: 'Disponibilidad en Vivo',
      href: '/dashboard/ambientes/disponibilidad',
    },
    {
      icono: ClipboardList,
      label: 'Horarios',
      href: '/dashboard/horarios',
    },
    {
      icono: FileText,
      label: 'Reportes',
      href: '/dashboard/reportes',
    },
    {
      icono: Bell,
      label: 'Notificaciones',
      href: '/dashboard/notificaciones',
    },
    {
      icono: Settings,
      label: 'Configuración',
      href: '/dashboard/configuracion',
    },
  ];

  // Cerrar al presionar ESC
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl lg:hidden">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900">UNT Sistemas</span>
              <span className="text-xs text-gray-500">Horarios</span>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menú */}
        <nav className="overflow-y-auto p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icono = item.icono;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icono className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-4">
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-900">
              Sistema de Gestión de Horarios
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Escuela de Ingeniería de Sistemas - UNT
            </p>
          </div>
        </div>
      </div>
    </>
  );
}