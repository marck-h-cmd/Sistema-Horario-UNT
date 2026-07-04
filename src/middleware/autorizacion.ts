import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/respuestas';
import { TokenPayload } from '@/lib/tipos';
import { ROLES, PERMISOS } from '@/lib/constantes';

type PermisoRequerido = string | string[];

/**
 * Middleware de autorización basado en roles
 */
export function withAuthorization(rolesPermitidos: string | string[]) {
  const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

  return async function(request: NextRequest) {
    const user = (request as any).user;

    if (!user) {
      return createErrorResponse('UNAUTHORIZED', 'No autenticado', 401);
    }

    if (!roles.includes(user.rol)) {
      return createErrorResponse(
        'FORBIDDEN',
        `Se requiere uno de los siguientes roles: ${roles.join(', ')}`,
        403
      );
    }

    return null; // Continuar con la ejecución
  };
}

/**
 * Middleware de autorización basado en permisos específicos
 */
export function withPermission(permiso: string) {
  return async function(request: NextRequest) {
    const user = (request as any).user;

    if (!user) {
      return createErrorResponse('UNAUTHORIZED', 'No autenticado', 401);
    }

    const rolesPermitidos = (PERMISOS as any)[permiso];

    if (!rolesPermitidos) {
      console.warn(`Permiso no definido: ${permiso}`);
      return createErrorResponse('FORBIDDEN', 'Permiso no configurado', 403);
    }

    if (!rolesPermitidos.includes(user.rol)) {
      return createErrorResponse(
        'FORBIDDEN',
        `No tiene permiso para realizar esta acción: ${permiso}`,
        403
      );
    }

    return null;
  };
}

/**
 * Middleware que permite solo al propietario del recurso o admin
 */
export function withOwnershipOrAdmin(
  getOwnerId: (request: NextRequest, context?: any) => string | Promise<string>
) {
  return async function(request: NextRequest, context?: any) {
    const user = (request as any).user;

    if (!user) {
      return createErrorResponse('UNAUTHORIZED', 'No autenticado', 401);
    }

    // Admins pueden acceder a todo
    if (user.rol === ROLES.ADMINISTRADOR || user.rol === ROLES.SECRETARIA) {
      return null;
    }

    const ownerId = await getOwnerId(request, context);

    if (user.userId !== ownerId) {
      return createErrorResponse(
        'FORBIDDEN',
        'Solo puede acceder a sus propios recursos',
        403
      );
    }

    return null;
  };
}

/**
 * Middleware combinado: autenticación + autorización
 */
export function withAuthAndRole(rolesPermitidos: string | string[]) {
  const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

  return async function(request: NextRequest, context?: any) {
    // Verificar autenticación
    const { withAuth } = require('./auth');
    const authResult = await withAuth(request);
    if (authResult) return authResult;

    // Verificar autorización
    const user = (request as any).user;
    if (!roles.includes(user.rol)) {
      return createErrorResponse(
        'FORBIDDEN',
        `Acceso denegado. Roles permitidos: ${roles.join(', ')}`,
        403
      );
    }

    return null;
  };
}

/**
 * Helper para verificar permisos en servicios
 */
export function checkPermission(user: TokenPayload | undefined, permiso: string): void {
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const rolesPermitidos = (PERMISOS as any)[permiso];

  if (!rolesPermitidos) {
    throw new Error(`Permiso no definido: ${permiso}`);
  }

  if (!rolesPermitidos.includes(user.rol)) {
    throw new Error(`Permiso denegado: ${permiso}`);
  }
}

/**
 * Helper para verificar propiedad o admin
 */
export function checkOwnershipOrAdmin(
  user: TokenPayload | undefined,
  ownerId: string
): void {
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const isAdmin = user.rol === ROLES.ADMINISTRADOR || user.rol === ROLES.SECRETARIA;
  const isOwner = user.userId === ownerId;

  if (!isAdmin && !isOwner) {
    throw new Error('No tiene permiso para acceder a este recurso');
  }
}