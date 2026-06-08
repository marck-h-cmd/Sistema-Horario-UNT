'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, ArrowLeft, Info, Trash2, Plus, Calendar, Edit2 } from 'lucide-react';
import PanelDistribucionHoraria from '@/components/horarios/PanelDistribucionHoraria';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoActividadNoLectiva, TipoComponente } from '@prisma/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Actividades no lectivas ordenadas según captura
const ACTIVIDADES_ORDENADAS = [
  { id: 'PREPARACION_Y_EVALUACION', num: 2, name: 'PREPARACIÓN Y EVALUACIÓN', desc: 'Exactamente el 50% (sin redondear) del Trabajo Lectivo', reqMeta: [] as string[], getMax: (lectivas: number) => Math.floor(lectivas * 0.5), isExact: true },
  { id: 'CONSEJERIA', num: 3, name: 'CONSEJERÍA Y TUTORÍA', desc: 'Señalar número de alumnos y el ciclo académico con los que se desarrolla. (Máx. 3 horas)', reqMeta: ['numAlumnos', 'ciclo'], getMax: () => 3 },
  { id: 'INVESTIGACION', num: 4, name: 'INVESTIGACIÓN', desc: 'Consignar el nro de inscripción, código, nombre y duración del proyecto. (Máx. 6 horas)', reqMeta: ['codigoProyecto'], getMax: () => 6 },
  { id: 'CAPACITACION', num: 5, name: 'CAPACITACIÓN', desc: 'Señale lo referente a este rubro en el marco de los planes de cada Facultad (Máx. 2 horas)', reqMeta: [] as string[], getMax: () => 2 },
  { id: 'ACTIVIDADES_DE_GOBIERNO', num: 6, name: 'ACTIVIDADES DE GOBIERNO', desc: 'Se desempeña cargo indique (Máx. 2 horas)', reqMeta: ['cargo'], getMax: () => 2 },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', num: 7, name: 'ACTIVIDADES DE ADMINISTRACIÓN', desc: 'Si desempeña cargo indique (Máx. 2 horas)', reqMeta: ['cargo'], getMax: () => 2 },
  { id: 'ASESORIA_DE_TESIS', num: 8, name: 'ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL', desc: 'Indicar el número de Resolución Decanal. (Máx. 2 horas)', reqMeta: ['resolucion'], getMax: () => 2 },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', num: 9, name: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA', desc: 'Señalar actividad, proyecto o programa a ejecutarse. (Máx. 3 horas)', reqMeta: [] as string[], getMax: () => 3 },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', num: 10, name: 'COMITÉS TÉCNICOS Y COMISIONES', desc: 'Consignar el número de Resolución autoritativa. (Máx. 2 horas)', reqMeta: ['resolucion'], getMax: () => 2 },
];

interface LectivaRespuesta {
  docente: {
    id: string;
    codigo: string;
    nombreCompleto: string;
    categoria: string;
    dedicacion: string;
    horasDedicacion: number;
    departamento?: {
      nombre: string;
      facultad?: {
        nombre: string;
      };
    };
  };
  periodo: {
    id: string;
    nombre: string;
    estado: string;
  };
  asignaciones: {
    id: string;
    cursoId: string;
    cursoCodigo: string;
    cursoNombre: string;
    ciclo: number;
    grupoNombre: string | null;
    ambienteNombre: string | null;
    tipoComponente: TipoComponente;
    diaSemana: string | null;
    horaInicio: string | null;
    horaFin: string | null;
    horas: number;
    estado: string;
    alumnosAprox?: number;
    declaracion?: {
      items: any[];
    };
  }[];
  totalHorasLectivas: number;
  horasNoLectivasDisponibles: number;
  declaracion?: {
    items: any[];
  };
}

export default function DeclaracionCargaPage() {
  const { loading: authLoading } = useRequireAuth([Rol.DOCENTE]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [dataLectiva, setDataLectiva] = useState<LectivaRespuesta | null>(null);

  // Estado del formulario. Un mapa por ID de actividad.
  const [formData, setFormData] = useState<Record<string, { horas: number; descripcion: string; metadata: any }>>({});

  useEffect(() => {
    const initForm = () => {
      const initial: any = {};
      ACTIVIDADES_ORDENADAS.forEach(act => {
        initial[act.id] = { horas: 0, descripcion: '', metadata: {} };
      });
      setFormData(initial);
    };
    initForm();
    loadCargaLectiva();
  }, []);

  const loadCargaLectiva = async () => {
    setLoading(true);
    try {
      const res = await apiGet<LectivaRespuesta>('/api/declaracion/lectiva');

      if (res.data) {
        let fullData = { ...res.data };
        // Cargar declaración no lectiva existente
        const resNoL = await apiGet<any>('/api/declaracion/no-lectiva', { periodoId: res.data.periodo.id });
        if (resNoL.data?.declaracion) {
          const dec = resNoL.data.declaracion;
          fullData.declaracion = dec;
          
          setFormData(prev => {
            const next = { ...prev };
            dec.items.forEach((item: any) => {
              if (next[item.tipoActividad]) {
                next[item.tipoActividad] = {
                  horas: item.horasSemanales || 0,
                  descripcion: item.descripcion || '',
                  metadata: item.metadata || {}
                };
              }
            });
            return next;
          });
          if (dec.items.length > 0) {
            setIsEditing(false);
          } else {
            setIsEditing(true);
          }
        } else {
          setIsEditing(true);
        }
        setDataLectiva(fullData);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la información del docente');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (actId: string, field: string, value: any) => {
    if (field === 'horas') {
      if (value === '') {
        setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], horas: '' as any } }));
        return;
      }
      const numValue = Number(value);
      if (!Number.isFinite(numValue)) return;
      const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === actId);
      if (actDef && actDef.getMax) {
        const max = actDef.getMax(dataLectiva?.totalHorasLectivas || 0);
        if (numValue > max) toast.error(`El máximo permitido para ${actDef.name} es ${max} horas.`);
      }
      setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: Math.max(0, numValue) } }));
      return;
    }
    setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: value } }));
  };

  const handleHorasBlur = (actId: string) => {
    const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === actId);
    if (!actDef || !actDef.getMax) return;
    const max = actDef.getMax(dataLectiva?.totalHorasLectivas || 0);
    setFormData(prev => {
      const rawCurrent = prev[actId]?.horas;
      const current = typeof rawCurrent === 'string' && rawCurrent === '' ? 0 : Number(rawCurrent) || 0;
      if (current > max) {
        if (actDef.isExact) toast.error(`${actDef.name} debe ser exactamente ${max} horas.`);
        else toast.error(`El máximo permitido para ${actDef.name} es ${max} horas.`);
      } else if (actDef.isExact && current !== max && current !== 0) {
        toast.error(`${actDef.name} debe ser exactamente ${max} horas.`);
      }
      return prev;
    });
  };

  const handleMetadataChange = (actId: string, metaField: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [actId]: {
        ...prev[actId],
        metadata: {
          ...prev[actId].metadata,
          [metaField]: value
        }
      }
    }));
  };

  const calcularTotalHoras = () => {
    return Object.values(formData).reduce((sum, item) => sum + (Number(item.horas) || 0), 0);
  };

  const handleGuardar = async () => {
    if (!dataLectiva) return;
    
    const totalHorasDeclaradas = calcularTotalHoras();
    
    // Validación de horas totales
    if (totalHorasDeclaradas !== dataLectiva.horasNoLectivasDisponibles) {
      toast.error(`Debe declarar exactamente ${dataLectiva.horasNoLectivasDisponibles} horas no lectivas. Actualmente tiene ${totalHorasDeclaradas} horas.`);
      return;
    }

    // Validación de máximos por actividad
    for (const [id, data] of Object.entries(formData)) {
      if (data.horas > 0) {
        const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === id);
        if (actDef && actDef.getMax) {
          const max = actDef.getMax(dataLectiva.totalHorasLectivas);
          if (data.horas > max) {
            toast.error(`La actividad "${actDef.name}" excede el máximo permitido de ${max} horas.`);
            return;
          }
          if (actDef.isExact && data.horas !== max) {
            toast.error(`La actividad "${actDef.name}" debe ser exactamente ${max} horas.`);
            return;
          }
        }
      }
    }

    // Filtrar solo las que tienen horas > 0
    const itemsParaGuardar = Object.entries(formData)
      .filter(([_, data]) => data.horas > 0)
      .map(([id, data]) => ({
        tipoActividad: id as TipoActividadNoLectiva,
        horasSemanales: Number(data.horas),
        descripcion: data.descripcion,
        metadata: (() => {
          const def = ACTIVIDADES_ORDENADAS.find(a => a.id === id);
          const meta = { ...(data.metadata || {}) };
          if (def?.reqMeta?.includes('numAlumnos') && (meta.numAlumnos === undefined || meta.numAlumnos === null || meta.numAlumnos === 0)) meta.numAlumnos = 1;
          if (def?.reqMeta?.includes('ciclo') && (meta.ciclo === undefined || meta.ciclo === null || meta.ciclo === 0)) meta.ciclo = 1;
          if (def?.reqMeta?.includes('codigoProyecto') && (!meta.codigoProyecto || String(meta.codigoProyecto).trim() === '')) meta.codigoProyecto = 'N/A';
          if (def?.reqMeta?.includes('resolucion') && (!meta.resolucion || String(meta.resolucion).trim() === '')) meta.resolucion = 'N/A';
          if (def?.reqMeta?.includes('cargo') && (!meta.cargo || String(meta.cargo).trim() === '')) meta.cargo = 'N/A';
          return meta;
        })(),
      }));

    setGuardando(true);
    const loadingToastId = toast.loading('Guardando declaración de carga horaria...');
    try {
      // 1. Confirmar lectiva (necesario por la lógica de negocio subyacente)
      await apiPost<any>('/api/declaracion/lectiva/confirmar', { periodoId: dataLectiva.periodo.id }).catch(() => {}); // ignorar si ya estaba confirmada
      
      // 2. Guardar no lectiva
      await apiPost('/api/declaracion/no-lectiva', {
        periodoId: dataLectiva.periodo.id,
        items: itemsParaGuardar,
        observaciones: 'Declaración guardada desde interfaz moderna.',
      });
      
      toast.success('Declaración de carga horaria guardada exitosamente.', { id: loadingToastId });
      setIsEditing(false);
      const resNoL = await apiGet<any>('/api/declaracion/no-lectiva', { periodoId: dataLectiva.periodo.id });
      if (resNoL.data?.declaracion) {
        setDataLectiva(prev => prev ? { ...prev, declaracion: resNoL.data.declaracion } : prev);
      }
      setTimeout(() => {
        document.getElementById('horario-personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof ApiClientError ? error.message : 'Error al guardar la declaración';
      toast.error(msg, { id: loadingToastId, duration: 6000 });
    } finally {
      setGuardando(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const docente = dataLectiva!.docente;
  const periodo = dataLectiva!.periodo;
  const totalNoLectivas = calcularTotalHoras();

  // Agrupando cursos para la tabla de Trabajo Lectivo
  const cursosAgrupados = dataLectiva!.asignaciones.reduce((acc, asig) => {
    if (!acc[asig.cursoCodigo]) {
      acc[asig.cursoCodigo] = {
        codigo: asig.cursoCodigo,
        nombre: asig.cursoNombre,
        ciclo: asig.ciclo,
        secciones: new Set<string>(),
        teo: 0,
        pra: 0,
        lab: 0,
        alumnos: asig.alumnosAprox || 50 // placeholder si no existe
      };
    }
    if (asig.grupoNombre) acc[asig.cursoCodigo].secciones.add(asig.grupoNombre);
    if (asig.tipoComponente === 'TEORIA') acc[asig.cursoCodigo].teo += asig.horas;
    if (asig.tipoComponente === 'PRACTICA') acc[asig.cursoCodigo].pra += asig.horas;
    if (asig.tipoComponente === 'LABORATORIO') acc[asig.cursoCodigo].lab += asig.horas;
    return acc;
  }, {} as Record<string, any>);

  const lineasCursos = Object.values(cursosAgrupados);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16 space-y-8">
      
      {/* Encabezado Principal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-blue-600 dark:bg-blue-900 p-4 sm:px-6">
          <h1 className="text-xl font-bold text-white uppercase tracking-wide">
            CARGA HORARIA - DECLARACIÓN DE CARGA HORARIA ASIGNADA
          </h1>
          <p className="text-blue-100 text-sm mt-1">Período Académico {periodo.nombre}</p>
        </div>
        
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase">I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6">
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300 w-40">FACULTAD:</span>
              <span className="text-slate-800 dark:text-slate-100 font-medium">{'Ingeniería'}</span>
            </div>
            <div className="flex border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300 w-40">DPTO. ACADÉMICO:</span>
              <span className="text-slate-800 dark:text-slate-100 font-medium">{'Dpto. de Ingeniería de Sistemas'}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 dark:border-slate-700">
              <thead className="bg-blue-50 dark:bg-slate-800 text-blue-900 dark:text-slate-200 font-bold text-xs uppercase">
                <tr>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 text-left">NOMBRE COMPLETO</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">CONDICIÓN</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">CATEGORÍA</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 text-center">MODALIDAD</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-slate-100">
                <tr>
                  <td className="border border-slate-200 dark:border-slate-700 p-3">{docente.nombreCompleto}</td>
                  <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">NOMBRADO</td>
                  <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">{Formateadores.categoriaDocente(docente.categoria)}</td>
                  <td className="border border-slate-200 dark:border-slate-700 p-3 text-center">{Formateadores.dedicacionDocente(docente.dedicacion)} {docente.horasDedicacion} H</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 1. TRABAJO LECTIVO */}
        <div className="p-4 sm:px-6">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase">1. TRABAJO LECTIVO.- Datos completos y con claridad</h2>
          
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-blue-600 dark:bg-blue-900 text-white font-bold text-xs">
                <tr>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">CÓDIGO</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-left">NOMBRE DEL CURSO</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">SECCIÓN</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">CURSO</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Escuela Prof.</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Año o Ciclo</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Nro Tot. Alumnos</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsTeo</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsPra</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">HrsLab</th>
                  <th className="p-3 text-center">Total Hrs.</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {lineasCursos.map((c, i) => {
                  const totalHrs = c.teo + c.pra + c.lab;
                  return (
                    <tr key={i} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-xs">{c.codigo}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-medium">{c.nombre}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">{Array.from(c.secciones).join(', ') || '-'}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">OB</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Ingeniería de Sistemas</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">{c.ciclo}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Aprox. {c.alumnos}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-sky-50/50 dark:bg-sky-900/20">{c.teo}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-purple-50/50 dark:bg-purple-900/20">{c.pra}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/50 dark:bg-indigo-900/20">{c.lab}</td>
                      <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{totalHrs}</td>
                    </tr>
                  );
                })}
                {lineasCursos.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-slate-500">No tiene carga lectiva asignada.</td>
                  </tr>
                )}
                <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td colSpan={10} className="p-3 text-right text-slate-700 dark:text-slate-300">TOTAL HORAS LECTIVAS:</td>
                  <td className="p-3 text-center text-blue-700 dark:text-blue-400">{dataLectiva!.totalHorasLectivas}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECCIONES 2-10: ACTIVIDADES NO LECTIVAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-8">
        
        {/* Aviso de validación */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-400">
            <p className="font-semibold mb-1">Información importante sobre su declaración:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5 opacity-90">
              <li>Usted debe declarar exactamente <strong>{dataLectiva!.horasNoLectivasDisponibles} horas</strong> no lectivas para completar sus {docente.horasDedicacion} horas de dedicación.</li>
              <li>Ingrese una descripción y el número de horas en las actividades correspondientes.</li>
              <li>Complete los campos obligatorios que aparezcan al asignar horas a ciertas actividades (ej. Código de Proyecto).</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          {ACTIVIDADES_ORDENADAS.map((act) => {
            const data = formData[act.id];
            if (!data) return null;

            return (
              <div key={act.id} className="border-b border-slate-100 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Título y Descripción (Izquierda) */}
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">
                      {act.num}. {act.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{act.desc}</p>
                    
                  </div>

                  {/* Input Descripción y Horas (Derecha) */}
                  <div className="flex-[1.3] flex gap-4 items-start justify-end">
                    {act.id !== 'PREPARACION_Y_EVALUACION' && (
                      <div className="flex-1 relative">
                        <textarea
                          disabled={!isEditing}
                          className="w-full min-h-[72px] resize-y bg-yellow-50/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-slate-200 placeholder:text-slate-400/70 transition-shadow disabled:opacity-60"
                          placeholder="Detalle de las actividades a realizar..."
                          value={data.descripcion}
                          onChange={(e) => handleFieldChange(act.id, 'descripcion', e.target.value)}
                        />
                      </div>
                    )}
                    <div className="w-32 flex-shrink-0 flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Horas:</label>
                      <input
                        disabled={!isEditing}
                        type="number"
                        min="0"
                        className="w-full h-10 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 text-center font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-shadow disabled:opacity-60"
                        value={data.horas}
                        onChange={(e) => handleFieldChange(act.id, 'horas', e.target.value)}
                        onBlur={() => handleHorasBlur(act.id)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Totales y Botones */}
        <div className="pt-6 border-t-2 border-slate-200 dark:border-slate-700 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Horas Lectivas</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{dataLectiva!.totalHorasLectivas} h</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Horas No Lectivas</div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-0.5 rounded border-2 font-bold text-lg ${
                    totalNoLectivas === dataLectiva!.horasNoLectivasDisponibles 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                      : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                  }`}>
                    {totalNoLectivas}
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    / {dataLectiva!.horasNoLectivasDisponibles} h req.
                  </span>
                </div>
              </div>
              <div className="pl-0 sm:pl-6 border-l-0 sm:border-l border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total General</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{dataLectiva!.totalHorasLectivas + totalNoLectivas} h / {docente.horasDedicacion} h</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="gap-2 border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            
            <Button
              onClick={() => setIsEditing(true)}
              disabled={isEditing}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50"
            >
              <Edit2 className="h-4 w-4" />
              Editar Declaración
            </Button>
            
            <Button
              onClick={handleGuardar}
              disabled={!isEditing || guardando || totalNoLectivas !== dataLectiva!.horasNoLectivasDisponibles}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Declaración
            </Button>
          </div>
        </div>
      </div>

       <div id="horario-personal">
         {dataLectiva?.declaracion && dataLectiva.declaracion.items.length > 0 && (
           <PanelDistribucionHoraria
             docenteId={docente.id}
             periodoId={dataLectiva.periodo.id}
             declaracionItems={dataLectiva.declaracion.items}
             horariosLectivos={dataLectiva.asignaciones || []}
           />
         )}
       </div>
    </div>
  );
}
