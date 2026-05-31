import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Building2,
  Calendar,
  Users,
  ClipboardList,
  Clock,
  DoorOpen,
  FileText,
  BarChart3,
  Bell,
  Shield,
  Settings,
  User,
} from 'lucide-react';
import type { PERMISOS } from '@/lib/constantes';

export interface MenuItem {
  nombre: string;
  href: string;
  icon: LucideIcon;
  permission?: keyof typeof PERMISOS | null;
}

export interface MenuSection {
  titulo: string;
  items: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    titulo: 'Principal',
    items: [
      { nombre: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
      { nombre: 'Mi Perfil', href: '/dashboard/perfil', icon: User, permission: null },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { nombre: 'Docentes', href: '/dashboard/docentes', icon: GraduationCap, permission: 'GESTIONAR_DOCENTES' },
      { nombre: 'Cursos', href: '/dashboard/cursos', icon: BookOpen, permission: 'GESTIONAR_CURSOS' },
      { nombre: 'Ambientes', href: '/dashboard/ambientes', icon: Building2, permission: 'GESTIONAR_CURSOS' },
      { nombre: 'Períodos', href: '/dashboard/periodos', icon: Calendar, permission: 'GESTIONAR_HORARIOS' },
      { nombre: 'Grupos', href: '/dashboard/grupos', icon: Users, permission: 'GESTIONAR_CURSOS' },
      { nombre: 'Carga académica', href: '/dashboard/carga-academica', icon: ClipboardList, permission: 'GESTIONAR_CURSOS' },
    ],
  },
  {
    titulo: 'Horarios',
    items: [
      { nombre: 'Horarios', href: '/dashboard/horarios', icon: Clock, permission: 'GESTIONAR_HORARIOS' },
      { nombre: 'Ventanas', href: '/dashboard/ventanas-atencion', icon: DoorOpen, permission: 'GESTIONAR_VENTANAS' },
    ],
  },
  {
    titulo: 'Análisis',
    items: [
      { nombre: 'Reportes', href: '/dashboard/reportes', icon: FileText, permission: 'VER_REPORTES' },
      { nombre: 'Estadísticas', href: '/dashboard/estadisticas', icon: BarChart3, permission: 'VER_REPORTES' },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { nombre: 'Notificaciones', href: '/dashboard/notificaciones', icon: Bell, permission: null },
      { nombre: 'Auditoría', href: '/dashboard/auditoria', icon: Shield, permission: 'CONFIGURAR_SISTEMA' },
      { nombre: 'Configuración', href: '/dashboard/configuracion', icon: Settings, permission: 'CONFIGURAR_SISTEMA' },
    ],
  },
];
