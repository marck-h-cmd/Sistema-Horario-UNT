'use client';

import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol } from '@prisma/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { apiGet, ApiClientError, downloadFile } from '@/lib/api-client';
import { Loader2, FileText, Download, Clock, Users as UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { usePeriodo } from '@/contexts/PeriodoContext';

interface Estudiante {
  id: string;
  codigo: string;
  nombreCompleto: string;
  email: string;
}

interface Grupo {
  id: string;
  nombre: string;
  capacidad: number;
  estudiantes: Estudiante[];
}

interface CursoConGrupos {
  id: string;
  nombre: string;
  codigo: string;
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  horasAsignadas: number;
  grupos: Grupo[];
}

export default function DocenteCursosPage() {
  const { user, loading: authLoading } = useRequireAuth([Rol.DOCENTE]);
  const { periodoSeleccionado } = usePeriodo();
  const [cursos, setCursos] = useState<CursoConGrupos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null);
  const [docenteId, setDocenteId] = useState<string | undefined>(undefined);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!docenteId) return;
    if (!periodoSeleccionado) {
      setError('Por favor, seleccione un periodo académico en la parte superior.');
      return;
    }
    setIsDownloading(true);
    setError(null);
    try {
      await downloadFile(
        `/api/reportes/docente`,
        { docenteId, periodoId: periodoSeleccionado.id },
        `Reporte_Horario_${user?.apellidos}.pdf`
      );
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('No se pudo generar el reporte. Verifique su conexión o intente más tarde.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (user?.docenteId) {
      setDocenteId(user.docenteId);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user && !docenteId && !user.docenteId) {
      const fetchDocenteId = async () => {
        try {
          const res = await apiGet<{ id: string }>(`/api/docentes/buscar`, { usuarioId: user.id });
          if (res.data?.id) {
            setDocenteId(res.data.id);
          } else {
            setError('No se pudo encontrar el registro de docente asociado a tu usuario.');
            setLoading(false);
          }
        } catch {
          setError('Error al buscar datos del docente.');
          setLoading(false);
        }
      };
      fetchDocenteId();
    }
  }, [user, authLoading, docenteId]);

  useEffect(() => {
    if (!docenteId) return;
    const fetchCursos = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<CursoConGrupos[]>(`/api/docentes/${docenteId}/cursos`);
        const data = res.data || [];
        setCursos(data);
        if (data.length > 0) {
          setSelectedCursoId(data[0].id);
          if (data[0].grupos.length > 0) {
            setSelectedGrupoId(data[0].grupos[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar los cursos');
      } finally {
        setLoading(false);
      }
    };
    fetchCursos();
  }, [docenteId]);

  const selectedCurso = cursos.find(c => c.id === selectedCursoId);
  const selectedGrupo = selectedCurso?.grupos.find(g => g.id === selectedGrupoId);

  useEffect(() => {
    if (selectedCurso && !selectedGrupoId && selectedCurso.grupos.length > 0) {
      setSelectedGrupoId(selectedCurso.grupos[0].id);
    }
  }, [selectedCurso, selectedGrupoId]);

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  const totalHoras = cursos.reduce((acc, c) => acc + c.horasAsignadas, 0);
  const totalEstudiantes = cursos.reduce(
    (acc, c) => acc + c.grupos.reduce((gAcc, g) => gAcc + (g.estudiantes?.length || 0), 0),
    0
  );

  // ✅ Datos correctos para BarChartCard
  const chartData = cursos.map(c => ({
    codigo: c.codigo,
    estudiantes: c.grupos.reduce((acc, g) => acc + (g.estudiantes?.length || 0), 0),
  }));

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Gestión de Cursos"
        description="Visualiza tus cursos asignados y nómina de estudiantes."
        actions={
          <Link href="/dashboard/docente" className="btn-outline gap-2">
            <span className="text-lg">←</span>
            Panel Principal
          </Link>
        }
      />

      {error && <ErrorAlert message={error} />}

      {/* RESUMEN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Cursos a Cargo', value: cursos.length, icon: <Download className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Carga Horaria', value: `${totalHoras}h`, icon: <Clock className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Total Estudiantes', value: totalEstudiantes, icon: <UsersIcon className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((stat, i) => (
          <div key={i} className="card p-6 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.label}</p>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-slate-200 dark:text-slate-600" /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA */}
        <div className="lg:col-span-4 space-y-6">
          <div className="animate-fadeIn">
            {/* ✅ CORREGIDO: xKey y dataKey agregados */}
            <BarChartCard
              title="Estudiantes por Curso"
              data={chartData}
              xKey="codigo"
              dataKey="estudiantes"
              color="#c9a84c"
            />
          </div>

          <div className="card overflow-hidden border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="card-header bg-slate-50 dark:bg-slate-700/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">Mis Cursos</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-10 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-unt-blue" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Cargando...</p>
                </div>
              ) : cursos.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No tienes cursos asignados
                </div>
              ) : (
                cursos.map((curso) => (
                  <button
                    key={curso.id}
                    onClick={() => {
                      setSelectedCursoId(curso.id);
                      if (curso.grupos.length > 0) setSelectedGrupoId(curso.grupos[0].id);
                    }}
                    className={`w-full p-5 text-left transition-all ${
                      selectedCursoId === curso.id
                        ? 'bg-slate-50 dark:bg-slate-700 border-r-4 border-unt-blue'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-unt-blue">
                        {curso.codigo}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{curso.nombre}</h4>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400">Ciclo {curso.ciclo}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-500" />
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400">
                          {curso.grupos.length} Grupos
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCurso ? (
            <div className="animate-fadeIn space-y-6">
              <div className="card p-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-unt-blue">
                      {selectedCurso.codigo}
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {selectedCurso.nombre}
                    </h2>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700 px-4 py-2 border border-slate-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">Horas Totales</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedCurso.horasAsignadas}h</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Teoría', value: selectedCurso.horasTeoria, icon: '📖', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100' },
                    { label: 'Práctica', value: selectedCurso.horasPractica, icon: '✏️', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100' },
                    { label: 'Laboratorio', value: selectedCurso.horasLaboratorio, icon: '🧪', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100' },
                  ].map((h, i) => (
                    <div key={i} className={`rounded-xl border ${h.color} p-4`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">{h.label}</p>
                        <span className="text-xs">{h.icon}</span>
                      </div>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{h.value}h</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card overflow-hidden border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex flex-col border-b border-slate-100 dark:border-slate-700 sm:flex-row">
                  <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 px-6 py-4 sm:border-b-0 sm:border-r">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">Grupos</h3>
                  </div>
                  <div className="flex flex-1 gap-2 overflow-x-auto p-3">
                    {selectedCurso.grupos.map((grupo) => (
                      <button
                        key={grupo.id}
                        onClick={() => setSelectedGrupoId(grupo.id)}
                        className={`flex min-w-[100px] items-center justify-center gap-2 rounded-lg px-4 py-2 transition-all ${
                          selectedGrupoId === grupo.id
                            ? 'bg-unt-blue text-white shadow-sm'
                            : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                      >
                        <span className="text-xs font-bold">Grupo {grupo.nombre}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          selectedGrupoId === grupo.id
                            ? 'bg-white/20'
                            : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                        }`}>
                          {grupo.estudiantes?.length || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  {selectedGrupo ? (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Nómina de Estudiantes
                          </h4>
                          <p className="text-xs font-medium text-slate-400 dark:text-slate-400">
                            Grupo {selectedGrupo.nombre} • Capacidad: {selectedGrupo.capacidad} vacantes
                          </p>
                        </div>
                        <button
                          onClick={handleDownloadReport}
                          disabled={isDownloading}
                          className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                        >
                          {isDownloading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <FileText className="h-4 w-4" />
                          }
                          Descargar PDF
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/30">
                              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">Código</th>
                              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">Estudiante</th>
                              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">Correo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {selectedGrupo.estudiantes?.length > 0 ? (
                              selectedGrupo.estudiantes.map((est) => (
                                <tr key={est.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                  <td className="px-5 py-3">
                                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{est.codigo}</span>
                                  </td>
                                  <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{est.nombreCompleto}</td>
                                  <td className="px-5 py-3 text-slate-400 dark:text-slate-400">{est.email}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-5 py-10 text-center text-slate-400 dark:text-slate-400 italic">
                                  No hay estudiantes matriculados.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-400">
                        Selecciona un grupo para ver la nómina.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] card p-10 text-center border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="mb-4 text-4xl opacity-20">🎓</div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Gestión Académica</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-400 dark:text-slate-400">
                Selecciona un curso de la lista para visualizar el detalle y la nómina oficial.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}