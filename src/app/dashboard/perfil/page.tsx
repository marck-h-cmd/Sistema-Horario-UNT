'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPut, apiPost, ApiClientError } from '@/lib/api-client';
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
  XCircle
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
    departamento: string | null;
    telefono: string | null;
    whatsapp: string | null;
    telegramId: string | null;
  } | null;
}

export default function PerfilPage() {
  const { user, actualizarUsuario, logout } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para formularios
  const [guardandoInfo, setGuardandoInfo] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  // Campos de Información Personal
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegramId, setTelegramId] = useState('');

  // Campos de Contraseña
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  // Validaciones visuales de contraseña en tiempo real
  const hasMinLen = nuevaPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(nuevaPassword);
  const hasLower = /[a-z]/.test(nuevaPassword);
  const hasDigit = /[0-9]/.test(nuevaPassword);
  const passwordsMatch = nuevaPassword && nuevaPassword === confirmarPassword;

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
        nombre,
        apellidos,
        telefono: telefono || null,
        whatsapp: whatsapp || null,
        telegramId: telegramId || null,
      };

      const res = await apiPut<{ usuario: PerfilUsuario }>('/api/auth/perfil', payload);
      
      if (res.success && res.data) {
        setPerfil(res.data.usuario);
        // Actualizar datos en el contexto de Auth para refrescar el header/sidebar al instante
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
      const payload = {
        passwordActual,
        nuevaPassword,
      };

      const res = await apiPost('/api/auth/cambiar-password', payload);

      if (res.success) {
        toast.success('Contraseña actualizada. Por favor, inicie sesión de nuevo.');
        setPasswordActual('');
        setNuevaPassword('');
        setConfirmarPassword('');
        
        // Esperar 1.5 segundos para que lean el toast y luego desloguear
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando información de perfil...</p>
      </div>
    );
  }

  const iniciales = `${perfil?.nombre?.charAt(0) || ''}${perfil?.apellidos?.charAt(0) || ''}`.toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Mi Perfil" 
        description="Gestiona tu información personal, datos de contacto y la seguridad de tu cuenta."
      />

      {/* Cabecera de Perfil — Banner + Avatar */}
      <div className="card overflow-hidden">
        {/* Banner con gradiente y patrón decorativo */}
        <div className="relative h-32 bg-gradient-to-r from-unt-blue via-unt-blue/90 to-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
          {/* Círculos decorativos */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -right-2 bottom-0 h-24 w-24 rounded-full bg-unt-gold/10" />
          <div className="absolute left-1/3 -top-4 h-20 w-20 rounded-full bg-white/5" />
          {/* Franja dorada inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-unt-gold/60 via-unt-gold to-unt-gold/60" />
        </div>

        {/* Sección avatar + datos */}
        <div className="relative px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-5 -mt-12">
            {/* Avatar con anillo dorado */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-unt-gold text-3xl font-bold text-unt-blue shadow-lg dark:border-slate-800 dark:shadow-black/40">
                {iniciales}
              </div>
              {/* Indicador de estado activo */}
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-800" title="Activo" />
            </div>

            {/* Nombre, email y rol */}
            <div className="mt-4 min-w-0 flex-1 sm:mt-0 sm:pb-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {perfil?.nombre} {perfil?.apellidos}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{perfil?.email}</span>
                <span className="hidden sm:inline h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="badge badge-accent">
                  {perfil ? Formateadores.rolUsuario(perfil.rol) : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Chips informativos del docente (si aplica) */}
          {perfil?.docente && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <UserCheck className="h-3.5 w-3.5" />
                Código: {perfil.docente.codigo}
              </span>
              {perfil.docente.categoria && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-unt-blue/10 px-3 py-1 text-xs font-medium text-unt-blue dark:bg-unt-gold/10 dark:text-unt-gold-light">
                  {Formateadores.categoriaDocente(perfil.docente.categoria)}
                </span>
              )}
              {perfil.docente.departamento && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {perfil.docente.departamento}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel Izquierdo: Información Personal */}
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center gap-2 bg-slate-50/60 dark:bg-slate-800/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-unt-blue/10 dark:bg-unt-gold/10">
              <User className="h-4 w-4 text-unt-blue dark:text-unt-gold" />
            </div>
            <h3 className="section-title">Información Personal</h3>
          </div>
          <form onSubmit={handleUpdateInfo} className="card-body space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  required
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
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={perfil?.email || ''}
                    disabled
                    className="pl-9 bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900/50"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">El correo electrónico no puede ser modificado.</p>
              </div>

              <div>
                <Label htmlFor="rol">Rol en el Sistema</Label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="rol"
                    value={perfil ? Formateadores.rolUsuario(perfil.rol) : ''}
                    disabled
                    className="pl-9 bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900/50"
                  />
                </div>
              </div>
            </div>

            {/* Campos Específicos de Docente */}
            {perfil?.docente && (
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700 space-y-4">
                <h4 className="text-sm font-semibold text-slate-950 dark:text-white">Datos de Docente</h4>
                
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={perfil.docente.codigo}
                      disabled
                      className="bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoria">Categoría</Label>
                    <Input
                      id="categoria"
                      value={Formateadores.categoriaDocente(perfil.docente.categoria)}
                      disabled
                      className="bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="departamento">Departamento</Label>
                    <Input
                      id="departamento"
                      value={perfil.docente.departamento || 'No especificado'}
                      disabled
                      className="bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900/50"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="telefono"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="Ej. +51 987654321"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <div className="relative">
                      <Send className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="whatsapp"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ej. +51 987654321"
                        className="pl-9"
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
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
              <Button type="submit" disabled={guardandoInfo} className="btn-primary min-w-[140px]">
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

        {/* Panel Derecho: Seguridad y Cambio de Contraseña */}
        <div className="card">
          <div className="card-header flex items-center gap-2 bg-slate-50/60 dark:bg-slate-800/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-unt-blue/10 dark:bg-unt-gold/10">
              <Key className="h-4 w-4 text-unt-blue dark:text-unt-gold" />
            </div>
            <h3 className="section-title">Seguridad</h3>
          </div>
          <form onSubmit={handleChangePassword} className="card-body space-y-4">
            <div>
              <Label htmlFor="passwordActual">Contraseña Actual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="passwordActual"
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nuevaPassword">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="nuevaPassword"
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmarPassword">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmarPassword"
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            {/* Requerimientos visuales en tiempo real */}
            <div className="rounded-lg bg-slate-50 p-3.5 space-y-2 dark:bg-slate-900/50">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Requisitos de contraseña:</h4>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  {hasMinLen ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={hasMinLen ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    Mínimo 8 caracteres
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  {hasUpper ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    Al menos una mayúscula (A-Z)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  {hasLower ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={hasLower ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    Al menos una minúscula (a-z)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  {hasDigit ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={hasDigit ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    Al menos un número (0-9)
                  </span>
                </li>
                <li className="flex items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  {passwordsMatch ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    Contraseñas coinciden
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                type="submit" 
                disabled={cambiandoPassword || !passwordsMatch || !hasMinLen || !hasUpper || !hasLower || !hasDigit} 
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
