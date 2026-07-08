'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Clock,
} from 'lucide-react';
import { ItemSidebar, ItemSidebarProps } from './ItemSidebar';
import { cn } from '@/lib/utilidades';
import { useAuth } from '@/contexts/AuthContext';
import { Rol } from '@prisma/client';

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapse }: SidebarProps) {
  const { user } = useAuth();
  
  const menuItems: ItemSidebarProps[] = [
    {
      icono: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
    },
    ...(user?.rol === Rol.ADMINISTRADOR ? [{
      icono: Users, // Or Shield
      label: 'Usuarios',
      href: '/dashboard/usuarios',
    }] : []),
    {
      icono: Calendar,
      label: 'Períodos',
      href: '/dashboard/periodos',
    },
    {
      icono: Users,
      label: 'Docentes',
      href: '/dashboard/docentes',
      children: [
        { icono: Users, label: 'Lista de Docentes', href: '/dashboard/docentes' },
        { icono: Users, label: 'Nuevo Docente', href: '/dashboard/docentes/nuevo' },
        { icono: Users, label: 'Importar Docentes', href: '/dashboard/docentes/importar' },
      ],
    },
    {
      icono: BookOpen,
      label: 'Cursos',
      href: '/dashboard/cursos',
      children: [
        { icono: BookOpen, label: 'Catálogo', href: '/dashboard/cursos' },
        { icono: BookOpen, label: 'Nuevo Curso', href: '/dashboard/cursos/nuevo' },
        { icono: BookOpen, label: 'Importar Cursos', href: '/dashboard/cursos/importar' },
      ],
    },
    {
      icono: Building2,
      label: 'Ambientes',
      href: '/dashboard/ambientes',
      children: [
        { icono: Building2, label: 'Todos', href: '/dashboard/ambientes' },
        { icono: Building2, label: 'Nuevo Ambiente', href: '/dashboard/ambientes/nuevo' },
      ],
    },
    {
      icono: ClipboardList,
      label: 'Horarios',
      href: '/dashboard/horarios',
      badge: 'Principal',
      children: [
        { icono: ClipboardList, label: 'Vista General', href: '/dashboard/horarios' },
        { icono: ClipboardList, label: 'Selección', href: '/dashboard/horarios/seleccion' },
        { icono: ClipboardList, label: 'Asignación', href: '/dashboard/horarios/asignacion' },
        { icono: ClipboardList, label: 'Vista por Aula', href: '/dashboard/horarios/vista-aula' },
        { icono: ClipboardList, label: 'Vista por Lab', href: '/dashboard/horarios/vista-laboratorio' },
        { icono: ClipboardList, label: 'Vista por Docente', href: '/dashboard/horarios/vista-docente' },
        { icono: ClipboardList, label: 'Validar', href: '/dashboard/horarios/validar' },
        { icono: ClipboardList, label: 'Publicar', href: '/dashboard/horarios/publicar' },
      ],
    },
    {
      icono: BookOpen,
      label: 'Plan Estudios',
      href: '/dashboard/plan-estudios',
      children: [
        { icono: BookOpen, label: 'Ver Plan de Estudios', href: '/dashboard/plan-estudios' },
      ],
    },
    {
      icono: Clock,
      label: 'Ventanas',
      href: '/dashboard/horarios/ventanas',
      children: [
        { icono: Clock, label: 'Configurar', href: '/dashboard/horarios/ventanas/configurar' },
        { icono: Clock, label: 'Monitorear', href: '/dashboard/horarios/ventanas/monitorear' },
      ],
    },
    {
      icono: FileText,
      label: 'Reportes',
      href: '/dashboard/reportes',
      children: [
        { icono: FileText, label: 'Por Aula', href: '/dashboard/reportes/aula' },
        { icono: FileText, label: 'Por Laboratorio', href: '/dashboard/reportes/laboratorio' },
        { icono: FileText, label: 'Por Docente', href: '/dashboard/reportes/docente' },
        { icono: FileText, label: 'Gestión', href: '/dashboard/reportes/gestion' },
        { icono: FileText, label: 'Conflictos', href: '/dashboard/reportes/conflictos' },
      ],
    },
    {
      icono: Bell,
      label: 'Notificaciones',
      href: '/dashboard/notificaciones',
      badge: 5,
      children: [
        { icono: Bell, label: 'Panel', href: '/dashboard/notificaciones' },
        { icono: Bell, label: 'Historial', href: '/dashboard/notificaciones/historial' },
        { icono: Bell, label: 'Configuración', href: '/dashboard/notificaciones/configuracion' },
      ],
    },
    {
      icono: Settings,
      label: 'Configuración',
      href: '/dashboard/configuracion',
      children: [
        { icono: Settings, label: 'General', href: '/dashboard/configuracion' },
        { icono: Settings, label: 'Restricciones', href: '/dashboard/configuracion/restricciones' },
        { icono: Settings, label: 'Días No Laborables', href: '/dashboard/configuracion/dias-no-laborables' },
        { icono: Settings, label: 'Franjas Horarias', href: '/dashboard/configuracion/franjas-horarias' },
        { icono: Settings, label: 'Roles y Permisos', href: '/dashboard/configuracion/roles-permisos' },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen border-r bg-white transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header del Sidebar */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-md overflow-hidden">
            <Image
              src="/logo-unt.png"
              alt="Logo Universidad Nacional de Trujillo"
              width={40}
              height={40}
              priority
              className="object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-[#1a365d] leading-tight">
                Universidad Nacional de Trujillo
              </span>
              <span className="text-xs font-medium text-[#2c5282] leading-tight">
                Ingeniería de Sistemas
              </span>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            onClick={() => onCollapse?.(true)}
            className="rounded-lg p-1.5 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Botón expandir (cuando está colapsado) */}
      {collapsed && (
        <div className="flex justify-center border-b py-3">
          <button
            onClick={() => onCollapse?.(false)}
            className="rounded-lg p-1.5 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Menú de navegación */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {menuItems.map((item, index) => (
            <ItemSidebar key={index} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Footer del Sidebar */}
      {!collapsed && (
        <div className="border-t p-4">
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-900">
              Sistema de Gestión de Horarios
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Escuela de Ingeniería de Sistemas
            </p>
            <p className="mt-2 text-xs text-gray-500">Versión 1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
}