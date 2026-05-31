'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Rol } from '@prisma/client';
import { PERMISOS, ROLES } from '@/lib/constantes';
import type { UserSession } from '@/lib/tipos';
import { apiPost, apiRequest } from '@/lib/api-client';

interface AuthContextValue {
  user: UserSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Rol[]) => boolean;
  can: (permission: keyof typeof PERMISOS) => boolean;
  actualizarUsuario: (usuario: Record<string, any>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistSession(
  accessToken: string,
  refreshToken: string,
  user: UserSession
) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
  document.cookie = `auth_token=${accessToken}; path=/; max-age=86400; SameSite=Lax`;
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  document.cookie = 'auth_token=; path=/; max-age=0';
}

function toUserSession(usuario: Record<string, unknown>): UserSession {
  const docente = usuario.docente as { id?: string } | null | undefined;
  return {
    id: String(usuario.id),
    email: String(usuario.email),
    nombre: String(usuario.nombre),
    apellidos: String(usuario.apellidos),
    rol: usuario.rol as UserSession['rol'],
    docenteId: typeof usuario.docenteId === 'string' ? usuario.docenteId : docente?.id,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const raw = localStorage.getItem('user');
        if (token && raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          let sessionUser = toUserSession(parsed);

          // Si es docente y no tiene docenteId, intentar buscarlo
          if (sessionUser.rol === 'DOCENTE' && !sessionUser.docenteId) {
            try {
              const res = await apiRequest<{ id: string }>(
                `/api/docentes/buscar?usuarioId=${sessionUser.id}`,
                { skipAuth: false }
              );
              if (res.data?.id) {
                sessionUser.docenteId = res.data.id;
                localStorage.setItem('user', JSON.stringify(sessionUser));
              }
            } catch (err) {
              console.error('Error al recuperar docenteId:', err);
            }
          }

          setUser(sessionUser);
          document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
        }
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{
        usuario: Record<string, unknown>;
        tokens: { accessToken: string; refreshToken: string };
      }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      });

      if (!res.data) throw new Error('Respuesta inválida del servidor');

      let sessionUser = toUserSession(res.data.usuario);

      // Si es docente y no vino el docenteId en el login, buscarlo
      if (sessionUser.rol === 'DOCENTE' && !sessionUser.docenteId) {
        try {
          const docRes = await apiRequest<{ id: string }>(
            `/api/docentes/buscar?usuarioId=${sessionUser.id}`,
            {
              headers: { Authorization: `Bearer ${res.data.tokens.accessToken}` },
              skipAuth: true, // ya pasamos el token manualmente
            }
          );
          if (docRes.data?.id) {
            sessionUser.docenteId = docRes.data.id;
          }
        } catch (err) {
          console.error('Error al buscar docenteId post-login:', err);
        }
      }

      persistSession(
        res.data.tokens.accessToken,
        res.data.tokens.refreshToken,
        sessionUser
      );
      setUser(sessionUser);

      // Redirección por rol
      if (sessionUser.rol === 'DOCENTE') {
        router.replace('/dashboard/docente');
      } else {
        router.replace('/dashboard');
      }
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      /* ignorar */
    }
    clearSession();
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  const hasRole = useCallback(
    (...roles: Rol[]) => {
      if (!user) return false;
      return roles.includes(user.rol);
    },
    [user]
  );

  const can = useCallback(
    (permission: keyof typeof PERMISOS) => {
      if (!user || !PERMISOS) return false;
      const allowedRoles = PERMISOS[permission];
      if (!Array.isArray(allowedRoles)) return false;
      return (allowedRoles as readonly string[]).includes(user.rol);
    },
    [user]
  );

  const actualizarUsuario = useCallback((usuario: Record<string, any>) => {
    setUser((currentUser) => {
      if (!currentUser) return null;
      const sessionUser = toUserSession(usuario);
      if (!sessionUser.docenteId && currentUser.docenteId) {
        sessionUser.docenteId = currentUser.docenteId;
      }
      localStorage.setItem('user', JSON.stringify(sessionUser));
      return sessionUser;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      hasRole,
      can,
      actualizarUsuario,
    }),
    [user, loading, login, logout, hasRole, can, actualizarUsuario]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function useRequireAuth(allowedRoles?: Rol[]) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
      router.replace('/auth/acceso-denegado');
    }
  }, [user, loading, allowedRoles, hasRole, router]);

  return { user, loading };
}

export { ROLES };
