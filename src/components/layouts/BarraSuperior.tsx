'use client';

import React from 'react';
import Image from 'next/image';
import { Bell, Search, Menu } from 'lucide-react';
import { MenuUsuario } from './MenuUsuario';
import { Boton } from '@/components/ui/Boton';

interface BarraSuperiorProps {
  onMenuClick?: () => void;
  titulo?: string;
}

export function BarraSuperior({ onMenuClick, titulo }: BarraSuperiorProps) {
  const [notificacionesCount, setNotificacionesCount] = React.useState(3);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-gradient-to-r from-[#f8fafc] to-white shadow-sm">
      <div className="flex h-20 items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Botón menú móvil */}
        <Boton
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6 text-[#1a365d]" />
        </Boton>

        {/* Logo y branding para escritorio (solo visible cuando sidebar está colapsado o en vistas sin sidebar) */}
        <div className="hidden items-center gap-4 lg:flex lg:w-64">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-md overflow-hidden">
            <Image
              src="/logo-unt.png"
              alt="Logo UNT"
              width={40}
              height={40}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#1a365d] leading-tight">
              UNT
            </span>
            <span className="text-xs text-gray-600 leading-tight">
              Facultad de Ingeniería
            </span>
          </div>
        </div>

        {/* Título de página */}
        <div className="flex-1">
          {titulo && (
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-[#1a365d]">
                {titulo}
              </h1>
              <p className="text-xs text-gray-500">
                Sistema de Gestión de Horarios
              </p>
            </div>
          )}
        </div>

        {/* Buscador global */}
        <div className="hidden w-full max-w-lg xl:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar docentes, cursos, ambientes, horarios..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-5 text-sm text-gray-700 shadow-sm transition-all focus:border-[#1a365d] focus:outline-none focus:ring-2 focus:ring-[#1a365d]/10"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-4">
          {/* Notificaciones */}
          <Boton 
            variant="ghost" 
            size="icon" 
            className="relative rounded-xl hover:bg-[#1a365d]/5"
          >
            <Bell className="h-5 w-5 text-gray-700" />
            {notificacionesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                {notificacionesCount}
              </span>
            )}
          </Boton>

          {/* Menú de usuario */}
          <MenuUsuario />
        </div>
      </div>
    </header>
  );
}