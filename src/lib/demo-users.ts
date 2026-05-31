import type { Rol } from '@prisma/client';

export interface DemoUser {
  id: string;
  label: string;
  email: string;
  password: string;
  rol: Rol;
  description: string;
  accentClass: string;
}

/** Usuarios de demostración (contraseña común: unt123456) */
export const DEMO_USERS: DemoUser[] = [
  {
    id: 'super',
    label: 'Super Admin',
    email: 'superadmin@unitru.edu.pe',
    password: 'unt123456',
    rol: 'SUPER_ADMIN',
    description: 'Control total del sistema',
    accentClass: 'border-violet-500 bg-violet-50 text-violet-900 hover:bg-violet-100',
  },
  {
    id: 'admin',
    label: 'Administrador',
    email: 'admin@unitru.edu.pe',
    password: 'unt123456',
    rol: 'ADMINISTRADOR',
    description: 'Gestión académica y horarios',
    accentClass: 'border-unt-blue bg-blue-50 text-unt-blue hover:bg-blue-100',
  },
  {
    id: 'operador',
    label: 'Operador',
    email: 'operador@unitru.edu.pe',
    password: 'unt123456',
    rol: 'OPERADOR',
    description: 'Programación y ventanas',
    accentClass: 'border-sky-500 bg-sky-50 text-sky-900 hover:bg-sky-100',
  },
  {
    id: 'docente',
    label: 'Docente',
    email: 'marcelino.torres@unitru.edu.pe',
    password: 'unt123456',
    rol: 'DOCENTE',
    description: 'Consulta de horarios asignados',
    accentClass: 'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  },
  {
    id: 'monitor',
    label: 'Monitor',
    email: 'monitor@unitru.edu.pe',
    password: 'unt123456',
    rol: 'MONITOR',
    description: 'Supervisión y reportes',
    accentClass: 'border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100',
  },
];

export const DEMO_PASSWORD_HINT = 'unt123456';
