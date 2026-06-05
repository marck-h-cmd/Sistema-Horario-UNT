'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPut, apiPost } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Formateadores } from '@/lib/formateadores';
import { toast } from 'sonner';
import {
  User,
  Key,
  Mail,
  Phone,
  Send,
  UserCheck,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface PerfilUsuario {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: string;
  docente?: {
    id: string;
    codigo: string;
    categoria: string;
    dni: string;
    departamento?: {
      nombre: string;
    } | null;
    telefono: string | null;
    whatsapp: string | null;
    telegramId: string | null;
  } | null;
}

export default function PerfilPage() {
  const { actualizarUsuario, logout } = useAuth();

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  const [guardandoInfo, setGuardandoInfo] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegramId, setTelegramId] = useState('');

  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  const hasMinLen = nuevaPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(nuevaPassword);
  const hasLower = /[a-z]/.test(nuevaPassword);
  const hasDigit = /[0-9]/.test(nuevaPassword);
  const passwordsMatch = Boolean(nuevaPassword) && nuevaPassword === confirmarPassword;

  useEffect(() => {
    async function cargarPerfil() {
      try {
        setLoading(true);

        const res = await apiGet<{ usuario: PerfilUsuario }>('/api/auth/perfil');

        if (res.success && res.data) {
          const userProfile = res.data.usuario;

          setPerfil(userProfile);
          setNombre(userProfile.nombre || '');
          setApellidos(userProfile.apellidos || '');

          if (userProfile.docente) {
            setTelefono(userProfile.docente.telefono || '');
            setWhatsapp(userProfile.docente.whatsapp || '');
            setTelegramId(userProfile.docente.telegramId || '');
          }
        }
      } catch (error: any) {
        console.error('Error al cargar perfil:', error);
        toast.error('No se pudo cargar la información del perfil');
      } finally {
        setLoading(false);
      }
    }

    cargarPerfil();
  }, []);

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim() || !apellidos.trim()) {
      toast.error('Nombre y apellidos son requeridos');
      return;
    }

    try {
      setGuardandoInfo(true);

      const payload = {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono || null,
        whatsapp: whatsapp || null,
        telegramId: telegramId || null,
      };

      const res = await apiPut<{
        message?: string;
        usuario: PerfilUsuario;
      }>('/api/auth/perfil', payload);

      if (res.success && res.data) {
        setPerfil(res.data.usuario);
        actualizarUsuario(res.data.usuario);
        toast.success('Perfil actualizado correctamente');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al actualizar el perfil');
    } finally {
      setGuardandoInfo(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordActual) {
      toast.error('Contraseña actual requerida');
      return;
    }

    if (!hasMinLen || !hasUpper || !hasLower || !hasDigit) {
      toast.error('La nueva contraseña no cumple con los requisitos de seguridad');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    try {
      setCambiandoPassword(true);

      const res = await apiPost('/api/auth/cambiar-password', {
        passwordActual,
        nuevaPassword,
      });

      if (res.success) {
        toast.success('Contraseña actualizada. Por favor, inicie sesión nuevamente.');

        setPasswordActual('');
        setNuevaPassword('');
        setConfirmarPassword('');

        setTimeout(async () => {
          await logout();
        }, 1500);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al cambiar contraseña. Verifique sus datos.');
    } finally {
      setCambiandoPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-unt-blue dark:text-unt-gold" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cargando información de perfil...
        </p>
      </div>
    );
  }

  const iniciales = `${perfil?.nombre?.charAt(0) || ''}${perfil?.apellidos?.charAt(0) || ''}`.toUpperCase();

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <PageHeader
        title="Mi Perfil"
        description="Gestiona tu información personal, datos de contacto y la seguridad de tu cuenta."
      />

      {/* Cabecera de Perfil */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-700/80 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-xl dark:shadow-black/20">
        {/* Decoración solo modo oscuro, sin ocupar espacio */}
        <div className="pointer-events-none absolute inset-0 hidden dark:block">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-unt-gold/10 blur-3xl" />
          <div className="absolute left-10 top-8 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-unt-gold/80 via-amber-300/40 to-transparent" />
        </div>

        <div className="relative z-10 px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-unt-gold text-3xl font-bold text-unt-blue shadow-md ring-4 ring-white transition-all duration-300 dark:bg-gradient-to-br dark:from-unt-gold dark:to-amber-500 dark:text-slate-950 dark:ring-slate-800 dark:shadow-lg dark:shadow-unt-gold/10">
                {iniciales || 'US'}
              </div>

              <span
                className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                title="Activo"
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                {perfil?.nombre} {perfil?.apellidos}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{perfil?.email}</span>

                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block dark:bg-slate-600" />

                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:border dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  {perfil ? Formateadores.rolUsuario(perfil.rol) : ''}
                </span>
              </div>
            </div>
          </div>

          {perfil?.docente && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/80">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <UserCheck className="h-3.5 w-3.5" />
                Código: {perfil.docente.codigo}
              </span>

              {perfil.docente.categoria && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-unt-blue/10 px-3 py-1 text-xs font-medium text-unt-blue dark:border dark:border-unt-gold/20 dark:bg-unt-gold/10 dark:text-unt-gold-light">
                  {Formateadores.categoriaDocente(perfil.docente.categoria)}
                </span>
              )}

              {perfil.docente.departamento && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                  {perfil.docente.departamento.nombre}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información personal */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-700/80 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-xl dark:shadow-black/20 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-unt-blue/10 dark:border dark:border-unt-gold/20 dark:bg-unt-gold/10">
              <User className="h-5 w-5 text-unt-blue dark:text-unt-gold" />
            </div>

            <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
              Información Personal
            </h3>
          </div>

          <form onSubmit={handleUpdateInfo} className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input
                  id="apellidos"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Tus apellidos"
                  required
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    value={perfil?.email || ''}
                    disabled
                    className="cursor-not-allowed bg-slate-50 pl-9 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  El correo electrónico no puede ser modificado.
                </p>
              </div>

              <div>
                <Label htmlFor="rol">Rol en el Sistema</Label>
                <div className="relative mt-1">
                  <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="rol"
                    value={perfil ? Formateadores.rolUsuario(perfil.rol) : ''}
                    disabled
                    className="cursor-not-allowed bg-slate-50 pl-9 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {perfil?.docente && (
              <div className="space-y-5 border-t border-slate-100 pt-5 dark:border-slate-700/80">
                <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                  Datos de Docente
                </h4>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={perfil.docente.codigo}
                      disabled
                      className="mt-1 cursor-not-allowed bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dni">DNI</Label>
                    <Input
                      id="dni"
                      value={perfil.docente.dni || ''}
                      disabled
                      className="mt-1 cursor-not-allowed bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoría</Label>
                    <Input
                      id="categoria"
                      value={Formateadores.categoriaDocente(perfil.docente.categoria)}
                      disabled
                      className="mt-1 cursor-not-allowed bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="departamento">Departamento</Label>
                    <Input
                      id="departamento"
                      value={perfil.docente.departamento?.nombre || 'No especificado'}
                      disabled
                      className="mt-1 cursor-not-allowed bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        id="telefono"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="Ej. +51 987654321"
                        className="pl-9 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <div className="relative mt-1">
                      <Send className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        id="whatsapp"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ej. +51 987654321"
                        className="pl-9 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="telegramId">Telegram ID</Label>
                    <Input
                      id="telegramId"
                      value={telegramId}
                      onChange={(e) => setTelegramId(e.target.value)}
                      placeholder="Ej. 123456789"
                      className="mt-1 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-5 dark:border-slate-700/80">
              <Button
                type="submit"
                disabled={guardandoInfo}
                className="btn-primary min-w-[150px]"
              >
                {guardandoInfo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Seguridad */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-700/80 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-xl dark:shadow-black/20">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-unt-blue/10 dark:border dark:border-unt-gold/20 dark:bg-unt-gold/10">
              <Key className="h-5 w-5 text-unt-blue dark:text-unt-gold" />
            </div>

            <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
              Seguridad
            </h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5 p-6">
            <div>
              <Label htmlFor="passwordActual">Contraseña Actual</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="passwordActual"
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nuevaPassword">Nueva Contraseña</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="nuevaPassword"
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmarPassword">Confirmar Nueva Contraseña</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="confirmarPassword"
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-800/50">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Requisitos de contraseña:
              </h4>

              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  {hasMinLen ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={hasMinLen ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                    Mínimo 8 caracteres
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasUpper ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={hasUpper ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                    Al menos una mayúscula (A-Z)
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasLower ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={hasLower ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                    Al menos una minúscula (a-z)
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasDigit ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={hasDigit ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                    Al menos un número (0-9)
                  </span>
                </li>

                <li className="flex items-center gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-700/80">
                  {passwordsMatch ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={passwordsMatch ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                    Contraseñas coinciden
                  </span>
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={
                cambiandoPassword ||
                !passwordsMatch ||
                !hasMinLen ||
                !hasUpper ||
                !hasLower ||
                !hasDigit
              }
              className="btn-primary w-full"
            >
              {cambiandoPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Cambiar Contraseña'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}