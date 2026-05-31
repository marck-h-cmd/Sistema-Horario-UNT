'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
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

  const columns: Column<NotifRow>[] = useMemo(
    () => [
      {
        key: 'fecha',
        header: 'Fecha',
        cell: (r) => new Date(r.createdAt).toLocaleString('es-PE'),
      },
      {
        key: 'titulo',
        header: 'Título',
        cell: (r) => <span className="font-medium text-gray-900 dark:text-slate-100">{r.titulo}</span>,
      },
      {
        key: 'tipo',
        header: 'Tipo',
        cell: (r) => r.tipo,
      },
      {
        key: 'canal',
        header: 'Canal',
        cell: (r) => Formateadores.canalNotificacion(r.canal),
      },
      {
        key: 'prio',
        header: 'Prioridad',
        cell: (r) => Formateadores.prioridadNotificacion(r.prioridad),
      },
      {
        key: 'est',
        header: 'Estado',
        cell: (r) => <Badge variant="outline">{r.estado}</Badge>,
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
            {user?.rol === Rol.SUPER_ADMIN || user?.rol === Rol.ADMINISTRADOR ? (
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
