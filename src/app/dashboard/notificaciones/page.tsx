'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, MessageSquare, PhoneCall, AlertTriangle, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Boton } from '@/components/ui/Boton';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth, useRequireAuth } from '@/contexts/AuthContext';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { Formateadores } from '@/lib/formateadores';
import { Rol } from '@prisma/client';

interface NotifRow {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  estado: string;
  prioridad: string;
  canal: string;
  createdAt: string;
  usuario?: { email: string; nombre: string; apellidos: string };
}

export default function NotificacionesPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const [soloMis, setSoloMis] = useState(true);

  const listParams = useMemo(
    () =>
      soloMis && user?.id
        ? { usuarioId: user.id }
        : {},
    [soloMis, user?.id]
  );

  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<NotifRow>(
    '/api/notificaciones',
    listParams
  );

  const getCanalIcon = (canal: string) => {
    const norm = canal.toUpperCase();
    if (norm.includes('SMS')) return <PhoneCall className="h-3.5 w-3.5 inline mr-1 text-slate-500" />;
    if (norm.includes('TELEGRAM') || norm.includes('WHATSAPP')) return <MessageSquare className="h-3.5 w-3.5 inline mr-1 text-sky-500" />;
    return <Mail className="h-3.5 w-3.5 inline mr-1 text-slate-500" />;
  };

  const getPrioridadBadge = (prio: string) => {
    const norm = prio.toUpperCase();
    if (norm === 'ALTA' || norm === 'HIGH' || norm === 'CRITICAL') {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/30';
    }
    if (norm === 'MEDIA' || norm === 'MEDIUM') {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700';
  };

  const getEstadoBadge = (est: string) => {
    const norm = est.toUpperCase();
    if (norm.includes('ENVIA') || norm.includes('COMPLET') || norm.includes('SUCCESS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30';
    }
    if (norm.includes('FALL') || norm.includes('ERROR') || norm.includes('FAIL')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/30';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-350 dark:border-slate-750';
  };

  const columns: Column<NotifRow>[] = useMemo(
    () => [
      {
        key: 'fecha',
        header: 'Fecha',
        cell: (r) => new Date(r.createdAt).toLocaleString('es-PE'),
      },
      {
        key: 'titulo',
        header: 'Título y Mensaje',
        cell: (r) => (
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">{r.titulo}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm truncate">{r.mensaje}</div>
          </div>
        )
      },
      {
        key: 'tipo',
        header: 'Tipo',
        cell: (r) => (
          <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
            {r.tipo}
          </span>
        ),
      },
      {
        key: 'canal',
        header: 'Canal',
        cell: (r) => (
          <span className="inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
            {getCanalIcon(r.canal)}
            {Formateadores.canalNotificacion(r.canal)}
          </span>
        ),
      },
      {
        key: 'prio',
        header: 'Prioridad',
        cell: (r) => (
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getPrioridadBadge(r.prioridad)}`}>
            {Formateadores.prioridadNotificacion(r.prioridad)}
          </span>
        ),
      },
      {
        key: 'est',
        header: 'Estado',
        cell: (r) => (
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${getEstadoBadge(r.estado)}`}>
            {r.estado.toUpperCase().includes('ENVIA') || r.estado.toUpperCase().includes('SUCCESS') ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : r.estado.toUpperCase().includes('FALL') || r.estado.toUpperCase().includes('FAIL') ? (
              <XCircle className="h-3 w-3 mr-1" />
            ) : (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {r.estado}
          </span>
        ),
      },
    ],
    []
  );

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
        title="Notificaciones"
        description="Historial de avisos enviados por el sistema."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={soloMis ? 'default' : 'outline'}
              className={soloMis ? 'bg-unt-blue hover:bg-unt-blue/90 text-white' : ''}
              onClick={() => setSoloMis(true)}
            >
              Mis notificaciones
            </Button>
            {user?.rol === Rol.ADMINISTRADOR || user?.rol === Rol.SECRETARIA ? (
              <Button
                type="button"
                variant={!soloMis ? 'default' : 'outline'}
                className={!soloMis ? 'bg-unt-blue hover:bg-unt-blue/90 text-white' : ''}
                onClick={() => setSoloMis(false)}
              >
                Todas
              </Button>
            ) : null}
          </div>
        }
      />

      {error && <ErrorAlert message={error} className="mb-4" onRetry={refresh} />}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        keyExtractor={(r) => r.id}
        emptyTitle="Sin notificaciones"
      />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}
    </div>
  );
}
