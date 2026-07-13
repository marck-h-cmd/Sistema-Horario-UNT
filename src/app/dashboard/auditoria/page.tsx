'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { Formateadores } from '@/lib/formateadores';
import { Rol } from '@prisma/client';

interface AuditoriaRow {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  createdAt: string;
  datos?: unknown;
  usuario?: {
    email: string;
    nombre: string;
    apellidos: string;
    rol: string;
  } | null;
}

export default function AuditoriaPage() {
  const { loading: authLoading } = useRequireAuth([Rol.ADMINISTRADOR]);

  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');
  const [entidadId, setEntidadId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const listParams = useMemo(
    () => ({
      accion: accion.trim() || undefined,
      entidad: entidad.trim() || undefined,
      entidadId: entidadId.trim() || undefined,
      usuarioId: usuarioId.trim() || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    }),
    [accion, entidad, entidadId, usuarioId, fechaDesde, fechaHasta]
  );

  const filterKey = useMemo(
    () => [accion, entidad, entidadId, usuarioId, fechaDesde, fechaHasta].join('|'),
    [accion, entidad, entidadId, usuarioId, fechaDesde, fechaHasta]
  );

  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<AuditoriaRow>(
    '/api/auditoria',
    listParams,
    { initialLimit: 50 }
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey, setPage]);

  const getAccionBadge = (accionName: string) => {
    const normalized = accionName.toUpperCase();
    if (normalized.includes('CREATE') || normalized.includes('ADD') || normalized.includes('REGISTRAR')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30';
    }
    if (normalized.includes('UPDATE') || normalized.includes('EDIT') || normalized.includes('MODIFICAR') || normalized.includes('ACTUALIZAR')) {
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/30';
    }
    if (normalized.includes('DELETE') || normalized.includes('REMOVE') || normalized.includes('ELIMINAR')) {
      return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/30';
    }
    if (normalized.includes('LOGIN') || normalized.includes('AUTH') || normalized.includes('ACCESO')) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200/80 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700';
  };

  const columns: Column<AuditoriaRow>[] = useMemo(
    () => [
      {
        key: 'f',
        header: 'Fecha',
        cell: (r) => new Date(r.createdAt).toLocaleString('es-PE'),
      },
      {
        key: 'u',
        header: 'Usuario',
        cell: (r) =>
          r.usuario
            ? `${r.usuario.apellidos}, ${r.usuario.nombre} (${Formateadores.rolUsuario(r.usuario.rol)})`
            : '—',
      },
      {
        key: 'a',
        header: 'Acción',
        cell: (r) => (
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-semibold ${getAccionBadge(r.accion)}`}>
            {r.accion}
          </span>
        ),
      },
      { key: 'e', header: 'Entidad', cell: (r) => r.entidad },
      { key: 'ei', header: 'ID entidad', cell: (r) => r.entidadId || '—' },
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
      <PageHeader title="Auditoría" description="Registro de acciones relevantes en el sistema." />

      <div className="card mb-6">
        <div className="card-body grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Usuario ID</Label>
            <Input value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <Label>Acción</Label>
            <Input value={accion} onChange={(e) => setAccion(e.target.value)} placeholder="p. ej. CREATE" />
          </div>
          <div>
            <Label>Entidad</Label>
            <Input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="p. ej. Horario" />
          </div>
          <div>
            <Label>ID entidad</Label>
            <Input value={entidadId} onChange={(e) => setEntidadId(e.target.value)} />
          </div>
          <div>
            <Label>Desde</Label>
            <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Boton
              type="button"
              variant="outline"
              onClick={() => {
                setAccion('');
                setEntidad('');
                setEntidadId('');
                setUsuarioId('');
                setFechaDesde('');
                setFechaHasta('');
              }}
            >
              Limpiar filtros
            </Boton>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} className="mb-4" onRetry={refresh} />}

      <DataTable columns={columns} data={data} loading={loading} keyExtractor={(r) => r.id} />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}
    </div>
  );
}
