'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2, Library, CalendarRange, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { apiGet, ApiClientError, downloadFile } from '@/lib/api-client';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePeriodo } from '@/contexts/PeriodoContext';
import { Rol } from '@prisma/client';
import { toast } from 'sonner';
import type { EntidadCatalogo } from '@/services/reportes/ReporteCatalogoService';

const TODOS = '__todos__';

interface Opt {
  id: string;
  codigo?: string;
  nombre: string;
  usuario?: { nombre: string; apellidos: string };
  curso?: { codigo: string; nombre: string };
}

type FiltrosCatalogo = Record<EntidadCatalogo, string>;

// Filtros adicionales por entidad
interface ExtraFiltros {
  docentes: { categoria: string; departamento: string };
  cursos: { ciclo: string };
  grupos: { cursoId: string };
  'carga-academica': { docenteId: string; cursoId: string };
  ambientes: Record<string, never>;
  periodos: Record<string, never>;
}

const CATEGORIAS_DOCENTE = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'ASOCIADO', label: 'Asociado' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
  { value: 'CONTRATADO', label: 'Contratado' },
  { value: 'INVITADO', label: 'Invitado' },
];

const TIPOS_AMBIENTE = [
  { value: 'AULA', label: 'Aula' },
  { value: 'LABORATORIO', label: 'Laboratorio' },
  { value: 'AUDITORIO', label: 'Auditorio' },
  { value: 'SALA_CONFERENCIAS', label: 'Sala de Conferencias' },
];

const CATALOGOS: {
  key: string;
  entidad: EntidadCatalogo;
  label: string;
  desc: string;
  labelFiltro: string;
}[] = [
  { key: 'cat-doc', entidad: 'docentes', label: 'Docentes', desc: 'Datos maestros de docentes', labelFiltro: 'Docente' },
  { key: 'cat-cur', entidad: 'cursos', label: 'Cursos', desc: 'Plan de estudios y horas', labelFiltro: 'Curso' },
  { key: 'cat-amb', entidad: 'ambientes', label: 'Ambientes', desc: 'Aulas y laboratorios', labelFiltro: 'Ambiente' },
  { key: 'cat-per', entidad: 'periodos', label: 'Períodos', desc: 'Períodos académicos', labelFiltro: 'Período' },
  { key: 'cat-gru', entidad: 'grupos', label: 'Grupos', desc: 'Grupos por curso', labelFiltro: 'Grupo' },
  { key: 'cat-car', entidad: 'carga-academica', label: 'Carga académica', desc: 'Asignaciones curso–docente', labelFiltro: 'Asignación' },
];

const FILTROS_INICIALES: FiltrosCatalogo = {
  docentes: TODOS, cursos: TODOS, ambientes: TODOS,
  periodos: TODOS, grupos: TODOS, 'carga-academica': TODOS,
};

const EXTRA_INICIAL: ExtraFiltros = {
  docentes: { categoria: '', departamento: '' },
  cursos: { ciclo: '' },
  grupos: { cursoId: '' },
  'carga-academica': { docenteId: '', cursoId: '' },
  ambientes: {},
  periodos: {},
};

function etiquetaOpcion(entidad: EntidadCatalogo, item: Opt): string {
  switch (entidad) {
    case 'docentes':
      return `${item.codigo ?? ''} — ${item.usuario ? `${item.usuario.apellidos}, ${item.usuario.nombre}` : item.nombre}`;
    case 'grupos':
      return item.curso ? `${item.curso.codigo} — Grupo ${item.nombre}` : item.nombre;
    case 'carga-academica':
      return item.nombre;
    default:
      return item.codigo ? `${item.codigo} — ${item.nombre}` : item.nombre;
  }
}

const SELECT_CLS =
  'input mt-1 h-9 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

export default function ReportesPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR]);
  const { periodoSeleccionado, loading: periodoLoading } = usePeriodo();
  const periodoId = periodoSeleccionado?.id ?? '';

  const [downloading, setDownloading] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIALES);
  const [extraFiltros, setExtraFiltros] = useState<ExtraFiltros>(EXTRA_INICIAL);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const rangoFechasInvalido = !!fechaDesde && !!fechaHasta && fechaDesde > fechaHasta;

  // Estado para nuevos reportes
  const [catCargaDocente, setCatCargaDocente] = useState('');
  const [catHorariosAmbiente, setCatHorariosAmbiente] = useState('');
  const [ambienteIdFiltro, setAmbienteIdFiltro] = useState('');

  const [opciones, setOpciones] = useState<Record<EntidadCatalogo, Opt[]>>({
    docentes: [], cursos: [], ambientes: [], periodos: [], grupos: [], 'carga-academica': [],
  });
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [errCatalogos, setErrCatalogos] = useState<string | null>(null);

  // Departamentos únicos extraídos de la lista de docentes
  const departamentosUnicos = useMemo(() => {
    const set = new Set<string>();
    (opciones.docentes as (Opt & { departamento?: string })[]).forEach((d) => {
      if (d.departamento) set.add(d.departamento);
    });
    return Array.from(set).sort();
  }, [opciones.docentes]);

  useEffect(() => {
    (async () => {
      setLoadingCatalogos(true);
      setErrCatalogos(null);
      try {
        const [docentes, cursos, ambientes, periodos, grupos, carga] = await Promise.all([
          apiGet<(Opt & { departamento?: string })[]>('/api/docentes', { limit: 500, page: 1 }),
          apiGet<Opt[]>('/api/cursos', { limit: 500, page: 1 }),
          apiGet<Opt[]>('/api/ambientes', { limit: 500, page: 1 }),
          apiGet<Opt[]>('/api/periodos', { limit: 100, page: 1 }),
          apiGet<{ id: string; nombre: string; curso: { codigo: string; nombre: string } }[]>(
            '/api/grupos', { limit: 500, page: 1 }
          ),
          apiGet<{
            id: string;
            docente: { codigo: string; usuario: { nombre: string; apellidos: string } };
            curso: { codigo: string; nombre: string };
          }[]>('/api/carga-academica', { limit: 100, page: 1 }),
        ]);

        setOpciones({
          docentes: docentes.data ?? [],
          cursos: cursos.data ?? [],
          ambientes: ambientes.data ?? [],
          periodos: periodos.data ?? [],
          grupos: (grupos.data ?? []).map((g) => ({ id: g.id, nombre: g.nombre, curso: g.curso })),
          'carga-academica': (carga.data ?? []).map((a) => ({
            id: a.id,
            nombre: `${a.docente.codigo} → ${a.curso.codigo} (${a.docente.usuario.apellidos})`,
          })),
        });
      } catch (e) {
        setErrCatalogos(e instanceof ApiClientError ? e.message : 'Error al cargar filtros');
      } finally {
        setLoadingCatalogos(false);
      }
    })();
  }, []);

  const runDownload = async (
    key: string,
    fn: () => Promise<void>,
    options?: { requierePeriodo?: boolean }
  ) => {
    if (options?.requierePeriodo !== false && !periodoId) {
      toast.error('Seleccione un período');
      return;
    }
    setDownloading(key);
    try {
      await fn();
      toast.success('Descarga iniciada');
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error en la descarga');
    } finally {
      setDownloading(null);
    }
  };

  const descargarCatalogo = (cat: (typeof CATALOGOS)[number]) => {
    const seleccion = filtros[cat.entidad];
    const esTodos = seleccion === TODOS;
    const params: Record<string, string> = {};
    if (periodoId) params.periodoId = periodoId;
    if (!esTodos) params.id = seleccion;
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    // filtros extra por entidad
    if (cat.entidad === 'docentes') {
      const ex = extraFiltros.docentes;
      if (ex.categoria) params.categoria = ex.categoria;
      if (ex.departamento) params.departamento = ex.departamento;
    } else if (cat.entidad === 'cursos') {
      const ex = extraFiltros.cursos;
      if (ex.ciclo) params.ciclo = ex.ciclo;
    } else if (cat.entidad === 'grupos') {
      const ex = extraFiltros.grupos;
      if (ex.cursoId) params.cursoId = ex.cursoId;
    } else if (cat.entidad === 'carga-academica') {
      const ex = extraFiltros['carga-academica'];
      if (ex.docenteId) params.docenteId = ex.docenteId;
      if (ex.cursoId) params.cursoId = ex.cursoId;
    }

    return downloadFile(
      `/api/reportes/catalogo/${cat.entidad}`,
      params,
      `catalogo-${cat.entidad}${esTodos ? '-todos' : `-${seleccion}`}.pdf`
    );
  };

  const setExtra = <E extends keyof ExtraFiltros>(
    entidad: E,
    campo: string,
    valor: string
  ) => {
    setExtraFiltros((prev) => ({
      ...prev,
      [entidad]: { ...(prev[entidad] as Record<string, string>), [campo]: valor },
    }));
  };

  const resumenFiltro = useMemo(() => {
    return CATALOGOS.reduce(
      (acc, c) => {
        const sel = filtros[c.entidad];
        acc[c.entidad] =
          sel === TODOS
            ? 'Todos los registros'
            : etiquetaOpcion(
                c.entidad,
                opciones[c.entidad].find((o) => o.id === sel) ?? { id: sel, nombre: sel }
              );
        return acc;
      },
      {} as Record<EntidadCatalogo, string>
    );
  }, [filtros, opciones]);

  if (authLoading || periodoLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes PDF"
        description="Informes de gestión del período, catálogos con filtros avanzados y reportes analíticos."
      />

      {!periodoId && (
        <div className="alert-warning">
          Seleccione un período académico activo para los reportes de gestión. Los catálogos
          pueden generarse sin período activo.
        </div>
      )}

      {/* ── Reportes de gestión ─────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-unt-blue dark:text-unt-gold-light">Reporte de gestión</h3>
          </div>
          <div className="card-body">
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Resumen del período: docentes, cursos, avance por categoría y ocupación de ambientes.
            </p>
            <Button
              className="w-full bg-unt-blue hover:bg-unt-blue/90 text-white"
              disabled={!!downloading || !periodoId}
              onClick={() =>
                runDownload('ges', () =>
                  downloadFile('/api/reportes/gestion', { periodoId }, `reporte-gestion-${periodoId}.pdf`)
                )
              }
            >
              <FileDown className="h-4 w-4" />
              {downloading === 'ges' ? 'Generando…' : 'Descargar'}
            </Button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-unt-blue dark:text-unt-gold-light">Reporte de conflictos</h3>
          </div>
          <div className="card-body">
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Validaciones que no cumplen en el período activo.
            </p>
            <Button
              className="w-full bg-unt-blue hover:bg-unt-blue/90 text-white"
              disabled={!!downloading || !periodoId}
              onClick={() =>
                runDownload('conf', () =>
                  downloadFile('/api/reportes/conflictos', { periodoId }, `reporte-conflictos-${periodoId}.pdf`)
                )
              }
            >
              <FileDown className="h-4 w-4" />
              {downloading === 'conf' ? 'Generando…' : 'Descargar'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Nuevos reportes analíticos ───────────────────── */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Users className="h-4 w-4 text-unt-blue dark:text-unt-gold-light" />
          <h3 className="text-sm font-semibold text-unt-blue dark:text-unt-gold-light">
            Reportes analíticos
          </h3>
        </div>
        <div className="card-body">
          <div className="grid gap-5 sm:grid-cols-2">

            {/* Carga académica por docente */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div>
                <h4 className="font-semibold text-unt-blue dark:text-unt-gold-light">
                  Carga académica por docente
                </h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Cursos asignados, horas totales y horarios por docente.
                </p>
              </div>
              <div>
                <Label htmlFor="cargaDocCat">Categoría de docente (opcional)</Label>
                <select
                  id="cargaDocCat"
                  value={catCargaDocente}
                  onChange={(e) => setCatCargaDocente(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">— Todas —</option>
                  {CATEGORIAS_DOCENTE.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <Button
                className="mt-auto w-full bg-unt-blue hover:bg-unt-blue/90 text-white"
                disabled={!!downloading}
                onClick={() =>
                  runDownload(
                    'carga-doc',
                    () => {
                      const params: Record<string, string> = {};
                      if (periodoId) params.periodoId = periodoId;
                      if (catCargaDocente) params.categoria = catCargaDocente;
                      return downloadFile(
                        '/api/reportes/carga-docente',
                        params,
                        `reporte-carga-docente${catCargaDocente ? `-${catCargaDocente.toLowerCase()}` : ''}.pdf`
                      );
                    },
                    { requierePeriodo: false }
                  )
                }
              >
                <FileDown className="h-4 w-4 shrink-0" />
                {downloading === 'carga-doc' ? 'Generando…' : 'Descargar PDF'}
              </Button>
            </div>

            {/* Horarios por ambiente */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div>
                <h4 className="font-semibold text-unt-blue dark:text-unt-gold-light">
                  Horarios por ambiente
                </h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Uso de aulas y laboratorios por día y hora en el período.
                </p>
              </div>
              <div>
                <Label htmlFor="hasTipo">Tipo de ambiente (opcional)</Label>
                <select
                  id="hasTipo"
                  value={catHorariosAmbiente}
                  onChange={(e) => { setCatHorariosAmbiente(e.target.value); setAmbienteIdFiltro(''); }}
                  className={SELECT_CLS}
                >
                  <option value="">— Todos —</option>
                  {TIPOS_AMBIENTE.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="hasAmbiente">Ambiente específico (opcional)</Label>
                <select
                  id="hasAmbiente"
                  value={ambienteIdFiltro}
                  onChange={(e) => setAmbienteIdFiltro(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">— Todos —</option>
                  {opciones.ambientes
                    .filter((a) => !catHorariosAmbiente || (a as Opt & { tipo?: string }).tipo === catHorariosAmbiente)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <Button
                className="mt-auto w-full bg-unt-blue hover:bg-unt-blue/90 text-white"
                disabled={!!downloading || !periodoId}
                onClick={() =>
                  runDownload('hor-amb', () => {
                    const params: Record<string, string> = { periodoId };
                    if (catHorariosAmbiente) params.tipo = catHorariosAmbiente;
                    if (ambienteIdFiltro) params.ambienteId = ambienteIdFiltro;
                    return downloadFile(
                      '/api/reportes/horarios-ambiente',
                      params,
                      `reporte-horarios-ambiente.pdf`
                    );
                  })
                }
              >
                <Building2 className="h-4 w-4 shrink-0" />
                {downloading === 'hor-amb' ? 'Generando…' : 'Descargar PDF'}
              </Button>
              {!periodoId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Requiere período académico activo.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Catálogos administrativos ────────────────────── */}
      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-unt-blue dark:text-unt-gold-light" />
            <h3 className="text-sm font-semibold text-unt-blue dark:text-unt-gold-light">
              Catálogos administrativos
            </h3>
          </div>
          {/* Rango de fechas */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40 sm:flex-row sm:items-end">
            <div className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Rango de fechas (opcional)
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <Label htmlFor="rep-fecha-desde" className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Desde</Label>
                <Input id="rep-fecha-desde" type="date" value={fechaDesde} max={fechaHasta || undefined}
                  onChange={(e) => setFechaDesde(e.target.value)} className="h-9 w-[150px] text-xs" />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="rep-fecha-hasta" className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Hasta</Label>
                <Input id="rep-fecha-hasta" type="date" value={fechaHasta} min={fechaDesde || undefined}
                  onChange={(e) => setFechaHasta(e.target.value)} className="h-9 w-[150px] text-xs" />
              </div>
              {(fechaDesde || fechaHasta) && (
                <Button type="button" variant="ghost" onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                  className="h-9 px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="card-body space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Combine el filtro de registro con los filtros adicionales y el rango de fechas para afinar el PDF.
            {(fechaDesde || fechaHasta) && (
              <> El rango filtra por <strong>fecha de creación</strong>.</>
            )}
          </p>

          {rangoFechasInvalido && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              La fecha <strong>Desde</strong> debe ser anterior o igual a <strong>Hasta</strong>.
            </div>
          )}

          {errCatalogos && <ErrorAlert message={errCatalogos} />}

          {loadingCatalogos ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando filtros…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATALOGOS.map((c) => {
                const lista = opciones[c.entidad];
                const seleccion = filtros[c.entidad];
                const esTodos = seleccion === TODOS;

                return (
                  <div key={c.key}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <div>
                      <h4 className="font-semibold text-unt-blue dark:text-unt-gold-light">{c.label}</h4>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.desc}</p>
                    </div>

                    {/* Selector de registro individual */}
                    <div>
                      <Label htmlFor={`filtro-${c.entidad}`}>{c.labelFiltro}</Label>
                      <select id={`filtro-${c.entidad}`} className={SELECT_CLS} value={seleccion}
                        onChange={(e) => setFiltros((prev) => ({ ...prev, [c.entidad]: e.target.value }))}>
                        <option value={TODOS}>— Todos —</option>
                        {lista.map((item) => (
                          <option key={item.id} value={item.id}>{etiquetaOpcion(c.entidad, item)}</option>
                        ))}
                      </select>
                      <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-slate-500">
                        {resumenFiltro[c.entidad]}
                      </p>
                    </div>

                    {/* ── Filtros extra por entidad ── */}
                    {c.entidad === 'docentes' && (
                      <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                        <div>
                          <Label htmlFor="doc-cat">Categoría</Label>
                          <select id="doc-cat" className={SELECT_CLS}
                            value={extraFiltros.docentes.categoria}
                            onChange={(e) => setExtra('docentes', 'categoria', e.target.value)}>
                            <option value="">— Todas —</option>
                            {CATEGORIAS_DOCENTE.map((k) => (
                              <option key={k.value} value={k.value}>{k.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="doc-dep">Departamento</Label>
                          <select id="doc-dep" className={SELECT_CLS}
                            value={extraFiltros.docentes.departamento}
                            onChange={(e) => setExtra('docentes', 'departamento', e.target.value)}>
                            <option value="">— Todos —</option>
                            {departamentosUnicos.map((dep) => (
                              <option key={dep} value={dep}>{dep}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {c.entidad === 'cursos' && (
                      <div className="border-t border-slate-100 pt-2 dark:border-slate-700">
                        <Label htmlFor="cur-ciclo">Ciclo</Label>
                        <select id="cur-ciclo" className={SELECT_CLS}
                          value={extraFiltros.cursos.ciclo}
                          onChange={(e) => setExtra('cursos', 'ciclo', e.target.value)}>
                          <option value="">— Todos —</option>
                          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                            <option key={n} value={n}>Ciclo {n}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {c.entidad === 'grupos' && (
                      <div className="border-t border-slate-100 pt-2 dark:border-slate-700">
                        <Label htmlFor="gru-cur">Curso</Label>
                        <select id="gru-cur" className={SELECT_CLS}
                          value={extraFiltros.grupos.cursoId}
                          onChange={(e) => setExtra('grupos', 'cursoId', e.target.value)}>
                          <option value="">— Todos —</option>
                          {opciones.cursos.map((cur) => (
                            <option key={cur.id} value={cur.id}>
                              {cur.codigo ? `${cur.codigo} — ${cur.nombre}` : cur.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {c.entidad === 'carga-academica' && (
                      <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                        <div>
                          <Label htmlFor="ca-doc">Docente</Label>
                          <select id="ca-doc" className={SELECT_CLS}
                            value={extraFiltros['carga-academica'].docenteId}
                            onChange={(e) => setExtra('carga-academica', 'docenteId', e.target.value)}>
                            <option value="">— Todos —</option>
                            {opciones.docentes.map((d) => (
                              <option key={d.id} value={d.id}>{etiquetaOpcion('docentes', d)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="ca-cur">Curso</Label>
                          <select id="ca-cur" className={SELECT_CLS}
                            value={extraFiltros['carga-academica'].cursoId}
                            onChange={(e) => setExtra('carga-academica', 'cursoId', e.target.value)}>
                            <option value="">— Todos —</option>
                            {opciones.cursos.map((cur) => (
                              <option key={cur.id} value={cur.id}>
                                {cur.codigo ? `${cur.codigo} — ${cur.nombre}` : cur.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <Button
                      className="mt-auto w-full bg-unt-blue hover:bg-unt-blue/90 text-white"
                      disabled={!!downloading || (!esTodos && !seleccion) || rangoFechasInvalido}
                      onClick={() =>
                        runDownload(c.key, () => descargarCatalogo(c), { requierePeriodo: false })
                      }
                    >
                      <FileDown className="h-4 w-4 shrink-0" />
                      {downloading === c.key
                        ? 'Generando…'
                        : esTodos ? 'PDF — Todos' : 'PDF — Seleccionado'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
