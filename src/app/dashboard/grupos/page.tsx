'use client';

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Selector, SelectorContent, SelectorItem, SelectorTrigger, SelectorValue } from '@/components/ui/Selector';
import { ComboCurso } from '@/components/ui/ComboCurso';
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

interface GrupoRow {
  id: string;
  nombre: string;
  capacidad: number;
  cursoId: string;
  curso: { id: string; codigo: string; nombre: string; ciclo?: number };
  _count?: { horarios: number };
  activo?: boolean;
}

function GruposInner() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();
  const searchParams = useSearchParams();
  const initialCursoId = searchParams.get('cursoId') || '';

  const [qInput, setQInput] = useState('');
  const [search, setSearch] = useState('');
  const [cursoIdFiltro, setCursoIdFiltro] = useState(initialCursoId);
  const [cicloFiltro, setCicloFiltro] = useState<number>(0);

  useEffect(() => {
    if (initialCursoId) {
      setCursoIdFiltro(initialCursoId);
    }
  }, [initialCursoId]);

  const [cursos, setCursos] = useState<any[]>([]);
  useEffect(() => {
    const cargarCursos = async () => {
      try {
        const res = await apiGet<any[]>('/api/cursos', {
          limit: 1000,
          ciclo: cicloFiltro > 0 ? cicloFiltro : undefined,
        });
        setCursos(res.data ?? []);
      } catch (e) {
        console.error('Error cargando cursos', e);
      }
    };
    cargarCursos();
  }, [cicloFiltro]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      cursoId: cursoIdFiltro || undefined,
      ciclo: cicloFiltro > 0 ? cicloFiltro : undefined,
    }),
    [search, cursoIdFiltro, cicloFiltro]
  );

  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<GrupoRow>(
    '/api/grupos',
    listParams
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cursoId: '',
    nombre: '',
    capacidad: 40,
    activo: true,
  });

  const resetForm = () => {
    setForm({
      cursoId: cursoIdFiltro || '',
      nombre: '',
      capacidad: 40,
      activo: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = useCallback(async (row: GrupoRow) => {
    setEditing(row);
    setSaving(true);
    try {
      const res = await apiGet<GrupoRow>(`/api/grupos/${row.id}`);
      const g = res.data;
      if (!g) throw new Error('Grupo no encontrado');
      setForm({
        cursoId: g.cursoId,
        nombre: g.nombre,
        capacidad: g.capacidad,
        activo: g.activo !== false,
      });
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'No se pudo cargar el grupo');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSave = async () => {
    if (!form.cursoId) {
      toast.error('Seleccione un curso');
      return;
    }
    if (!form.nombre.trim()) {
      toast.error('Ingrese el nombre del grupo');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/grupos/${editing.id}`, {
          cursoId: form.cursoId,
          nombre: form.nombre.trim(),
          capacidad: form.capacidad,
          activo: form.activo,
        });
        toast.success('Grupo actualizado');
      } else {
        await apiPost('/api/grupos', {
          cursoId: form.cursoId,
          nombre: form.nombre.trim(),
          capacidad: form.capacidad,
        });
        toast.success('Grupo creado');
      }
      setDialogOpen(false);
      resetForm();
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al guardar grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (row: GrupoRow) => {
    const ok = await confirm({
      title: 'Desactivar grupo',
      message: `¿Desactivar el grupo "${row.nombre}" del curso ${row.curso.codigo}?`,
      variant: 'destructive',
      confirmLabel: 'Desactivar',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/grupos/${row.id}`);
      toast.success('Grupo desactivado');
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al eliminar grupo');
    }
  }, [confirm, refresh]);

  useEffect(() => setPage(1), [search, cursoIdFiltro, cicloFiltro, setPage]);

  const columns: Column<GrupoRow>[] = useMemo(
    () => [
      { key: 'nombre', header: 'Grupo', cell: (r) => <span className="font-medium text-gray-900 dark:text-slate-100">{r.nombre}</span> },
      { key: 'capacidad', header: 'Capacidad', cell: (r) => r.capacidad },
      {
        key: 'curso',
        header: 'Curso',
        cell: (r) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-[220px] block">{r.curso.nombre}</span>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
              {r.curso.codigo} {r.curso.ciclo ? `• Ciclo ${Formateadores.ciclo(r.curso.ciclo)}` : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'horarios',
        header: 'Horarios',
        cell: (r) => r._count?.horarios ?? 0,
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
    ],
    [handleDelete, openEdit]
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
        title="Grupos Académicos"
        description="Gestión de grupos de estudio y asignación a cursos."
        actions={
          <Button onClick={openCreate} className="bg-unt-blue hover:bg-unt-blue/90 text-white">
            <Plus className="h-4 w-4" />
            Nuevo grupo
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-1">
          <SearchBar
            value={qInput}
            onChange={setQInput}
            placeholder="Buscar grupo o curso…"
            onSubmit={() => setSearch(qInput.trim())}
          />
        </div>
        <div>
          <Selector
            value={cicloFiltro.toString()}
            onValueChange={(v) => {
              const num = parseInt(v, 10);
              setCicloFiltro(num);
              setCursoIdFiltro('');
            }}
          >
            <SelectorTrigger>
              <div className="flex items-center gap-2 truncate">
                <span className="font-medium text-sm">Ciclo:</span>
                <SelectorValue placeholder="Todos los ciclos" />
              </div>
            </SelectorTrigger>
            <SelectorContent>
              <SelectorItem value="0">Todos los ciclos</SelectorItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                <SelectorItem key={c} value={c.toString()}>
                  Ciclo {Formateadores.ciclo(c)}
                </SelectorItem>
              ))}
            </SelectorContent>
          </Selector>
        </div>
        <div>
          <ComboCurso
            valor={cursoIdFiltro || undefined}
            onCambiar={(v) => setCursoIdFiltro(v)}
            cursos={cursos}
            placeholder="Todos los cursos"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setSearch(qInput.trim())} className="w-full md:w-auto">
            Buscar
          </Button>
          {(search || cursoIdFiltro || cicloFiltro > 0) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQInput('');
                setSearch('');
                setCicloFiltro(0);
                setCursoIdFiltro('');
              }}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
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
        emptyTitle="No hay grupos registrados"
      />

      {meta && (
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setDialogOpen(false), resetForm())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[70vh] overflow-y-auto">
            <div>
              <Label htmlFor="modal-curso">Curso</Label>
              <ComboCurso
                valor={form.cursoId || undefined}
                onCambiar={(v) => setForm((f) => ({ ...f, cursoId: v }))}
                cursos={cursos}
                placeholder="Seleccione un curso"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nombre">Nombre del grupo</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: A, B, C..."
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="capacidad">Capacidad</Label>
                <Input
                  id="capacidad"
                  type="number"
                  min={1}
                  value={form.capacidad}
                  onChange={(e) => setForm((f) => ({ ...f, capacidad: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <Label htmlFor="activo">Grupo activo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !form.nombre.trim() || !form.cursoId}
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

export default function GruposPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
        </div>
      }
    >
      <GruposInner />
    </Suspense>
  );
}
