'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, HelpCircle, Plus, Trash2, Calendar, FileText, Check, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { apiGet, apiPost, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoActividadNoLectiva, TipoComponente } from '@prisma/client';
import { toast } from 'sonner';

// Actividades no lectivas
const ACTIVIDADES_NO_LECTIVAS = [
  { id: 'PREPARACION_Y_EVALUACION', name: 'Preparación y Evaluación', desc: 'Preparación de clases y evaluación (max. 50% de horas lectivas)' },
  { id: 'CONSEJERIA', name: 'Tutoría y Consejería', desc: 'Tutoría a estudiantes (min. 1h, requiere ciclo/alumnos)' },
  { id: 'INVESTIGACION', name: 'Investigación Científica', desc: 'Investigación autorizada (min. 4h, requiere código proyecto)' },
  { id: 'CAPACITACION', name: 'Capacitación Docente', desc: 'Perfeccionamiento (max. 5h)' },
  { id: 'ACTIVIDADES_DE_GOBIERNO', name: 'Actividades de Gobierno', desc: 'Cargos de gobierno universitario (requiere cargo)' },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', name: 'Administración Académica', desc: 'Administración en la facultad (requiere cargo)' },
  { id: 'ASESORIA_DE_TESIS', name: 'Asesoría de Tesis', desc: 'Asesor de tesis aprobado (requiere N° resolución)' },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', name: 'Responsabilidad Social (RSU)', desc: 'Proyección social o RSU (max. 2h)' },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', name: 'Comités y Comisiones', desc: 'Comités oficiales (requiere N° resolución)' },
];

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const HORAS = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);

interface LectivaRespuesta {
  docente: {
    id: string;
    codigo: string;
    nombreCompleto: string;
    categoria: string;
    dedicacion: string;
    horasDedicacion: number;
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
  }[];
  totalHorasLectivas: number;
  horasNoLectivasDisponibles: number;
}

interface DeclaracionItem {
  id?: string;
  tipoActividad: TipoActividadNoLectiva;
  horasSemanales: number;
  descripcion: string;
  metadata: {
    numAlumnos?: number;
    ciclo?: number;
    codigoProyecto?: string;
    resolucion?: string;
    cargo?: string;
  };
}

interface DistribucionItem {
  id?: string;
  declaracionItemId?: string; // temporal
  tipoActividad: TipoActividadNoLectiva;
  descripcion: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

interface ReglaCheck {
  tipoRegla: string;
  cumple: boolean;
  mensaje: string;
  metadata?: any;
}

export default function DeclaracionCargaPage() {
  const { loading: authLoading } = useRequireAuth([Rol.DOCENTE]);
  const { confirm, state: confirmState, handleClose: handleConfirmClose } = useConfirm();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Datos principales
  const [dataLectiva, setDataLectiva] = useState<LectivaRespuesta | null>(null);
  const [validacionResult, setValidacionResult] = useState<{ valido: boolean; resultados: ReglaCheck[] } | null>(null);
  const [loadingValidacion, setLoadingValidacion] = useState(false);
  
  // Formulario Paso 2 (No lectivas)
  const [itemsNoLectivas, setItemsNoLectivas] = useState<DeclaracionItem[]>([]);
  const [obsNoLectivas, setObsNoLectivas] = useState('');
  
  // Formulario Paso 3 (Distribución)
  const [clasesLectivas, setClasesLectivas] = useState<any[]>([]);
  const [distribuciones, setDistribuciones] = useState<DistribucionItem[]>([]);
  
  // Modal de asignación de horario no lectivo
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ dia: string; hora: string } | null>(null);
  const [selectedNoLectivaAct, setSelectedNoLectivaAct] = useState<string>('');
  const [duracionHoras, setDuracionHoras] = useState<number>(1);
  
  // Modal solicitud cambio
  const [cambioModalOpen, setCambioModalOpen] = useState(false);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [enviandoCambio, setEnviandoCambio] = useState(false);

  // Cargar datos lectivos iniciales
  const loadCargaLectiva = async () => {
    setLoading(true);
    try {
      const res = await apiGet<LectivaRespuesta>('/api/declaracion/lectiva');
      setDataLectiva(res.data || null);

      if (res.data) {
        // Cargar validaciones
        const resVal = await apiGet<any>('/api/declaracion/lectiva/validaciones', { periodoId: res.data.periodo.id });
        setValidacionResult(resVal.data);

        // Cargar declaración no lectiva existente
        const resNoL = await apiGet<any>('/api/declaracion/no-lectiva', { periodoId: res.data.periodo.id });
        if (resNoL.data?.declaracion) {
          const dec = resNoL.data.declaracion;
          setItemsNoLectivas(dec.items.map((i: any) => ({
            id: i.id,
            tipoActividad: i.tipoActividad,
            horasSemanales: i.horasSemanales,
            descripcion: i.descripcion || '',
            metadata: i.metadata || {},
          })));
          setObsNoLectivas(dec.observaciones || '');
        }

        // Cargar clases programadas para el grid del Paso 3
        const resLectivos = await apiGet<any[]>('/api/horario/lectivo', { periodoId: res.data.periodo.id });
        setClasesLectivas(resLectivos.data || []);

        // Cargar distribuciones existentes
        const resDist = await apiGet<any[]>('/api/horario/no-lectivo/distribucion', { periodoId: res.data.periodo.id });
        setDistribuciones(resDist.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la información del docente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCargaLectiva();
  }, []);

  // Re-validar carga lectiva (manual check)
  const handleCheckValidations = async () => {
    if (!dataLectiva) return;
    setLoadingValidacion(true);
    try {
      const resVal = await apiGet<any>('/api/declaracion/lectiva/validaciones', { periodoId: dataLectiva.periodo.id });
      setValidacionResult(resVal.data);
      if (resVal.data.valido) {
        toast.success('Todas las reglas operativas se cumplen exitosamente.');
      } else {
        toast.warning('Hay observaciones en su carga académica. Revise el panel de validaciones.');
      }
    } catch (e) {
      toast.error('Error al verificar validaciones');
    } finally {
      setLoadingValidacion(false);
    }
  };

  // Confirmar Carga Lectiva (Paso 1 -> Paso 2)
  const handleConfirmCargaLectiva = async () => {
    if (!dataLectiva) return;
    
    // Primero correr validación
    setLoadingValidacion(true);
    try {
      const resVal = await apiGet<any>('/api/declaracion/lectiva/validaciones', { periodoId: dataLectiva.periodo.id });
      setValidacionResult(resVal.data);
      
      if (!resVal.data.valido) {
        setLoadingValidacion(false);
        toast.error('No puede continuar: Debe resolver las inconsistencias de carga lectiva primero.');
        return;
      }

      const res = await apiPost<any>('/api/declaracion/lectiva/confirmar', { periodoId: dataLectiva.periodo.id }) as any;
      toast.success(res.message || 'Carga académica lectiva confirmada.');
      setStep(2);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof ApiClientError ? error.message : 'Error al confirmar carga lectiva';
      toast.error(msg);
    } finally {
      setLoadingValidacion(false);
    }
  };

  // Enviar solicitud de cambio
  const handleSendSolicitudCambio = async () => {
    if (!dataLectiva || !motivoCambio.trim()) return;
    setEnviandoCambio(true);
    try {
      await apiPost('/api/declaracion/lectiva/solicitar-cambio', {
        periodoId: dataLectiva.periodo.id,
        motivo: motivoCambio,
      });
      toast.success('Solicitud de cambio enviada al Departamento Académico');
      setCambioModalOpen(false);
      setMotivoCambio('');
    } catch (error: any) {
      const msg = error instanceof ApiClientError ? error.message : 'Error al enviar solicitud';
      toast.error(msg);
    } finally {
      setEnviandoCambio(false);
    }
  };

  // Acciones Declaración No Lectiva (Paso 2)
  const handleAddNoLectivaItem = () => {
    setItemsNoLectivas((prev) => [
      ...prev,
      {
        tipoActividad: 'PREPARACION_Y_EVALUACION',
        horasSemanales: 2,
        descripcion: '',
        metadata: {},
      },
    ]);
  };

  const handleRemoveNoLectivaItem = (index: number) => {
    setItemsNoLectivas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateNoLectivaItem = (index: number, field: keyof DeclaracionItem, value: any) => {
    setItemsNoLectivas((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      
      // Limpiar metadatos incompatibles al cambiar de actividad
      if (field === 'tipoActividad') {
        next[index].metadata = {};
      }
      return next;
    });
  };

  const handleUpdateMetadata = (index: number, subField: string, value: any) => {
    setItemsNoLectivas((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        metadata: {
          ...next[index].metadata,
          [subField]: value,
        },
      };
      return next;
    });
  };

  const totalHorasDeclaradas = itemsNoLectivas.reduce((sum, item) => sum + item.horasSemanales, 0);

  // Guardar Carga No Lectiva (Paso 2 -> Paso 3)
  const handleSaveCargaNoLectiva = async () => {
    if (!dataLectiva) return;
    
    if (totalHorasDeclaradas !== dataLectiva.horasNoLectivasDisponibles) {
      toast.error(`Debe declarar exactamente ${dataLectiva.horasNoLectivasDisponibles} horas de actividades no lectivas. Actualmente ha declarado ${totalHorasDeclaradas} horas.`);
      return;
    }

    const loadingToastId = toast.loading('Guardando declaración no lectiva...');
    try {
      const res = await apiPost('/api/declaracion/no-lectiva', {
        periodoId: dataLectiva.periodo.id,
        items: itemsNoLectivas,
        observaciones: obsNoLectivas,
      });
      
      toast.success('Declaración guardada exitosamente.', { id: loadingToastId });
      
      // Recargar datos para mapear ids correctos en la distribucion
      await loadCargaLectiva();
      setStep(3);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof ApiClientError ? error.message : 'Error al guardar la declaración';
      toast.error(msg, { id: loadingToastId, duration: 6000 });
    }
  };

  // Programación Horaria No Lectiva (Paso 3)
  const handleSlotClick = (dia: string, hora: string) => {
    // Comprobar si ya hay una clase lectiva en esa celda
    const tieneClase = clasesLectivas.some(c => c.diaSemana === dia && isTimeInBlock(hora, c.horaInicio, c.horaFin));
    if (tieneClase) {
      toast.warning('Esta hora está ocupada por una clase lectiva.');
      return;
    }

    // Comprobar si ya hay un bloque no lectivo programado
    const tieneNoLectivo = distribuciones.some(d => d.diaSemana === dia && isTimeInBlock(hora, d.horaInicio, d.horaFin));
    if (tieneNoLectivo) {
      toast.warning('Ya hay una actividad programada en este horario.');
      return;
    }

    setSelectedSlot({ dia, hora });
    
    // Seleccionar por defecto la primera actividad declarada
    if (itemsNoLectivas[0]) {
      setSelectedNoLectivaAct(itemsNoLectivas[0].tipoActividad);
    }
    setDuracionHoras(1);
    setScheduleModalOpen(true);
  };

  const handleAddScheduleBlock = () => {
    if (!selectedSlot || !selectedNoLectivaAct) return;
    
    const { dia, hora } = selectedSlot;
    const startHour = parseInt(hora.split(':')[0]);
    const endHourStr = `${String(startHour + duracionHoras).padStart(2, '0')}:00`;

    // Comprobar límites y cruces de horario para el nuevo bloque
    let tieneCruce = false;
    for (let h = startHour; h < startHour + duracionHoras; h++) {
      const checkTime = `${String(h).padStart(2, '0')}:00`;
      
      // Cruce con lectivas
      if (clasesLectivas.some(c => c.diaSemana === dia && isTimeInBlock(checkTime, c.horaInicio, c.horaFin))) {
        tieneCruce = true;
      }
      
      // Cruce con no lectivas ya puestas
      if (distribuciones.some(d => d.diaSemana === dia && isTimeInBlock(checkTime, d.horaInicio, d.horaFin))) {
        tieneCruce = true;
      }
    }

    if (startHour + duracionHoras > 22) {
      toast.error('La actividad no puede exceder las 22:00 horas.');
      return;
    }

    if (tieneCruce) {
      toast.error('El rango seleccionado se cruza con otra actividad ya programada.');
      return;
    }

    // Buscar el declaracionItemId correspondiente
    const itemDeclarado = itemsNoLectivas.find(i => i.tipoActividad === selectedNoLectivaAct);
    
    // Validar que no se exceda el total de horas de esa actividad
    const horasDistribuidasActuales = distribuciones
      .filter(d => d.tipoActividad === selectedNoLectivaAct)
      .reduce((sum, d) => sum + (parseInt(d.horaFin.split(':')[0]) - parseInt(d.horaInicio.split(':')[0])), 0);
    
    const limiteHorasActividad = itemDeclarado?.horasSemanales || 0;
    if (horasDistribuidasActuales + duracionHoras > limiteHorasActividad) {
      toast.error(`No puede asignar este bloque. Supera las ${limiteHorasActividad}h declaradas para esta actividad (actualmente asignadas: ${horasDistribuidasActuales}h).`);
      return;
    }

    // Agregar la distribución
    const nuevaDist: DistribucionItem = {
      declaracionItemId: itemDeclarado?.id,
      tipoActividad: selectedNoLectivaAct as TipoActividadNoLectiva,
      descripcion: ACTIVIDADES_NO_LECTIVAS.find(a => a.id === selectedNoLectivaAct)?.name || '',
      diaSemana: dia,
      horaInicio: hora,
      horaFin: endHourStr,
    };

    setDistribuciones((prev) => [...prev, nuevaDist]);
    setScheduleModalOpen(false);
  };

  const handleRemoveScheduleBlock = (index: number) => {
    setDistribuciones((prev) => prev.filter((_, i) => i !== index));
  };

  // Calcular horas distribuidas
  const totalHorasDistribuidas = distribuciones.reduce((sum, d) => {
    const h1 = parseInt(d.horaInicio.split(':')[0]);
    const h2 = parseInt(d.horaFin.split(':')[0]);
    return sum + (h2 - h1);
  }, 0);

  // Guardar Distribución (Paso 3 -> Paso 4)
  const handleSaveDistribucion = async () => {
    if (!dataLectiva) return;

    if (totalHorasDistribuidas !== dataLectiva.horasNoLectivasDisponibles) {
      toast.error(`Debe distribuir exactamente las ${dataLectiva.horasNoLectivasDisponibles} horas no lectivas declaradas. Actualmente ha programado ${totalHorasDistribuidas} horas.`);
      return;
    }

    const loadingToastId = toast.loading('Guardando distribución de horarios no lectivos...');
    try {
      await apiPost('/api/horario/no-lectivo/distribuir', {
        periodoId: dataLectiva.periodo.id,
        distribuciones: distribuciones.map(d => ({
          declaracionItemId: d.declaracionItemId || itemsNoLectivas.find(i => i.tipoActividad === d.tipoActividad)?.id,
          diaSemana: d.diaSemana,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
        })),
      });

      toast.success('Distribución guardada correctamente en el sistema.');
      setStep(4);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof ApiClientError ? error.message : 'Error al guardar la distribución horaria';
      toast.error(msg, { id: loadingToastId });
    }
  };

  // Helpers de tiempo para el grid del calendario
  function isTimeInBlock(timeStr: string, startStr: string | null, endStr: string | null): boolean {
    if (!startStr || !endStr) return false;
    const t = parseInt(timeStr.split(':')[0]);
    const s = parseInt(startStr.split(':')[0]);
    const e = parseInt(endStr.split(':')[0]);
    return t >= s && t < e;
  }

  function getLectivaAtSlot(dia: string, hora: string) {
    return clasesLectivas.find(c => c.diaSemana === dia && isTimeInBlock(hora, c.horaInicio, c.horaFin));
  }

  function getNoLectivaAtSlot(dia: string, hora: string) {
    return distribuciones.find(d => d.diaSemana === dia && isTimeInBlock(hora, d.horaInicio, d.horaFin));
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const docente = dataLectiva!.docente;
  const periodo = dataLectiva!.periodo;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16 space-y-6">
      
      {/* HEADER */}
      <PageHeader
        title="Declaración de Carga Horaria"
        description={`Flujo obligatorio de validación y registro de carga horaria. Período: ${periodo.nombre}.`}
        actions={
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Dedicación: {Formateadores.dedicacionDocente(docente.dedicacion)} ({docente.horasDedicacion}h)
          </div>
        }
      />

      {/* INDICADOR DE PASOS */}
      <div className="grid grid-cols-4 gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        {[
          { label: 'Carga Lectiva', icon: FileText, num: 1 },
          { label: 'Carga No Lectiva', icon: HelpCircle, num: 2 },
          { label: 'Distribución Semanal', icon: Calendar, num: 3 },
          { label: 'Confirmación Final', icon: Check, num: 4 },
        ].map((s) => {
          const ActiveIcon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;
          
          return (
            <div
              key={s.num}
              className={`flex flex-col md:flex-row items-center gap-3 p-2 rounded-xl transition-all ${
                isActive
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-semibold'
                  : isDone
                  ? 'text-emerald-500 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  isActive
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : isDone
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {isDone ? <Check className="h-4 w-4 stroke-[3]" /> : s.num}
              </div>
              <div className="text-center md:text-left space-y-0.5">
                <p className="text-2xs uppercase tracking-wider text-slate-400">Paso {s.num}</p>
                <p className="text-xs">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CONTENIDO DEL PASO ACTIVO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        
        {/* ================= PASO 1: CONFIRMACIÓN CARGA LECTIVA ================= */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paso 1: Verificación de Carga Lectiva</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Revise los cursos y grupos que el departamento le ha asignado para el período académico actual. Si nota algún error, solicite una modificación.
              </p>
            </div>

            {/* Listado de cursos */}
            {dataLectiva?.asignaciones.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                <h4 className="font-semibold text-slate-700 dark:text-slate-300">Carga Académica Vacía</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Actualmente no registra asignaciones lectivas en este período. Comuníquese con la dirección de escuela.
                </p>
              </div>
            ) : (
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="p-4 font-semibold">Código</th>
                      <th className="p-4 font-semibold">Curso</th>
                      <th className="p-4 font-semibold">Grupo</th>
                      <th className="p-4 font-semibold">Sede/Aula</th>
                      <th className="p-4 font-semibold">Componente</th>
                      <th className="p-4 font-semibold">Horario</th>
                      <th className="p-4 font-semibold text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dataLectiva?.asignaciones.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/40 text-slate-750 dark:text-slate-300">
                        <td className="p-4 font-mono font-bold text-xs">{a.cursoCodigo}</td>
                        <td className="p-4 font-medium">{a.cursoNombre}</td>
                        <td className="p-4">Grupo {a.grupoNombre}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">{a.ambienteNombre || 'No definido'}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            a.tipoComponente === 'TEORIA' ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400' : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400'
                          }`}>
                            {a.tipoComponente}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                          {a.diaSemana ? `${Formateadores.diaSemana(a.diaSemana)} de ${a.horaInicio} a ${a.horaFin}` : 'Por definir'}
                        </td>
                        <td className="p-4 text-right font-semibold">{a.horas}h</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-55/30 dark:bg-slate-900/20 font-bold border-t border-slate-200 dark:border-slate-800">
                      <td colSpan={6} className="p-4 text-slate-600 dark:text-slate-400 text-right">Total Lectivas Asignadas:</td>
                      <td className="p-4 text-right text-blue-600 dark:text-blue-400">{dataLectiva?.totalHorasLectivas}h</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Checklist de Validación */}
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                  🛡️ Panel de Validación de Carga
                </h3>
                <Button
                  onClick={handleCheckValidations}
                  disabled={loadingValidacion}
                  variant="outline"
                  size="sm"
                >
                  {loadingValidacion ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Ejecutar verificación
                </Button>
              </div>

              <div className="space-y-2.5">
                {validacionResult?.resultados.map((res, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="mt-0.5">
                      {res.cumple ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold uppercase tracking-wider text-[9px] px-2 py-0.5 rounded ${res.cumple ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'}`}>
                          {res.cumple ? 'Cumple' : 'Observado'}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {res.tipoRegla.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {res.mensaje}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
              <Button
                onClick={() => setCambioModalOpen(true)}
                variant="outline"
                className="text-red-500 hover:text-red-600 hover:bg-red-50/50"
              >
                Solicitar Modificación de Carga
              </Button>
              
              <Button
                onClick={handleConfirmCargaLectiva}
                disabled={loadingValidacion || (validacionResult ? !validacionResult.valido : false)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm rounded-xl px-5"
              >
                Confirmar y Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= PASO 2: DECLARACIÓN NO LECTIVA ================= */}
        {step === 2 && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paso 2: Declaración de Carga No Lectiva</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                De acuerdo a su dedicación docente ({docente.horasDedicacion}h) y las horas lectivas confirmadas ({dataLectiva?.totalHorasLectivas}h), debe declarar exactamente <strong className="text-blue-500">{dataLectiva?.horasNoLectivasDisponibles} horas</strong> de actividades no lectivas.
              </p>
            </div>

            {/* Listado dinámico de actividades */}
            <div className="space-y-4">
              {itemsNoLectivas.map((item, idx) => {
                const actDef = ACTIVIDADES_NO_LECTIVAS.find(a => a.id === item.tipoActividad);
                
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 max-w-sm">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Actividad</label>
                        <select
                          className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:ring-blue-500 dark:text-slate-100"
                          value={item.tipoActividad}
                          onChange={(e) => handleUpdateNoLectivaItem(idx, 'tipoActividad', e.target.value)}
                        >
                          {ACTIVIDADES_NO_LECTIVAS.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Horas Sem.</label>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:ring-blue-500 dark:text-slate-100 text-right font-semibold"
                          value={item.horasSemanales}
                          onChange={(e) => handleUpdateNoLectivaItem(idx, 'horasSemanales', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveNoLectivaItem(idx)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg self-end"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción / Observación (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Preparación de clases de Programación Orientada a Objetos"
                        className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:ring-blue-500 dark:text-slate-100"
                        value={item.descripcion}
                        onChange={(e) => handleUpdateNoLectivaItem(idx, 'descripcion', e.target.value)}
                      />
                    </div>

                    {/* Metadatos Condicionales */}
                    {item.tipoActividad === 'CONSEJERIA' && (
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-150 dark:border-slate-800 pt-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Número de Alumnos</label>
                          <input
                            type="number"
                            placeholder="Ej: 5"
                            className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-1.5 px-3 focus:ring-blue-500 dark:text-slate-100"
                            value={item.metadata.numAlumnos || ''}
                            onChange={(e) => handleUpdateMetadata(idx, 'numAlumnos', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Ciclo de Tutoría</label>
                          <input
                            type="number"
                            placeholder="Ej: 6"
                            className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-1.5 px-3 focus:ring-blue-500 dark:text-slate-100"
                            value={item.metadata.ciclo || ''}
                            onChange={(e) => handleUpdateMetadata(idx, 'ciclo', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    )}

                    {item.tipoActividad === 'INVESTIGACION' && (
                      <div className="border-t border-slate-150 dark:border-slate-800 pt-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Código del Proyecto de Investigación</label>
                          <input
                            type="text"
                            placeholder="Ej: INV-SIS-2026-042"
                            className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-1.5 px-3 focus:ring-blue-500 dark:text-slate-100"
                            value={item.metadata.codigoProyecto || ''}
                            onChange={(e) => handleUpdateMetadata(idx, 'codigoProyecto', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {(item.tipoActividad === 'ASESORIA_DE_TESIS' || item.tipoActividad === 'COMITES_TECNICOS_Y_COMISIONES') && (
                      <div className="border-t border-slate-150 dark:border-slate-800 pt-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Número de Resolución Decanal / Consejo</label>
                          <input
                            type="text"
                            placeholder="Ej: R.D. N° 124-2026-FAC-ING"
                            className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-1.5 px-3 focus:ring-blue-500 dark:text-slate-100"
                            value={item.metadata.resolucion || ''}
                            onChange={(e) => handleUpdateMetadata(idx, 'resolucion', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {(item.tipoActividad === 'ACTIVIDADES_DE_GOBIERNO' || item.tipoActividad === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                      <div className="border-t border-slate-150 dark:border-slate-800 pt-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Cargo a desempeñar</label>
                          <input
                            type="text"
                            placeholder="Ej: Secretario de Comité Académico"
                            className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-1.5 px-3 focus:ring-blue-500 dark:text-slate-100"
                            value={item.metadata.cargo || ''}
                            onChange={(e) => handleUpdateMetadata(idx, 'cargo', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {actDef && (
                      <p className="text-[11px] text-slate-400 italic">
                        📌 {actDef.desc}
                      </p>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                onClick={handleAddNoLectivaItem}
                variant="outline"
                className="w-full border-dashed border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Actividad No Lectiva
              </Button>
            </div>

            {/* Sumario de horas */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Horas No Lectivas Declaradas:</span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold px-3 py-1 rounded-lg ${totalHorasDeclaradas === dataLectiva?.horasNoLectivasDisponibles ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'}`}>
                  {totalHorasDeclaradas}h
                </span>
                <span className="text-slate-400">/</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{dataLectiva?.horasNoLectivasDisponibles}h requeridas</span>
              </div>
            </div>

            {/* Observaciones generales */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Observaciones Generales</label>
              <textarea
                className="w-full bg-white dark:bg-slate-900 rounded-lg border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:ring-blue-500 dark:text-slate-100"
                placeholder="Ingrese comentarios adicionales para el departamento académico..."
                rows={2}
                value={obsNoLectivas}
                onChange={(e) => setObsNoLectivas(e.target.value)}
              />
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              
              <Button
                onClick={handleSaveCargaNoLectiva}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm rounded-xl px-5"
              >
                Guardar y Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= PASO 3: DISTRIBUCIÓN SEMANAL ================= */}
        {step === 3 && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paso 3: Distribución Horaria Semanal</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Mapee en el calendario semanal sus clases lectivas (fijadas en azul) y coloque sus actividades no lectivas declaradas en los espacios libres disponibles.
              </p>
            </div>

            {/* Grid y Estado en fila */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Calendario Grid (9/12) */}
              <div className="lg:col-span-9 overflow-x-auto">
                <div className="min-w-[650px]">
                  {/* Días Cabecera */}
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="text-xs font-bold text-slate-400 text-center">Hora</div>
                    {DIAS.map((d) => (
                      <div key={d} className="text-xs font-bold text-slate-600 dark:text-slate-400 text-center uppercase">
                        {Formateadores.diaSemana(d)}
                      </div>
                    ))}
                  </div>

                  {/* Horas Filas */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto pr-1">
                    {HORAS.map((hora) => (
                      <div key={hora} className="grid grid-cols-7 py-1 items-center min-h-[50px]">
                        {/* Indicador Hora */}
                        <div className="text-2xs font-semibold text-slate-400 text-center font-mono">
                          {hora}
                        </div>
                        
                        {/* Días Slots */}
                        {DIAS.map((dia) => {
                          const lectiva = getLectivaAtSlot(dia, hora);
                          const noLectiva = getNoLectivaAtSlot(dia, hora);
                          
                          if (lectiva) {
                            return (
                              <div
                                key={dia}
                                className="m-0.5 p-1 rounded bg-blue-100/90 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-center flex flex-col justify-center min-h-[44px]"
                              >
                                <span className="font-mono text-[9px] font-bold text-blue-700 dark:text-blue-300 truncate">
                                  {lectiva.cursoCodigo}
                                </span>
                                <span className="text-[8px] text-blue-600 dark:text-blue-400 truncate">
                                  {lectiva.tipoComponente} ({lectiva.grupoNombre})
                                </span>
                              </div>
                            );
                          }

                          if (noLectiva) {
                            const index = distribuciones.indexOf(noLectiva);
                            return (
                              <div
                                key={dia}
                                className="m-0.5 p-1 rounded bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-900 text-center flex flex-col justify-center min-h-[44px] relative group"
                              >
                                <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300 truncate">
                                  {noLectiva.tipoActividad.replace(/_/g, ' ')}
                                </span>
                                <button
                                  onClick={() => handleRemoveScheduleBlock(index)}
                                  className="absolute top-0.5 right-0.5 hidden group-hover:block bg-red-500 text-white rounded p-0.5"
                                  title="Quitar"
                                >
                                  <Trash2 className="h-2 w-2" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={dia}
                              onClick={() => handleSlotClick(dia, hora)}
                              className="m-0.5 rounded border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer min-h-[44px]"
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estado Horas Distribuidas (3/12) */}
              <div className="lg:col-span-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Horas Declaradas</h3>
                <div className="space-y-3">
                  {itemsNoLectivas.map((item, i) => {
                    const horasD = distribuciones
                      .filter(d => d.tipoActividad === item.tipoActividad)
                      .reduce((sum, d) => {
                        const h1 = parseInt(d.horaInicio.split(':')[0]);
                        const h2 = parseInt(d.horaFin.split(':')[0]);
                        return sum + (h2 - h1);
                      }, 0);
                    
                    return (
                      <div key={i} className="text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                          <span className="truncate max-w-[120px]">{item.tipoActividad.replace(/_/g, ' ')}</span>
                          <span>{horasD} / {item.horasSemanales}h</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${horasD === item.horasSemanales ? 'bg-emerald-500' : 'bg-purple-500'}`}
                            style={{ width: `${(horasD / item.horasSemanales) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Total Programado:</span>
                    <span className={totalHorasDistribuidas === dataLectiva?.horasNoLectivasDisponibles ? 'text-emerald-500' : 'text-slate-600'}>
                      {totalHorasDistribuidas}h / {dataLectiva?.horasNoLectivasDisponibles}h
                    </span>
                  </div>
                  {totalHorasDistribuidas < dataLectiva!.horasNoLectivasDisponibles && (
                    <p className="text-[10px] text-amber-600">
                      ⚠️ Le faltan {dataLectiva!.horasNoLectivasDisponibles - totalHorasDistribuidas} horas por programar.
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              
              <Button
                onClick={handleSaveDistribucion}
                disabled={totalHorasDistribuidas !== dataLectiva?.horasNoLectivasDisponibles}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm rounded-xl px-5"
              >
                Finalizar Declaración
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= PASO 4: CONFIRMACIÓN FINAL ================= */}
        {step === 4 && (
          <div className="p-8 text-center space-y-6">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500 shadow-sm">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¡Declaración Completada!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Su carga académica lectiva y actividades no lectivas han sido correctamente declaradas, verificadas y registradas en el sistema para el período académico actual.
              </p>
            </div>

            {/* Resumen Final en caja */}
            <div className="border border-slate-150 dark:border-slate-800 rounded-2xl max-w-md mx-auto p-5 text-left bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 text-sm">Resumen Consolidado</h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Docente:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{docente.nombreCompleto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Código de Docente:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{docente.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Período Académico:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{periodo.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dedicación:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{docente.horasDedicacion} horas</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-2 font-bold text-blue-600 dark:text-blue-400">
                  <span>Horas Lectivas Asignadas:</span>
                  <span>{dataLectiva?.totalHorasLectivas}h</span>
                </div>
                <div className="flex justify-between font-bold text-purple-600 dark:text-purple-400">
                  <span>Horas No Lectivas Declaradas:</span>
                  <span>{totalHorasDeclaradas}h</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 max-w-md mx-auto">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="w-full"
              >
                Volver a Revisar Carga
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* DIALOG DE SOLICITUD DE CAMBIO (PASO 1) */}
      <ConfirmDialog
        open={cambioModalOpen}
        title="Solicitud de Modificación de Carga"
        message={
          <div className="space-y-3 py-2 text-left">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Describa detalladamente el motivo o corrección necesaria (ej: cruce horaria con otra institución, error en asignación de curso, etc.).
            </p>
            <textarea
              className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              rows={3}
              placeholder="Escriba los detalles aquí..."
              value={motivoCambio}
              onChange={(e) => setMotivoCambio(e.target.value)}
            />
          </div>
        }
        confirmLabel={enviandoCambio ? 'Enviando...' : 'Enviar Solicitud'}
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleSendSolicitudCambio}
        onCancel={() => setCambioModalOpen(false)}
      />

      {/* MODAL HORARIO NO LECTIVO (PASO 3) */}
      <ConfirmDialog
        open={scheduleModalOpen}
        title="Programar Actividad No Lectiva"
        message={
          <div className="space-y-4 py-2 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Actividad</label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:outline-none dark:text-slate-100"
                value={selectedNoLectivaAct}
                onChange={(e) => setSelectedNoLectivaAct(e.target.value)}
              >
                {itemsNoLectivas.map((item) => (
                  <option key={item.tipoActividad} value={item.tipoActividad}>
                    {item.tipoActividad.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Duración (Horas)</label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 px-3 focus:outline-none dark:text-slate-100"
                value={duracionHoras}
                onChange={(e) => setDuracionHoras(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4].map(h => (
                  <option key={h} value={h}>{h} {h === 1 ? 'Hora' : 'Horas'}</option>
                ))}
              </select>
            </div>
            
            {selectedSlot && (
              <p className="text-2xs text-slate-400">
                Dia: {selectedSlot.dia} | Inicio: {selectedSlot.hora}
              </p>
            )}
          </div>
        }
        confirmLabel="Programar"
        cancelLabel="Cancelar"
        variant="default"
        onConfirm={handleAddScheduleBlock}
        onCancel={() => setScheduleModalOpen(false)}
      />

      {/* CONFIRMAR DIALOG GENÉRICO */}
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
