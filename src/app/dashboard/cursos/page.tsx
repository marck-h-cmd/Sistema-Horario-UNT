'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
import { Rol } from '@prisma/client';
import { toast } from 'sonner';

interface CursoRow {
  id: string;
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  ciclo: number;
  planEstudios?: string | null;
  activo?: boolean;
}

export default function CursosPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [qInput, setQInput] = useState('');
  const [search, setSearch] = useState('');
  const [cicloFiltro, setCicloFiltro] = useState<string>('');
  const [activoFiltro, setActivoFiltro] = useState<string>('');

  const listParams = useMemo(() => ({
    search: search || undefined,
    ciclo: cicloFiltro || undefined,
    activo: activoFiltro || undefined,
  }), [search, cicloFiltro, activoFiltro]);

  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<CursoRow>(
    '/api/cursos',
    listParams
  );

  const limpiarFiltros = () => {
    setCicloFiltro('');
    setActivoFiltro('');
    setSearch('');
    setQInput('');
  };

  const hayFiltrosActivos = cicloFiltro || activoFiltro || search;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CursoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    creditos: 3,
    horasTeoria: 2,
    horasPractica: 2,
    horasLaboratorio: 0,
    ciclo: 1,
    planEstudios: '',
    activo: true,
  });

  const resetForm = () => {
    setForm({
      codigo: '',
      nombre: '',
      creditos: 3,
      horasTeoria: 2,
      horasPractica: 2,
      horasLaboratorio: 0,
      ciclo: 1,
      planEstudios: '',
      activo: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (row: CursoRow) => {
    setEditing(row);
    setSaving(true);
    try {
      const res = await apiGet<CursoRow>(`/api/cursos/${row.id}`);
      const c = res.data;
      if (!c) throw new Error('Vacío');
      setForm({
        codigo: c.codigo,
        nombre: c.nombre,
        creditos: c.creditos,
        horasTeoria: c.horasTeoria,
        horasPractica: c.horasPractica,
        horasLaboratorio: c.horasLaboratorio,
        ciclo: c.ciclo,
        planEstudios: c.planEstudios ?? '',
        activo: c.activo !== false,
      });
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'No se pudo cargar el curso');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/cursos/${editing.id}`, {
          codigo: Formateadores.codigo(form.codigo),
          nombre: form.nombre,
          creditos: form.creditos,
          horasTeoria: form.horasTeoria,
          horasPractica: form.horasPractica,
          horasLaboratorio: form.horasLaboratorio,
          ciclo: form.ciclo,
          planEstudios: form.planEstudios || undefined,
          activo: form.activo,
        });
        toast.success('Curso actualizado');
      } else {
        await apiPost('/api/cursos', {
          codigo: Formateadores.codigo(form.codigo),
          nombre: form.nombre,
          creditos: form.creditos,
          horasTeoria: form.horasTeoria,
          horasPractica: form.horasPractica,
          horasLaboratorio: form.horasLaboratorio,
          ciclo: form.ciclo,
          planEstudios: form.planEstudios || undefined,
        });
        toast.success('Curso creado');
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

  const handleDelete = async (row: CursoRow) => {
    const ok = await confirm({
      title: 'Desactivar curso',
      message: `¿Desactivar ${row.codigo} — ${row.nombre}?`,
      variant: 'destructive',
      confirmLabel: 'Desactivar',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/cursos/${row.id}`);
      toast.success('Curso desactivado');
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al eliminar');
    }
  };

  useEffect(() => setPage(1), [search, cicloFiltro, activoFiltro, setPage]);

  const columns: Column<CursoRow>[] = [
    { key: 'codigo', header: 'Código', cell: (r) => <span className="font-mono text-sm">{r.codigo}</span> },
    { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium text-gray-900 dark:text-slate-100">{r.nombre}</span> },
    { key: 'ciclo', header: 'Ciclo', cell: (r) => Formateadores.ciclo(r.ciclo) },
    {
      key: 'creditos',
      header: 'Créditos',
      cell: (r) => Formateadores.creditos(r.creditos),
    },
    {
      key: 'activo',
      header: 'Activo',
      cell: (r) =>
        r.activo !== false ? (
          <Badge variant="success">Sí</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        ),
    },
    {
      key: 'grupos',
      header: 'Grupos',
      cell: (r) => (
        <Link
          href={`/dashboard/grupos?cursoId=${r.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-unt-blue dark:text-unt-gold-light hover:underline"
        >
          <Users className="h-3.5 w-3.5" />
          Ver grupos
        </Link>
      ),
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
        title="Cursos"
        description="Catálogo de asignaturas y enlace a grupos."
        actions={
          <Button onClick={openCreate} className="bg-unt-blue hover:bg-unt-blue/90 text-white">
            <Plus className="h-4 w-4" />
            Nuevo curso
          </Button>
        }
      />

      {/* Barra de filtros */}
      <div className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
        <div className="flex flex-wrap items-end gap-3">
          {/* Búsqueda */}
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Buscar
            </label>
            <SearchBar
              value={qInput}
              onChange={setQInput}
              placeholder="Código o nombre…"
              onSubmit={() => setSearch(qInput.trim())}
            />
          </div>

          {/* Filtro ciclo */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ciclo
            </label>
            <select
              value={cicloFiltro}
              onChange={(e) => setCicloFiltro(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-unt-blue/50 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">Todos</option>
              {[1,2,3,4,5,6,7,8,9,10].map((c) => (
                <option key={c} value={c}>Ciclo {c}</option>
              ))}
            </select>
          </div>

          {/* Filtro activo */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Estado
            </label>
            <select
              value={activoFiltro}
              onChange={(e) => setActivoFiltro(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-unt-blue/50 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          {/* Botón buscar */}
          <Button type="button" onClick={() => setSearch(qInput.trim())} className="bg-unt-blue hover:bg-unt-blue/90 text-white">
            Buscar
          </Button>

          {/* Limpiar filtros */}
          {hayFiltrosActivos && (
            <Button type="button" variant="outline" onClick={limpiarFiltros} className="text-slate-500 dark:text-slate-400">
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} className="mb-4" onRetry={refresh} />}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        keyExtractor={(r) => r.id}
        emptyTitle="No hay cursos"
      />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setDialogOpen(false), resetForm())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar curso' : 'Registrar curso'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[70vh] overflow-y-auto">
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
                <Label htmlFor="ciclo">Ciclo (1–10)</Label>
                <Input
                  id="ciclo"
                  type="number"
                  min={1}
                  max={10}
                  value={form.ciclo}
                  onChange={(e) => setForm((f) => ({ ...f, ciclo: parseInt(e.target.value, 10) || 1 }))}
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
              <Label htmlFor="creditos">Créditos</Label>
              <Input
                id="creditos"
                type="number"
                min={1}
                value={form.creditos}
                onChange={(e) => setForm((f) => ({ ...f, creditos: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="ht">Horas teoría</Label>
                <Input
                  id="ht"
                  type="number"
                  min={0}
                  value={form.horasTeoria}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, horasTeoria: parseInt(e.target.value, 10) || 0 }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="hp">Horas práctica</Label>
                <Input
                  id="hp"
                  type="number"
                  min={0}
                  value={form.horasPractica}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, horasPractica: parseInt(e.target.value, 10) || 0 }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="hl">Horas laboratorio</Label>
                <Input
                  id="hl"
                  type="number"
                  min={0}
                  value={form.horasLaboratorio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, horasLaboratorio: parseInt(e.target.value, 10) || 0 }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plan">Plan de estudios (opcional)</Label>
              <Input
                id="plan"
                value={form.planEstudios}
                onChange={(e) => setForm((f) => ({ ...f, planEstudios: e.target.value }))}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  id="activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <Label htmlFor="activo">Curso activo</Label>
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
