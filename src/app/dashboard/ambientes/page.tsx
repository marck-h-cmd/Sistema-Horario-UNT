'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
import { SearchBar } from '@/components/data/SearchBar';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { apiDelete, apiGet, apiPost, apiPut, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoAmbiente } from '@prisma/client';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface AmbienteRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  capacidad: number;
  activo?: boolean;
}

type TabTipo = 'AULA' | 'LABORATORIO';

export default function AmbientesPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [tab, setTab] = useState<TabTipo>('AULA');
  const [qInput, setQInput] = useState('');
  const [search, setSearch] = useState('');
  const listParams = useMemo(
    () => ({ search: search || undefined, tipo: tab }),
    [search, tab]
  );
  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<AmbienteRow>(
    '/api/ambientes',
    listParams
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AmbienteRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    codigo: string;
    nombre: string;
    tipo: TipoAmbiente;
    capacidad: number;
    activo: boolean;
  }>({
    codigo: '',
    nombre: '',
    tipo: TipoAmbiente.AULA,
    capacidad: 40,
    activo: true,
  });

  const resetForm = () => {
    setForm({
      codigo: '',
      nombre: '',
      tipo: tab === 'LABORATORIO' ? TipoAmbiente.LABORATORIO : TipoAmbiente.AULA,
      capacidad: 40,
      activo: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setForm((f) => ({
      ...f,
      tipo: tab === 'LABORATORIO' ? TipoAmbiente.LABORATORIO : TipoAmbiente.AULA,
    }));
    setDialogOpen(true);
  };

  const openEdit = async (row: AmbienteRow) => {
    setEditing(row);
    setSaving(true);
    try {
      const res = await apiGet<AmbienteRow>(`/api/ambientes/${row.id}`);
      const a = res.data;
      if (!a) throw new Error('Vacío');
      setForm({
        codigo: a.codigo,
        nombre: a.nombre,
        tipo: a.tipo as TipoAmbiente,
        capacidad: a.capacidad,
        activo: a.activo !== false,
      });
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'No se pudo cargar el ambiente');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/ambientes/${editing.id}`, {
          codigo: Formateadores.codigo(form.codigo),
          nombre: form.nombre,
          tipo: form.tipo,
          capacidad: form.capacidad,
          activo: form.activo,
        });
        toast.success('Ambiente actualizado');
      } else {
        await apiPost('/api/ambientes', {
          codigo: Formateadores.codigo(form.codigo),
          nombre: form.nombre,
          tipo: form.tipo,
          capacidad: form.capacidad,
        });
        toast.success('Ambiente creado');
      }
      setDialogOpen(false);
      resetForm();
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: AmbienteRow) => {
    const ok = await confirm({
      title: 'Desactivar ambiente',
      message: `¿Desactivar ${row.codigo} — ${row.nombre}?`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/ambientes/${row.id}`);
      toast.success('Ambiente desactivado');
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al eliminar');
    }
  };

  useEffect(() => setPage(1), [search, tab, setPage]);

  const columns: Column<AmbienteRow>[] = [
    { key: 'codigo', header: 'Código', cell: (r) => <span className="font-mono text-sm">{r.codigo}</span> },
    { key: 'nombre', header: 'Nombre', cell: (r) => r.nombre },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (r) => Formateadores.tipoAmbiente(r.tipo),
    },
    {
      key: 'cap',
      header: 'Capacidad',
      cell: (r) => Formateadores.capacidad(r.capacidad),
    },
    {
      key: 'activo',
      header: 'Activo',
      cell: (r) =>
        r.activo !== false ? <Badge variant="success">Sí</Badge> : <Badge variant="secondary">No</Badge>,
    },
    {
      key: 'acciones',
      header: '',
      className: 'w-28 text-right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
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
        title="Ambientes"
        description="Aulas y laboratorios disponibles para programación."
        actions={
          <Button onClick={openCreate} className="bg-unt-blue hover:bg-unt-blue/90 text-white">
            <Plus className="h-4 w-4" />
            Nuevo ambiente
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['AULA', 'LABORATORIO'] as TabTipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-unt-blue bg-unt-blue text-white'
                : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
            )}
          >
            {t === 'AULA' ? 'Aulas' : 'Laboratorios'}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={qInput}
          onChange={setQInput}
          placeholder="Buscar…"
          onSubmit={() => setSearch(qInput.trim())}
        />
        <Button type="button" variant="outline" onClick={() => setSearch(qInput.trim())}>
          Buscar
        </Button>
      </div>

      {error && <ErrorAlert message={error} className="mb-4" onRetry={refresh} />}

      <DataTable columns={columns} data={data} loading={loading} keyExtractor={(r) => r.id} />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setDialogOpen(false), resetForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar ambiente' : 'Registrar ambiente'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="cap">Capacidad</Label>
                <Input
                  id="cap"
                  type="number"
                  min={1}
                  value={form.capacidad}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacidad: parseInt(e.target.value, 10) || 1 }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoAmbiente }))}
              >
                {Object.values(TipoAmbiente).map((t) => (
                  <option key={t} value={t}>
                    {Formateadores.tipoAmbiente(t)}
                  </option>
                ))}
              </select>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  id="activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <Label htmlFor="activo">Activo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={() => handleConfirmClose(true)}
        onCancel={() => handleConfirmClose(false)}
      />
    </div>
  );
}
