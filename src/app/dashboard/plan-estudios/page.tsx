'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, FileDown } from 'lucide-react';
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
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol } from '@prisma/client';
import { toast } from 'sonner';

interface DepartamentoRow {
  id: number;
  nombre: string;
}

interface PlanEstudioRow {
  id: string;
  nombre: string;
  anio: number;
  activo: boolean;
}

interface CursoRow {
  id: string;
  codigo: string;
  nombre: string;
  ciclo: number;
  tipoCurso?: string;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  departamentoId?: number;
  departamento?: DepartamentoRow | null;
  activo: boolean;
}

export default function PlanEstudiosPage() {
  const { user, loading: authLoading } = useRequireAuth([Rol.ADMINISTRADOR, Rol.SECRETARIA]);
  const canEdit = user?.rol === Rol.ADMINISTRADOR;
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [search, setSearch] = useState('');
  const [qInput, setQInput] = useState('');
  const [cicloFiltro, setCicloFiltro] = useState<number | ''>('');
  const [departamentoFiltro, setDepartamentoFiltro] = useState<number | ''>('');
  const [planEstudioFiltro, setPlanEstudioFiltro] = useState<string>('');
  
  const [departamentos, setDepartamentos] = useState<DepartamentoRow[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const [planesEstudio, setPlanesEstudio] = useState<PlanEstudioRow[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);

  useEffect(() => {
    const cargarDatosFiltros = async () => {
      setLoadingDepts(true);
      setLoadingPlanes(true);
      try {
        const [resDepts, resPlanes] = await Promise.all([
          apiGet<DepartamentoRow[]>('/api/departamentos').catch(() => null),
          apiGet<PlanEstudioRow[]>('/api/planes-estudio').catch(() => null)
        ]);
        
        if (resDepts?.data) setDepartamentos(resDepts.data);
        if (resPlanes?.data) {
          setPlanesEstudio(resPlanes.data);
          const activo = resPlanes.data.find(p => p.activo);
          if (activo) {
            setPlanEstudioFiltro(activo.id);
          } else if (resPlanes.data.length > 0) {
            setPlanEstudioFiltro(resPlanes.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error cargando filtros:', error);
      } finally {
        setLoadingDepts(false);
        setLoadingPlanes(false);
      }
    };
    cargarDatosFiltros();
  }, []);

  const listParams = useMemo(() => ({
    search: search || undefined,
    ciclo: cicloFiltro || undefined,
    departamentoId: departamentoFiltro || undefined,
    planEstudioId: planEstudioFiltro || undefined,
  }), [search, cicloFiltro, departamentoFiltro, planEstudioFiltro]);

  const { data, meta, loading, error, page, setPage, refresh } = usePaginatedQuery<CursoRow>(
    '/api/cursos',
    listParams
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CursoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planNombre, setPlanNombre] = useState('');
  const [planAnio, setPlanAnio] = useState<number>(new Date().getFullYear());
  const [allCursos, setAllCursos] = useState<CursoRow[]>([]);
  const [planCursos, setPlanCursos] = useState<Array<CursoRow & { selected?: boolean }>>([]);
  const [creatingCurso, setCreatingCurso] = useState(false);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [nuevoCursoForm, setNuevoCursoForm] = useState({ codigo: '', nombre: '', ciclo: 1, departamentoId: '' as number | '', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, tipoCurso: 'OB' });
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    ciclo: 1,
    tipoCurso: 'OB',
    creditos: 3,
    horasTeoria: 2,
    horasPractica: 2,
    horasLaboratorio: 0,
    departamentoId: '' as number | '',
    activo: true,
  });

  const resetForm = () => {
    setForm({
      codigo: '',
      nombre: '',
      ciclo: 1,
      tipoCurso: 'OB',
      creditos: 3,
      horasTeoria: 2,
      horasPractica: 2,
      horasLaboratorio: 0,
      departamentoId: '',
      activo: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: CursoRow) => {
    setEditing(row);
    setForm({
      codigo: row.codigo,
      nombre: row.nombre,
      ciclo: row.ciclo,
      tipoCurso: row.tipoCurso || 'OB',
      creditos: row.creditos,
      horasTeoria: row.horasTeoria,
      horasPractica: row.horasPractica,
      horasLaboratorio: row.horasLaboratorio,
      departamentoId: row.departamentoId || '',
      activo: row.activo,
    });
    setDialogOpen(true);
  };

  const handleExportPDF = () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (cicloFiltro) params.append('ciclo', String(cicloFiltro));
    if (departamentoFiltro) params.append('departamentoId', String(departamentoFiltro));
    if (planEstudioFiltro) params.append('planEstudioId', planEstudioFiltro);

    const url = `/api/reportes/plan-estudios?${params.toString()}`;
    window.open(url, '_blank');
  };

  const handleSave = async () => {
    if (!form.codigo || !form.nombre || !form.departamentoId) {
      toast.error('Complete los campos obligatorios (Código, Nombre y Departamento)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        ciclo: Number(form.ciclo),
        tipoCurso: form.tipoCurso,
        creditos: Number(form.creditos),
        horasTeoria: Number(form.horasTeoria),
        horasPractica: Number(form.horasPractica),
        horasLaboratorio: Number(form.horasLaboratorio),
        departamentoId: Number(form.departamentoId),
        activo: form.activo,
      };

      if (editing) {
        await apiPut(`/api/cursos/${editing.id}`, payload);
        toast.success('Curso actualizado exitosamente');
      } else {
        await apiPost('/api/cursos', payload);
        toast.success('Curso creado exitosamente');
      }
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al guardar el curso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: CursoRow) => {
    const ok = await confirm({
      title: 'Desactivar Curso',
      message: `¿Está seguro que desea desactivar el curso ${row.codigo} - ${row.nombre}? No podrá ser asignado a nuevos horarios.`,
      confirmLabel: 'Desactivar',
      variant: 'destructive',
    });

    if (ok) {
      try {
        await apiDelete(`/api/cursos/${row.id}`);
        toast.success('Curso desactivado exitosamente');
        refresh();
      } catch (e) {
        toast.error(e instanceof ApiClientError ? e.message : 'Error al desactivar el curso');
      }
    }
  };

  // --- Plan modal helpers ---
  const loadAllCursos = async () => {
    try {
      const res = await apiGet<CursoRow[]>('/api/cursos', { limit: 10000, page: 1 });
      setAllCursos(res.data ?? []);
    } catch (e) {
      console.error('Error cargando cursos:', e);
    }
  };

  const toggleCursoSeleccion = (curso: CursoRow, checked: boolean) => {
    if (checked) {
      setPlanCursos((prev) => [...prev, { ...curso, selected: true }]);
    } else {
      setPlanCursos((prev) => prev.filter((p) => p.id !== curso.id));
    }
  };

  const updateHoras = (id: string, field: 'horasTeoria' | 'horasPractica' | 'horasLaboratorio' | 'creditos', value: number) => {
    setPlanCursos((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeCursoFromPlan = (id: string) => {
    setPlanCursos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateCursoFromModal = async () => {
    setCreatingCurso(true);
    try {
      const payload = {
        codigo: nuevoCursoForm.codigo,
        nombre: nuevoCursoForm.nombre,
        ciclo: Number(nuevoCursoForm.ciclo),
        tipoCurso: nuevoCursoForm.tipoCurso,
        creditos: Number(nuevoCursoForm.creditos),
        horasTeoria: Number(nuevoCursoForm.horasTeoria),
        horasPractica: Number(nuevoCursoForm.horasPractica),
        horasLaboratorio: Number(nuevoCursoForm.horasLaboratorio),
        departamentoId: nuevoCursoForm.departamentoId || undefined,
      };
      const res = await apiPost('/api/cursos', payload);
      if (res?.data) {
        const created = res.data as CursoRow;
        setAllCursos((prev) => [created, ...prev]);
        // auto seleccionar
        toggleCursoSeleccion(created, true);
        toast.success('Curso creado y añadido al plan');
        setNuevoCursoForm({ codigo: '', nombre: '', ciclo: 1, departamentoId: '' as number | '', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, tipoCurso: 'OB' });
      }
    } catch (e) {
      console.error(e);
      toast.error('Error creando curso');
    } finally {
      setCreatingCurso(false);
    }
  };

  const confirmAndCreateCurso = async () => {
    const ok = await confirm({
      title: 'Confirmar creación',
      message: `¿Crear el curso "${nuevoCursoForm.codigo} - ${nuevoCursoForm.nombre}"?`,
      confirmLabel: 'Crear',
    });
    if (!ok) return;
    await handleCreateCursoFromModal();
    setShowInlineCreate(false);
  };

  const handleCreatePlan = async () => {
    if (!planNombre) {
      toast.error('Ingrese un nombre para el plan');
      return;
    }
    if (planCursos.length === 0) {
      toast.error('Seleccione al menos un curso para el plan');
      return;
    }
    try {
      const payload = {
        nombre: planNombre,
        anio: Number(planAnio),
        cursos: planCursos.map((c) => ({ cursoId: c.id, creditos: c.creditos, horasTeoria: c.horasTeoria, horasPractica: c.horasPractica, horasLaboratorio: c.horasLaboratorio })),
      };
      const res = await apiPost('/api/planes-estudio', payload);
      if (res) {
        toast.success('Plan de estudio creado');
        setPlanModalOpen(false);
        // refrescar lista de planes
        const planesRes = await apiGet<PlanEstudioRow[]>('/api/planes-estudio');
        if (planesRes?.data) setPlanesEstudio(planesRes.data);
      }
    } catch (e) {
      console.error('Error creando plan:', e);
      toast.error('Error creando plan de estudio');
    }
  };

  const columns: Column<CursoRow>[] = [
    {
      header: 'Código',
      key: 'codigo',
      cell: (row) => <>{row.codigo}</>,
      className: 'font-mono text-sm uppercase',
    },
    {
      header: 'Nombre del Curso',
      key: 'nombre',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.nombre}</p>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {row.departamento?.nombre || 'Sin dpto.'}
          </p>
        </div>
      ),
    },
    {
      header: 'Ciclo / Tipo',
      key: 'ciclo',
      cell: (row) => (
        <div className="flex flex-col gap-1 items-start">
          <Badge variant="outline">Ciclo {row.ciclo}</Badge>
          {row.tipoCurso && <Badge variant="secondary" className="text-xs">{row.tipoCurso}</Badge>}
        </div>
      ),
    },
    {
      header: 'Horas (T-P-L)',
      key: 'horas',
      cell: (row) => (
        <div className="text-sm font-medium">
          {row.horasTeoria}T - {row.horasPractica}P - {row.horasLaboratorio}L
        </div>
      ),
    },
    {
      header: 'Créditos',
      key: 'creditos',
      cell: (row) => <>{row.creditos}</>,
      className: 'text-center font-medium',
    },
    {
      header: 'Estado',
      key: 'estado',
      cell: (row) => (
        <Badge variant={row.activo ? 'success' : 'secondary'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    ...(canEdit ? [{
      header: 'Acciones',
      key: 'actions',
      className: 'text-right',
      cell: (row: CursoRow) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Editar Curso">
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
          {row.activo && (
            <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} title="Desactivar">
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      ),
    }] : []),
  ];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de Estudios / Cursos"
        description="Gestione los cursos de la carrera, horas, créditos y departamento responsable."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
            {canEdit && (
              <>
                <Button variant="secondary" onClick={() => setPlanModalOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear Plan de Estudio
                </Button>
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Curso
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar
              value={qInput}
              onChange={setQInput}
              onSubmit={() => setSearch(qInput.trim())}
              placeholder="Buscar por código o nombre del curso..."
            />
          </div>
          
          <div className="w-full md:w-56">
            <select
              value={planEstudioFiltro}
              onChange={(e) => {
                setPlanEstudioFiltro(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingPlanes}
            >
              <option value="">Todos los planes</option>
              {planesEstudio.map((p) => {
                const nombreMostrar = p.nombre.includes(String(p.anio))
                  ? p.nombre
                  : `${p.nombre} ${p.anio}`;
                return (
                  <option key={p.id} value={p.id}>
                    {nombreMostrar} {p.activo ? '(Activo)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="w-full md:w-48">
            <select
              value={cicloFiltro}
              onChange={(e) => {
                setCicloFiltro(e.target.value === '' ? '' : Number(e.target.value));
                setPage(1);
              }}
              className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los ciclos</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  Ciclo {c}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-64">
            <select
              value={departamentoFiltro}
              onChange={(e) => {
                setDepartamentoFiltro(e.target.value === '' ? '' : Number(e.target.value));
                setPage(1);
              }}
              className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingDepts}
            >
              <option value="">Todos los dptos.</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <DataTable
            columns={columns}
            data={data}
            loading={loading}
            keyExtractor={(row) => row.id}
            emptyTitle="No se encontraron cursos con los filtros actuales"
          />
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Curso' : 'Registrar Nuevo Curso'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre">Nombre del Curso *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. MATEMATICA APLICADA"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej. 2143"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciclo">Ciclo *</Label>
              <select
                id="ciclo"
                value={form.ciclo}
                onChange={(e) => setForm({ ...form, ciclo: Number(e.target.value) })}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((c) => (
                  <option key={c} value={c}>Ciclo {c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoCurso">Tipo de Curso</Label>
              <select
                id="tipoCurso"
                value={form.tipoCurso}
                onChange={(e) => setForm({ ...form, tipoCurso: e.target.value })}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="OB">Obligatorio (OB)</option>
                <option value="S">Especialidad (S)</option>
                <option value="OP">Opcional (OP)</option>
                <option value="EL">Electivo (EL)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departamentoId">Departamento *</Label>
              <select
                id="departamentoId"
                value={form.departamentoId}
                onChange={(e) => setForm({ ...form, departamentoId: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccione...</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="horasTeoria">Horas Teoría (T)</Label>
              <Input
                id="horasTeoria"
                type="number"
                min="0"
                value={form.horasTeoria}
                onChange={(e) => setForm({ ...form, horasTeoria: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horasPractica">Horas Práctica (P)</Label>
              <Input
                id="horasPractica"
                type="number"
                min="0"
                value={form.horasPractica}
                onChange={(e) => setForm({ ...form, horasPractica: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horasLaboratorio">Horas Lab. (L)</Label>
              <Input
                id="horasLaboratorio"
                type="number"
                min="0"
                value={form.horasLaboratorio}
                onChange={(e) => setForm({ ...form, horasLaboratorio: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditos">Créditos (C)</Label>
              <Input
                id="creditos"
                type="number"
                min="1"
                value={form.creditos}
                onChange={(e) => setForm({ ...form, creditos: Number(e.target.value) })}
              />
            </div>

            {editing && (
              <div className="space-y-2 md:col-span-2 flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="activo" className="mb-0">Curso activo (visible en el sistema)</Label>
              </div>
            )}
          </div>

          <FormModalFooter
            onCancel={() => setDialogOpen(false)}
            onSubmit={handleSave}
            saving={saving}
            submitLabel={editing ? 'Guardar Cambios' : 'Crear Curso'}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={planModalOpen} onOpenChange={(v) => { setPlanModalOpen(v); if (v) loadAllCursos(); }}>
        <DialogContent className="lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Plan de Estudio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nombre del Plan</Label>
                <Input value={planNombre} onChange={(e) => setPlanNombre(e.target.value)} placeholder="Ej. Ingeniería - 2026" />
              </div>
              <div>
                <Label>Año</Label>
                <Input type="number" value={planAnio} onChange={(e) => setPlanAnio(Number(e.target.value))} />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => { setPlanNombre(''); setPlanAnio(new Date().getFullYear()); setPlanCursos([]); }}>Limpiar</Button>
                <Button variant="default" onClick={() => setShowInlineCreate(true)}>Crear curso</Button>
              </div>
            </div>

            <div className="border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Cursos disponibles</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPlanCursos([])}>Quitar seleccionados</Button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="text-left">
                      <th className="px-2 py-1">Sel</th>
                      <th className="px-2 py-1">Código</th>
                      <th className="px-2 py-1">Nombre</th>
                      <th className="px-2 py-1">Ciclo</th>
                      <th className="px-2 py-1">Horas T</th>
                      <th className="px-2 py-1">Horas P</th>
                      <th className="px-2 py-1">Horas L</th>
                      <th className="px-2 py-1">Créditos</th>
                      <th className="px-2 py-1">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showInlineCreate && (
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <td className="px-2 py-1">&nbsp;</td>
                        <td className="px-2 py-1"><input className="w-full border rounded px-2 py-1" placeholder="Código" value={nuevoCursoForm.codigo} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, codigo: e.target.value })} /></td>
                        <td className="px-2 py-1"><input className="w-full border rounded px-2 py-1" placeholder="Nombre" value={nuevoCursoForm.nombre} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, nombre: e.target.value })} /></td>
                        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1" type="number" value={nuevoCursoForm.ciclo} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, ciclo: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1" type="number" value={nuevoCursoForm.horasTeoria} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, horasTeoria: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1" type="number" value={nuevoCursoForm.horasPractica} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, horasPractica: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1" type="number" value={nuevoCursoForm.horasLaboratorio} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, horasLaboratorio: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1" type="number" value={nuevoCursoForm.creditos} onChange={(e) => setNuevoCursoForm({ ...nuevoCursoForm, creditos: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1 flex gap-2">
                          <Button size="sm" variant="default" onClick={confirmAndCreateCurso}>Confirmar</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setShowInlineCreate(false); setNuevoCursoForm({ codigo: '', nombre: '', ciclo: 1, departamentoId: '' as number | '', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, tipoCurso: 'OB' }); }}>Cancelar</Button>
                        </td>
                      </tr>
                    )}
                    {allCursos.map((c) => {
                      const selected = planCursos.find(pc => pc.id === c.id);
                      return (
                        <tr key={c.id} className="border-t">
                          <td className="px-2 py-1">
                            <input type="checkbox" checked={!!selected} onChange={(e) => toggleCursoSeleccion(c, e.target.checked)} />
                          </td>
                          <td className="px-2 py-1">{c.codigo}</td>
                          <td className="px-2 py-1">{c.nombre}</td>
                          <td className="px-2 py-1">{c.ciclo}</td>
                          <td className="px-2 py-1">{selected ? <input className="w-16" type="number" value={selected.horasTeoria} onChange={(e) => updateHoras(selected.id, 'horasTeoria', Number(e.target.value))} /> : c.horasTeoria}</td>
                          <td className="px-2 py-1">{selected ? <input className="w-16" type="number" value={selected.horasPractica} onChange={(e) => updateHoras(selected.id, 'horasPractica', Number(e.target.value))} /> : c.horasPractica}</td>
                          <td className="px-2 py-1">{selected ? <input className="w-16" type="number" value={selected.horasLaboratorio} onChange={(e) => updateHoras(selected.id, 'horasLaboratorio', Number(e.target.value))} /> : c.horasLaboratorio}</td>
                          <td className="px-2 py-1">{selected ? <input className="w-16" type="number" value={selected.creditos} onChange={(e) => updateHoras(selected.id, 'creditos', Number(e.target.value))} /> : c.creditos}</td>
                          <td className="px-2 py-1"><Button size="sm" variant="ghost" onClick={() => removeCursoFromPlan(c.id)}>Quitar</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inline create handled inside the courses table */}
          </div>

          <FormModalFooter
            onCancel={() => setPlanModalOpen(false)}
            onSubmit={handleCreatePlan}
            saving={false}
            submitLabel="Crear Plan"
          />
        </DialogContent>
      </Dialog>

      {confirmState.open && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={() => confirmState.resolve?.(true)}
          onCancel={() => handleConfirmClose(false)}
        />
      )}
    </div>
  );
}
