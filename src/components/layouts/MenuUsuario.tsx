'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import { useAuth } from '@/contexts/AuthContext';

export function MenuUsuario() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  // Cerrar menú al hacer click fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white uppercase">
          {user?.nombre?.charAt(0) || 'U'}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium text-gray-900">{user?.nombre} {user?.apellidos}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.rol?.toLowerCase()}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{user?.nombre} {user?.apellidos}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>

          <div className="p-2">
            <button
              onClick={() => router.push('/dashboard/configuracion')}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <User className="h-4 w-4" />
              Mi Perfil
            </button>

            <button
              onClick={() => router.push('/dashboard/notificaciones')}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Bell className="h-4 w-4" />
              Notificaciones
            </button>

            <button
              onClick={() => router.push('/dashboard/configuracion')}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </button>
          </div>

          <div className="border-t border-gray-200 p-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}