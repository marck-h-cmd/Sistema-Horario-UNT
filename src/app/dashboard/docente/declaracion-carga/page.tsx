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
  { id: 'PREPARACION_Y_EVALUACION', num: 2, name: 'PREPARACIÓN Y EVALUACIÓN', desc: 'TC/DE: Máx. 50% de la carga lectiva. TP1 (20h): Exactamente 4h (requiere al menos 12h lectivas).' },
  { id: 'CONSEJERIA', num: 3, name: 'CONSEJERÍA Y TUTORÍA', desc: 'Máx. 2h (TC puede llegar a 3h solo con excepción por acreditación).' },
  { id: 'INVESTIGACION', num: 4, name: 'INVESTIGACIÓN', desc: 'TC/DE: Máx. 6h. TP1 (20h): Máx. 3h. Requiere proyecto VRI (alerta si falta).' },
  { id: 'CAPACITACION', num: 5, name: 'FORMACIÓN ACADÉMICA Y CAPACITACIÓN', desc: 'TC/DE: Máx. 2h. TP1 (20h): 0h.' },
  { id: 'ACTIVIDADES_DE_GOBIERNO', num: 6, name: 'ACTIVIDADES DE GOBIERNO / AUTORIDAD', desc: 'Solo TC/DE. Tope depende del cargo administrativo activo.' },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', num: 7, name: 'ACTIVIDADES ADMINISTRATIVAS', desc: 'Solo TC/DE. Tope depende del cargo administrativo activo.' },
  { id: 'ASESORIA_DE_TESIS', num: 8, name: 'ASESORÍA DE TESIS Y EXÁMENES PROFESIONALES', desc: 'Máx. 2h. Requiere N° de Resolución o Constancia.' },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', num: 9, name: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA (RSU)', desc: 'Máx. 2h (TC puede llegar a 3h solo con excepción por acreditación). Requiere proyecto RSU.' },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', num: 10, name: 'COMITÉS TÉCNICOS Y COMISIONES ESPECIALES', desc: 'Solo TC/DE. Presidentes de Calidad/COTECU o Comisiones designadas. Requiere resolución.' },
];

interface LectivaRespuesta {
  docente: {
    id: string;
    codigo: string;
    nombreCompleto: string;
    categoria: string;
    dedicacion: string;
    horasDedicacion: number;
    cargosActivos?: any[];
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

  const esTiempoCompleto = dataLectiva?.docente?.dedicacion === 'TIEMPO_COMPLETO_40H' || dataLectiva?.docente?.dedicacion === 'DEDICACION_EXCLUSIVA';
  const esTiempoParcial = dataLectiva?.docente?.dedicacion === 'TIEMPO_PARCIAL_20H';
  const cargoActivo = Array.isArray(dataLectiva?.docente?.cargosActivos) ? dataLectiva?.docente?.cargosActivos?.find((c: any) => c.activo !== false) : undefined;
  const tipoCargoActivo = cargoActivo?.tipoCargo as string | undefined;

  const obtenerRestriccionHoras = (actId: string, metadata: any) => {
    const lectivas = dataLectiva?.totalHorasLectivas ?? 0;

    if (esTiempoParcial) {
      if (actId === 'PREPARACION_Y_EVALUACION') return { max: 4, exact: 4 };
      if (actId === 'CONSEJERIA') return { max: 2 };
      if (actId === 'INVESTIGACION') return { max: 3 };
      if (actId === 'ASESORIA_DE_TESIS') return { max: 2 };
      if (actId === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA') return { max: 2 };
      return { max: 0 };
    }

    if (actId === 'PREPARACION_Y_EVALUACION') return { max: Math.floor(lectivas * 0.5) };
    if (actId === 'CONSEJERIA') return { max: metadata?.excepcionAcreditacion === true && esTiempoCompleto ? 3 : 2 };
    if (actId === 'INVESTIGACION') return { max: esTiempoCompleto ? 6 : 3 };
    if (actId === 'CAPACITACION') return { max: esTiempoCompleto ? 2 : 0 };
    if (actId === 'ASESORIA_DE_TESIS') return { max: 2 };
    if (actId === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA') return { max: metadata?.excepcionAcreditacion === true && esTiempoCompleto ? 3 : 2 };
    if (actId === 'COMITES_TECNICOS_Y_COMISIONES') {
      if (metadata?.esPresidenteCalidad) return { max: 10 };
      if (metadata?.esComisionGeneral) return { max: 6 };
      return { max: 0 };
    }
    if (actId === 'ACTIVIDADES_DE_GOBIERNO' || actId === 'ACTIVIDADES_DE_ADMINISTRACION') {
      let max = 2;
      if (tipoCargoActivo === 'DECANO' || tipoCargoActivo === 'DIRECTOR_DE_POSTGRADO') max = 20;
      else if (tipoCargoActivo === 'DIRECTOR_DE_ESCUELA' || tipoCargoActivo === 'JEFE_DE_DEPARTAMENTO') max = 10;
      if (metadata?.esMiembroConsejoFacultad) max = Math.max(max, 3);
      return { max };
    }
    return { max: 0 };
  };

  const validarHorasActividad = (actId: string, rawHoras: any, metadata: any) => {
    const horas = typeof rawHoras === 'string' && rawHoras === '' ? 0 : Number(rawHoras) || 0;
    if (horas <= 0) return { ok: true as const };

    const { max, exact } = obtenerRestriccionHoras(actId, metadata);
    if (actId === 'PREPARACION_Y_EVALUACION' && esTiempoParcial) {
      const lectivas = dataLectiva?.totalHorasLectivas ?? 0;
      if (lectivas < 12) return { ok: false as const, mensaje: 'Para TP1, se requiere al menos 12 horas lectivas para declarar Preparación y Evaluación.' };
      if (exact !== undefined && horas !== exact) return { ok: false as const, mensaje: `Para TP1, Preparación y Evaluación debe ser exactamente ${exact} horas.` };
    }

    if (exact !== undefined && horas !== exact) return { ok: false as const, mensaje: `La actividad debe ser exactamente ${exact} horas.` };
    if (max === 0) return { ok: false as const, mensaje: 'Esta actividad no aplica para la dedicación actual.' };
    if (horas > max) return { ok: false as const, mensaje: `El máximo permitido es ${max} horas.` };
    return { ok: true as const };
  };

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
      const cleaned = String(value ?? '').replace(/[^\d]/g, '');
      if (cleaned === '') {
        setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], horas: '' as any } }));
        return;
      }
      const numValue = Number(cleaned);
      if (!Number.isFinite(numValue)) return;
      setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: Math.max(0, numValue) } }));
      return;
    }
    setFormData(prev => ({ ...prev, [actId]: { ...prev[actId], [field]: value } }));
  };

  const handleHorasBlur = (actId: string) => {
    setFormData(prev => {
      const validacion = validarHorasActividad(actId, prev[actId]?.horas, prev[actId]?.metadata);
      if (!validacion.ok) toast.error(validacion.mensaje);
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

    for (const [id, data] of Object.entries(formData)) {
      const actDef = ACTIVIDADES_ORDENADAS.find(a => a.id === id);
      const nombre = actDef?.name ?? id;
      const horas = typeof data.horas === 'string' && data.horas === '' ? 0 : Number(data.horas) || 0;

      const validacion = validarHorasActividad(id, data.horas, data.metadata);
      if (!validacion.ok) {
        toast.error(`${nombre}: ${validacion.mensaje}`);
        return;
      }

      if (horas > 0) {
        if (id === 'ASESORIA_DE_TESIS') {
          const resolucion = String(data.metadata?.resolucion ?? '').trim();
          if (!resolucion) {
            toast.error(`${nombre}: Ingrese el Número de Resolución o Constancia.`);
            return;
          }
        }

        if (id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA') {
          const proyecto = String(data.metadata?.proyecto ?? '').trim();
          if (!proyecto) {
            toast.error(`${nombre}: Ingrese el código/nombre del proyecto RSU.`);
            return;
          }
        }

        if (id === 'ACTIVIDADES_DE_GOBIERNO' || id === 'ACTIVIDADES_DE_ADMINISTRACION') {
          const cargo = String(data.metadata?.cargo ?? '').trim();
          if (!cargo) {
            toast.error(`${nombre}: Ingrese el cargo / sustento.`);
            return;
          }
        }

        if (id === 'COMITES_TECNICOS_Y_COMISIONES') {
          const rol = data.metadata?.esPresidenteCalidad ? 'PRESIDENTE' : data.metadata?.esComisionGeneral ? 'COMISION' : '';
          if (!rol) {
            toast.error(`${nombre}: Seleccione el tipo de comisión antes de asignar horas.`);
            return;
          }
          const resolucion = String(data.metadata?.resolucion ?? '').trim();
          if (!resolucion) {
            toast.error(`${nombre}: Ingrese el número de Resolución.`);
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
        metadata: data.metadata || {},
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
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Hrs Teo + Pra</th>
                  <th className="p-3 border-r border-blue-500 dark:border-blue-800 text-center">Hrs Lab</th>
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
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-sky-50/50 dark:bg-sky-900/20">{c.teo + c.pra}</td>
                      <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/50 dark:bg-indigo-900/20">{c.lab}</td>
                      <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{totalHrs}</td>
                    </tr>
                  );
                })}
                {lineasCursos.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500">No tiene carga lectiva asignada.</td>
                  </tr>
                )}
                <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td colSpan={9} className="p-3 text-right text-slate-700 dark:text-slate-300">TOTAL HORAS LECTIVAS:</td>
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
            const horasNum = typeof data.horas === 'string' && data.horas === '' ? 0 : Number(data.horas) || 0;
            const restr = obtenerRestriccionHoras(act.id, data.metadata);
            const maxLabel = restr.exact !== undefined ? `Exacto: ${restr.exact}h` : `Máx: ${restr.max}h`;
            const inputDeshabilitado = !isEditing || restr.max === 0;

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
                    <div className="flex-1 space-y-2">
                      {act.id !== 'PREPARACION_Y_EVALUACION' && (
                        <textarea
                          disabled={!isEditing}
                          className="w-full min-h-[72px] resize-y bg-yellow-50/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-slate-200 placeholder:text-slate-400/70 transition-shadow disabled:opacity-60"
                          placeholder="Detalle de las actividades a realizar..."
                          value={data.descripcion}
                          onChange={(e) => handleFieldChange(act.id, 'descripcion', e.target.value)}
                        />
                      )}

                      {(act.id === 'CONSEJERIA' || act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA') && esTiempoCompleto && (
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 select-none">
                          <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={data.metadata?.excepcionAcreditacion === true}
                            onChange={(e) => handleMetadataChange(act.id, 'excepcionAcreditacion', e.target.checked)}
                          />
                          Excepción por acreditación (permite hasta 3h)
                        </label>
                      )}

                      {(act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 select-none">
                          <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={data.metadata?.esMiembroConsejoFacultad === true}
                            onChange={(e) => handleMetadataChange(act.id, 'esMiembroConsejoFacultad', e.target.checked)}
                          />
                          Miembro del Consejo de Facultad (máx. 3h)
                        </label>
                      )}

                      {act.id === 'COMITES_TECNICOS_Y_COMISIONES' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tipo de comisión</label>
                            <select
                              disabled={!isEditing}
                              value={data.metadata?.esPresidenteCalidad ? 'PRESIDENTE' : data.metadata?.esComisionGeneral ? 'COMISION' : ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                handleMetadataChange(act.id, 'esPresidenteCalidad', v === 'PRESIDENTE');
                                handleMetadataChange(act.id, 'esComisionGeneral', v === 'COMISION');
                              }}
                              className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                            >
                              <option value="">Seleccione…</option>
                              <option value="PRESIDENTE">Presidente Calidad/COTECU</option>
                              <option value="COMISION">Comisión Especial</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">N° Resolución</label>
                            <input
                              disabled={!isEditing}
                              type="text"
                              className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                              value={data.metadata?.resolucion || ''}
                              onChange={(e) => handleMetadataChange(act.id, 'resolucion', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {act.id === 'INVESTIGACION' && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Código / Proyecto (VRI)</label>
                          <input
                            disabled={!isEditing}
                            type="text"
                            className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                            value={data.metadata?.codigoProyecto || ''}
                            onChange={(e) => handleMetadataChange(act.id, 'codigoProyecto', e.target.value)}
                          />
                          {horasNum > 0 && !String(data.metadata?.codigoProyecto || '').trim() && (
                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                              Falta el código/proyecto (se recomienda registrarlo).
                            </div>
                          )}
                        </div>
                      )}

                      {(act.id === 'ASESORIA_DE_TESIS' || act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA' || act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {act.id === 'ASESORIA_DE_TESIS' && (
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">N° Resolución / Constancia</label>
                              <input
                                disabled={!isEditing}
                                type="text"
                                className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                                value={data.metadata?.resolucion || ''}
                                onChange={(e) => handleMetadataChange(act.id, 'resolucion', e.target.value)}
                              />
                            </div>
                          )}
                          {act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA' && (
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Proyecto RSU (código/nombre)</label>
                              <input
                                disabled={!isEditing}
                                type="text"
                                className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                                value={data.metadata?.proyecto || ''}
                                onChange={(e) => handleMetadataChange(act.id, 'proyecto', e.target.value)}
                              />
                            </div>
                          )}
                          {(act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Cargo / sustento</label>
                              <input
                                disabled={!isEditing}
                                type="text"
                                className="mt-1 w-full h-9 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 text-sm disabled:opacity-60"
                                value={data.metadata?.cargo || ''}
                                onChange={(e) => handleMetadataChange(act.id, 'cargo', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {restr.max === 0 && (
                        <div className="text-[11px] text-red-600 dark:text-red-400">
                          No aplica para la dedicación actual.
                        </div>
                      )}
                    </div>
                    <div className="w-32 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Horas:</label>
                        <input
                          disabled={inputDeshabilitado}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="w-full h-10 bg-yellow-50/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 text-center font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-shadow disabled:opacity-60"
                          value={data.horas}
                          onChange={(e) => handleFieldChange(act.id, 'horas', e.target.value)}
                          onBlur={() => handleHorasBlur(act.id)}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-right">
                        {maxLabel}
                      </div>
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
