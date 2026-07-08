import { NextRequest, NextResponse } from 'next/server';
import { TokenService, TokenPayload } from '@/services/auth/TokenService';
import { createErrorResponse } from '@/lib/respuestas';
import { ROLES } from '@/lib/constantes';

// Extender el tipo de NextRequest para incluir el usuario autenticado
declare module 'next/server' {
  interface NextRequest {
    user?: TokenPayload;
  }
}

const tokenService = new TokenService();

/**
 * Middleware de autenticación JWT para Next.js API Routes.
 * 
 * Verifica el token JWT en el header Authorization (Bearer) o en cookies.
 * Si el token es válido, inyecta el payload en request.user.
 * Si es inválido o expirado, retorna 401.
 * 
 * Uso:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await withAuth(request);
 *   if (authResult) return authResult; // No autenticado
 *   
 *   const user = (request as any).user;
 *   // ... lógica del endpoint
 * }
 * ```
 * 
 * Con roles requeridos:
 * ```typescript
 * const authResult = await withAuth(request, ['SECRETARIA', 'ADMINISTRADOR']);
 * ```
 */
export async function withAuth(
  request: NextRequest,
  rolesPermitidos?: string[]
): Promise<NextResponse | null> {
  try {
    // 1. Extraer token del header Authorization
    let token: string | null = null;
    
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Si no hay token en header, buscar en cookies
    if (!token) {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    // 3. Si no hay token en ningún lado, rechazar
    if (!token) {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Token de acceso requerido. Inicie sesión para acceder a este recurso.',
        401
      );
    }

    // 4. Validar el token
    const payload = await tokenService.validateToken(token);

    // 5. Verificar roles si se especifican
    if (rolesPermitidos && rolesPermitidos.length > 0) {
      if (!rolesPermitidos.includes(payload.rol)) {
        return createErrorResponse(
          'FORBIDDEN',
          `No tiene permisos para esta acción. Se requiere rol: ${rolesPermitidos.join(' o ')}`,
          403
        );
      }
    }

    // 6. Inyectar usuario en el request
    (request as any).user = payload;

    // 7. Continuar con la ejecución (null = sin error)
    return null;
  } catch (error: any) {
    // Token inválido, expirado o malformado
    if (error.statusCode === 401) {
      return createErrorResponse(
        error.code || 'UNAUTHORIZED',
        error.message || 'Token inválido o expirado. Vuelva a iniciar sesión.',
        401
      );
    }

    // Error interno
    console.error('Error en middleware de autenticación:', error);
    return createErrorResponse(
      'AUTH_ERROR',
      'Error al verificar la autenticación.',
      500
    );
  }
}

/**
 * Wrapper para usar como decorador de rutas.
 * Retorna una función que envuelve el handler original.
 * 
 * Uso:
 * ```typescript
 * export const GET = withAuthWrapper(['SECRETARIA'])(async (request) => {
 *   // Ya autenticado y autorizado
 * });
 * ```
 */
export function withAuthWrapper(rolesPermitidos?: string[]) {
  return function(handler: (request: NextRequest, context?: any) => Promise<NextResponse>) {
    return async function(request: NextRequest, context?: any) {
      const authResult = await withAuth(request, rolesPermitidos);
      if (authResult) return authResult;
      return handler(request, context);
    };
  };
}

/**
 * Middleware específico para rutas públicas con usuario opcional.
 * No rechaza si no hay token, pero si hay y es válido, inyecta el usuario.
 */
export async function withOptionalAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null; // Sin token, continuar sin usuario
    }

    const token = authHeader.substring(7);
    const payload = await tokenService.validateToken(token);
    (request as any).user = payload;

    return null;
  } catch {
    // Token inválido, pero no es obligatorio
    return null;
  }
}

/**
 * Verifica si el usuario actual tiene uno de los roles especificados
 */
export function tieneRol(user: TokenPayload | undefined, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.rol);
}

/**
 * Verifica si el usuario es administrador (Super Admin o Admin)
 */
export function esAdmin(user: TokenPayload | undefined): boolean {
  return tieneRol(user, [ROLES.ADMINISTRADOR, ROLES.SECRETARIA]);
}

/**
 * Verifica si el usuario tiene acceso a gestión de horarios
 */
export function puedeGestionarHorarios(user: TokenPayload | undefined): boolean {
  return tieneRol(user, [ROLES.ADMINISTRADOR, ROLES.SECRETARIA, ROLES.OPERADOR]);
}