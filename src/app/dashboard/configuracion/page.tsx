'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Globe, ShieldCheck, Clock, Shield } from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPut, ApiClientError } from '@/lib/api-client';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol } from '@prisma/client';
import { toast } from 'sonner';

interface ConfigSistema {
  nombreApp?: string;
  version?: string;
  maxIntentosLogin?: number;
  tiempoBloqueoMinutos?: number;
  notificacionesActivas?: boolean;
  auditoriaActiva?: boolean;
}

export default function ConfiguracionPage() {
  const { loading: authLoading } = useRequireAuth([Rol.ADMINISTRADOR]);

  const [cfg, setCfg] = useState<ConfigSistema>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ConfigSistema>('/api/configuracion');
      setCfg(res.data ?? {});
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/api/configuracion', {
        nombreApp: cfg.nombreApp,
        version: cfg.version,
        maxIntentosLogin: cfg.maxIntentosLogin,
        tiempoBloqueoMinutos: cfg.tiempoBloqueoMinutos,
        notificacionesActivas: cfg.notificacionesActivas,
        auditoriaActiva: cfg.auditoriaActiva,
      });
      toast.success('Configuración guardada');
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configuración del sistema"
        description="Parámetros generales almacenados en caché (Redis)."
        actions={
          <Boton
            onClick={handleSave}
            disabled={saving || loading}
            variant="default"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
        }
      />

      {error && <ErrorAlert message={error} className="mb-4" onRetry={load} />}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
        </div>
      ) : (
        <div className="card max-w-xl">
          <div className="card-body space-y-4">
            <div>
              <Label htmlFor="na">Nombre de la aplicación</Label>
              <div className="relative mt-1">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="na"
                  value={cfg.nombreApp ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, nombreApp: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ver">Versión</Label>
              <div className="relative mt-1">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="ver"
                  value={cfg.version ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, version: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="max">Máximo intentos de login</Label>
              <div className="relative mt-1">
                <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="max"
                  type="number"
                  min={1}
                  value={cfg.maxIntentosLogin ?? ''}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, maxIntentosLogin: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tb">Tiempo de bloqueo (minutos)</Label>
              <div className="relative mt-1">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="tb"
                  type="number"
                  min={1}
                  value={cfg.tiempoBloqueoMinutos ?? ''}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, tiempoBloqueoMinutos: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="notif"
                type="checkbox"
                checked={!!cfg.notificacionesActivas}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, notificacionesActivas: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-unt-blue focus:ring-unt-blue/50"
              />
              <Label htmlFor="notif" className="font-semibold text-slate-700 dark:text-slate-300">Notificaciones activas</Label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                id="aud"
                type="checkbox"
                checked={!!cfg.auditoriaActiva}
                onChange={(e) => setCfg((c) => ({ ...c, auditoriaActiva: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-unt-blue focus:ring-unt-blue/50"
              />
              <Label htmlFor="aud" className="font-semibold text-slate-700 dark:text-slate-300">Auditoría activa</Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
