'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormModalFooter } from '@/components/forms';
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
import { CategoriaDocente, Rol } from '@prisma/client';
import { toast } from 'sonner';

interface UsuarioDocente {
  nombre: string;
  apellidos: string;
  email: string;
  activo: boolean;
}

interface DocenteRow {
  id: string;
  codigo: string;
  categoria: string;
  departamento: string | null;
  usuario: UsuarioDocente;
  fechaIngreso?: string | null;
}

const CATEGORIAS = Object.values(CategoriaDocente);

export default function DocentesPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [qInput, setQInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'' | CategoriaDocente>('');
  const [ordenarAntiguedad, setOrdenarAntiguedad] = useState<'none' | 'asc' | 'desc'>('none');
  const listParams = useMemo(
    () => ({
      search: search || undefined,
      categoria: categoriaFiltro || undefined,
      sortBy: ordenarAntiguedad !== 'none' ? 'fechaIngreso' : undefined,
      sortOrder: ordenarAntiguedad !== 'none' ? ordenarAntiguedad : undefined,
    }),
    [search, categoriaFiltro, ordenarAntiguedad]
  );
  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<DocenteRow>(
    '/api/docentes',
    listParams
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocenteRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    email: string;
    nombre: string;
    apellidos: string;
    codigo: string;
    categoria: CategoriaDocente;
    departamento: string;
    telefono: string;
    whatsapp: string;
    activo: boolean;
    fechaIngreso: string;
  }>({
    email: '',
    nombre: '',
    apellidos: '',
    codigo: '',
    categoria: CategoriaDocente.PRINCIPAL,
    departamento: '',
    telefono: '',
    whatsapp: '',
    activo: true,
    fechaIngreso: '',
  });

  const resetForm = () => {
    setForm({
      email: '',
      nombre: '',
      apellidos: '',
      codigo: '',
      categoria: CategoriaDocente.PRINCIPAL,
      departamento: '',
      telefono: '',
      whatsapp: '',
      activo: true,
      fechaIngreso: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (row: DocenteRow) => {
    setEditing(row);
    setSaving(true);
    try {
      const res = await apiGet<DocenteRow & { telefono?: string; whatsapp?: string }>(
        `/api/docentes/${row.id}`
      );
      const d = res.data;
      if (!d) throw new Error('Vacío');
      setForm({
        email: d.usuario?.email ?? row.usuario.email,
        nombre: d.usuario?.nombre ?? row.usuario.nombre,
        apellidos: d.usuario?.apellidos ?? row.usuario.apellidos,
        codigo: d.codigo,
        categoria: d.categoria as CategoriaDocente,
        departamento: d.departamento ?? '',
        telefono: d.telefono ?? '',
        whatsapp: d.whatsapp ?? '',
        activo: d.usuario?.activo ?? row.usuario.activo,
        fechaIngreso: d.fechaIngreso 
          ? new Date(d.fechaIngreso).toISOString().split('T')[0] 
          : '',
      });
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'No se pudo cargar el docente');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/docentes/${editing.id}`, {
          nombre: form.nombre,
          apellidos: form.apellidos,
          categoria: form.categoria,
          departamento: form.departamento || undefined,
          telefono: form.telefono || undefined,
          whatsapp: form.whatsapp || undefined,
          activo: form.activo,
          fechaIngreso: form.fechaIngreso || undefined,
        });
        toast.success('Docente actualizado');
      } else {
        await apiPost('/api/docentes', {
          email: form.email,
          nombre: form.nombre,
          apellidos: form.apellidos,
          codigo: Formateadores.codigo(form.codigo),
          categoria: form.categoria,
          departamento: form.departamento || undefined,
          telefono: form.telefono || undefined,
          whatsapp: form.whatsapp || undefined,
          fechaIngreso: form.fechaIngreso || undefined,
        });
        toast.success('Docente creado');
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

  const handleDelete = async (row: DocenteRow) => {
    const ok = await confirm({
      title: 'Desactivar docente',
      message: `¿Desactivar a ${row.usuario.nombre} ${row.usuario.apellidos}?`,
      variant: 'destructive',
      confirmLabel: 'Desactivar',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/docentes/${row.id}`);
      toast.success('Docente desactivado');
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al eliminar');
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, categoriaFiltro, ordenarAntiguedad, setPage]);

  const columns: Column<DocenteRow>[] = [
    { key: 'codigo', header: 'Código', cell: (r) => <span className="font-mono text-sm">{r.codigo}</span> },
    {
      key: 'nombre',
      header: 'Usuario',
      cell: (r) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-slate-100">
            {Formateadores.nombreUsuario({ nombre: r.usuario.nombre, apellidos: r.usuario.apellidos })}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{r.usuario.email}</div>
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      cell: (r) => Formateadores.categoriaDocente(r.categoria),
    },
    { key: 'depto', header: 'Departamento', cell: (r) => r.departamento || '—' },
    {
      key: 'antiguedad',
      header: 'Antigüedad',
      cell: (r) => {
        if (!r.fechaIngreso) return '—';
        const años = Math.floor(
          (new Date().getTime() - new Date(r.fechaIngreso).getTime())
          / (1000 * 60 * 60 * 24 * 365.25)
        );
        return `${años} año${años !== 1 ? 's' : ''}`;
      }
    },
    {
      key: 'activo',
      header: 'Activo',
      cell: (r) =>
        r.usuario.activo ? (
          <Badge variant="success">Sí</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        ),
    },
    {
      key: 'acciones',
      header: '',
      className: 'w-32 text-right',
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
        title="Docentes"
        description="Gestión del personal académico."
        actions={
          <div className="flex gap-2">
            <Button
              onClick={openCreate}
              className="bg-unt-blue hover:bg-unt-blue/90 text-white"
            >
              <Plus className="h-4 w-4" />
              Nuevo docente
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
          <SearchBar
            value={qInput}
            onChange={setQInput}
            placeholder="Buscar por nombre, correo o código…"
            onSubmit={() => setSearch(qInput.trim())}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="filtro-categoria" className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Categoría
            </Label>
            <select
              id="filtro-categoria"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value as '' | CategoriaDocente)}
              className="h-10 min-w-[150px] rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
            >
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {Formateadores.categoriaDocente(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ordenar-antiguedad" className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Orden
            </Label>
            <select
              id="ordenar-antiguedad"
              value={ordenarAntiguedad}
              onChange={(e) => setOrdenarAntiguedad(e.target.value as 'none' | 'asc' | 'desc')}
              className="h-10 min-w-[170px] rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
            >
              <option value="none">Por defecto</option>
              <option value="asc">Antigüedad (Mayor a menor)</option>
              <option value="desc">Antigüedad (Menor a mayor)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setSearch(qInput.trim())}>
            Buscar
          </Button>
          {(search || categoriaFiltro || ordenarAntiguedad !== 'none') && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQInput('');
                setSearch('');
                setCategoriaFiltro('');
                setOrdenarAntiguedad('none');
              }}
              className="text-xs text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
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
        emptyTitle="No hay docentes"
        emptyDescription="Ajuste la búsqueda o registre un nuevo docente."
        emptyAction={
          <Button
            type="button"
            onClick={openCreate}
            className="bg-unt-blue text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Registrar docente
          </Button>
        }
      />

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setDialogOpen(false), resetForm())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar docente' : 'Registrar docente'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!editing && (
              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input
                  id="apellidos"
                  value={form.apellidos}
                  onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  disabled={!!editing}
                />
              </div>
              <div>
                <Label htmlFor="categoria">Categoría</Label>
                <select
                  id="categoria"
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-unt-blue/20"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoria: e.target.value as CategoriaDocente }))
                  }
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {Formateadores.categoriaDocente(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                value={form.departamento}
                onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
              <Input
                id="fechaIngreso"
                type="date"
                value={form.fechaIngreso}
                onChange={(e) => setForm((f) => ({ ...f, fechaIngreso: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">
                Determina el orden de antigüedad en ventanas de atención
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                />
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  id="activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <Label htmlFor="activo">Usuario activo</Label>
              </div>
            )}
          </div>
          <FormModalFooter
            onCancel={() => setDialogOpen(false)}
            onSubmit={handleSave}
            saving={saving}
          />
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