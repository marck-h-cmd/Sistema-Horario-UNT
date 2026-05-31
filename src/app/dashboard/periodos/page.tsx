'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { apiPost, apiPut, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { EstadoPeriodo, Rol } from '@prisma/client';
import { toast } from 'sonner';
import { usePeriodo } from '@/contexts/PeriodoContext';

interface PeriodoRow {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  activo: boolean;
  _count?: { horarios: number; ventanas: number };
}

export default function PeriodosPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.OPERADOR]);
  const { refresh: refreshPeriodoCtx } = usePeriodo();

  const listParams = useMemo(() => ({}), []);
  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<PeriodoRow>(
    '/api/periodos',
    listParams
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<PeriodoRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
  });

  const [editForm, setEditForm] = useState<{
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    estado: EstadoPeriodo;
    activo: boolean;
  }>({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
    estado: EstadoPeriodo.BORRADOR,
    activo: false,
  });

  const openEdit = (row: PeriodoRow) => {
    setEditRow(row);
    setEditForm({
      nombre: row.nombre,
      fechaInicio: row.fechaInicio.slice(0, 10),
      fechaFin: row.fechaFin.slice(0, 10),
      estado: row.estado as EstadoPeriodo,
      activo: row.activo,
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiPost('/api/periodos', {
        nombre: createForm.nombre,
        fechaInicio: createForm.fechaInicio,
        fechaFin: createForm.fechaFin,
      });
      toast.success('Período creado');
      setCreateOpen(false);
      setCreateForm({ nombre: '', fechaInicio: '', fechaFin: '' });
      refresh();
      refreshPeriodoCtx();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await apiPut(`/api/periodos/${editRow.id}`, {
        nombre: editForm.nombre,
        fechaInicio: editForm.fechaInicio,
        fechaFin: editForm.fechaFin,
        estado: editForm.estado,
        activo: editForm.activo,
      });
      toast.success('Período actualizado');
      setEditRow(null);
      refresh();
      refreshPeriodoCtx();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<PeriodoRow>[] = [
    { key: 'nom', header: 'Nombre', cell: (r) => <span className="font-medium text-gray-900 dark:text-slate-100">{r.nombre}</span> },
    {
      key: 'ini',
      header: 'Inicio',
      cell: (r) =>
        format(new Date(r.fechaInicio), 'd MMM yyyy', { locale: es }),
    },
    {
      key: 'fin',
      header: 'Fin',
      cell: (r) => format(new Date(r.fechaFin), 'd MMM yyyy', { locale: es }),
    },
    {
      key: 'est',
      header: 'Estado',
      cell: (r) => (
        <Badge variant="outline">{Formateadores.estadoPeriodo(r.estado)}</Badge>
      ),
    },
    {
      key: 'act',
      header: 'Activo',
      cell: (r) =>
        r.activo ? <Badge variant="success">Sí</Badge> : <Badge variant="secondary">No</Badge>,
    },
    {
      key: 'counts',
      header: 'Hor./Vent.',
      cell: (r) => (
        <span className="text-sm text-gray-600 dark:text-slate-400">
          {r._count ? `${r._count.horarios} / ${r._count.ventanas}` : '—'}
        </span>
      ),
    },
    {
      key: 'acc',
      header: '',
      className: 'w-24 text-right',
      cell: (r) => (
        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

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
        title="Períodos académicos"
        description="Alta y edición de ciclos para planificación de horarios."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-unt-blue hover:bg-unt-blue/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Nuevo período
          </Button>
        }
      />

      {error && <ErrorAlert message={error} className="mb-4" onRetry={refresh} />}

      <DataTable columns={columns} data={data} loading={loading} keyExtractor={(r) => r.id} />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo período</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="pnom">Nombre</Label>
              <Input
                id="pnom"
                value={createForm.nombre}
                onChange={(e) => setCreateForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pini">Fecha inicio</Label>
              <Input
                id="pini"
                type="date"
                value={createForm.fechaInicio}
                onChange={(e) => setCreateForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pfin">Fecha fin</Label>
              <Input
                id="pfin"
                type="date"
                value={createForm.fechaFin}
                onChange={(e) => setCreateForm((f) => ({ ...f, fechaFin: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar período</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="en">Nombre</Label>
              <Input
                id="en"
                value={editForm.nombre}
                onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={editForm.fechaInicio}
                  onChange={(e) => setEditForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  type="date"
                  value={editForm.fechaFin}
                  onChange={(e) => setEditForm((f) => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={editForm.estado}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, estado: e.target.value as EstadoPeriodo }))
                }
              >
                {Object.values(EstadoPeriodo).map((s) => (
                  <option key={s} value={s}>
                    {Formateadores.estadoPeriodo(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="eact"
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              <Label htmlFor="eact">Marcar como período activo (desactiva otros)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleEditSave}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
