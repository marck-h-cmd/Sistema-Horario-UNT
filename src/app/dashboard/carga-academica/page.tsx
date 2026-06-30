'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Search, Save, ArrowLeft, Info, Plus, Trash2, BookOpen, Edit2, UserX, AlertCircle, Calendar } from 'lucide-react';
import PanelDistribucionHoraria from '@/components/horarios/PanelDistribucionHoraria';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPost, apiRequest, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, TipoActividadNoLectiva, TipoComponente } from '@prisma/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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

interface Periodo {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Docente {
  id: string;
  codigo: string;
  nombreCompleto: string;
  categoria: string;
  departamento?: string;
  horasLectivasAsignadas: number;
}

interface CursoDisponible {
  id: string;
  codigo: string;
  nombre: string;
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  grupos: {
    id: string;
    nombre: string;
    asignaciones: any[];
  }[];
}

interface PlanEstudio {
  id: string;
  nombre: string;
  anio: number;
  activo: boolean;
}

export default function CargaAcademicaAdminPage() {
  const { loading: authLoading } = useRequireAuth([Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.OPERADOR]);

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [searchDocente, setSearchDocente] = useState('');
  const [selectedDocenteId, setSelectedDocenteId] = useState<string>('');
  
  const [dataLectiva, setDataLectiva] = useState<any | null>(null);
  const [loadingDocenteData, setLoadingDocenteData] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [formData, setFormData] = useState<Record<string, { horas: number; descripcion: string; metadata: any }>>({});
  const [isEditing, setIsEditing] = useState(true);
  const [horarioHabilitado, setHorarioHabilitado] = useState(false);

  useEffect(() => {
    if (dataLectiva?.declaracion && dataLectiva.declaracion.items.length > 0) {
      setHorarioHabilitado(true);
    }
  }, [dataLectiva]);
  
  // Estado para Modal de Asignar Curso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsignacion, setEditingAsignacion] = useState<{
    ids: string[];
    cursoId: string;
    grupoNombre: string;
    componentes: TipoComponente[];
    planEstudioId: string;
    tieneProgramacion: boolean;
  } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planesEstudio, setPlanesEstudio] = useState<PlanEstudio[]>([]);
  const [selectedPlanEstudioId, setSelectedPlanEstudioId] = useState<string>('');
  const [cursosDisponibles, setCursosDisponibles] = useState<CursoDisponible[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<string>('');
  const [selectedGrupoNombre, setSelectedGrupoNombre] = useState<string>('A');
  const [selectedComponentes, setSelectedComponentes] = useState<TipoComponente[]>([]);

  const esTiempoCompleto = dataLectiva?.docente?.dedicacion === 'TIEMPO_COMPLETO_40H' || dataLectiva?.docente?.dedicacion === 'DEDICACION_EXCLUSIVA';
  const esTiempoParcial = dataLectiva?.docente?.dedicacion === 'TIEMPO_PARCIAL_20H';
  const cargoActivo = Array.isArray(dataLectiva?.docente?.cargosActivos) ? dataLectiva.docente.cargosActivos.find((c: any) => c.activo !== false) : undefined;
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

  const obtenerDescripcionSencilla = (actId: string, metadata: any) => {
    const lectivas = dataLectiva?.totalHorasLectivas ?? 0;
    const restr = obtenerRestriccionHoras(actId, metadata);
    const maxHoras = restr.max;

    if (esTiempoParcial) {
      switch (actId) {
        case 'PREPARACION_Y_EVALUACION':
          return `Regla para Tiempo Parcial: Requiere al menos 12 horas lectivas y se deben asignar exactamente 4 horas. (Tus horas lectivas actuales: ${lectivas}h).`;
        case 'CONSEJERIA':
          return 'Regla para Tiempo Parcial: Se permite asignar un máximo de 2 horas semanales.';
        case 'INVESTIGACION':
          return 'Regla para Tiempo Parcial: Se permite asignar un máximo de 3 horas semanales. Requiere contar con un proyecto de investigación VRI registrado.';
        case 'CAPACITACION':
          return 'Regla para Tiempo Parcial: No se permiten asignar horas de capacitación en esta modalidad.';
        case 'ACTIVIDADES_DE_GOBIERNO':
        case 'ACTIVIDADES_DE_ADMINISTRACION':
          return 'Regla para Tiempo Parcial: Esta actividad no está disponible para docentes a tiempo parcial.';
        case 'ASESORIA_DE_TESIS':
          return 'Regla para Tiempo Parcial: Se permite asignar un máximo de 2 horas semanales. Es necesario indicar el N° de Resolución o Constancia.';
        case 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA':
          return 'Regla para Tiempo Parcial: Se permite asignar un máximo de 2 horas semanales. Requiere ingresar el código o nombre del proyecto RSU.';
        case 'COMITES_TECNICOS_Y_COMISIONES':
          return 'Regla para Tiempo Parcial: No se permiten asignar horas para comisiones en esta modalidad.';
        default:
          return 'No disponible para tu modalidad actual.';
      }
    }

    if (esTiempoCompleto) {
      switch (actId) {
        case 'PREPARACION_Y_EVALUACION':
          return `Regla para Tiempo Completo / DE: Se permite asignar hasta el 50% de tus horas de clases asignadas (Máximo actual permitido: ${maxHoras}h, basado en tus ${lectivas}h de clases).`;
        case 'CONSEJERIA':
          return `Regla para Tiempo Completo / DE: Máximo 2 horas semanales (puede extenderse hasta 3 horas si marcas abajo la opción de acreditación).`;
        case 'INVESTIGACION':
          return 'Regla para Tiempo Completo / DE: Se permite asignar un máximo de 6 horas semanales. Requiere contar con un proyecto de investigación VRI registrado.';
        case 'CAPACITACION':
          return 'Regla para Tiempo Completo / DE: Se permite asignar un máximo de 2 horas semanales para capacitación o formación.';
        case 'ACTIVIDADES_DE_GOBIERNO':
        case 'ACTIVIDADES_DE_ADMINISTRACION':
          return `Regla para Tiempo Completo / DE: El límite de horas se define por tu cargo administrativo activo (Decanos y Postgrado: máx 20h; Directores y Jefes: máx 10h; miembros de Consejo de Facultad: máx 3h; otros cargos: máx 2h). Máximo actual: ${maxHoras}h.`;
        case 'ASESORIA_DE_TESIS':
          return 'Regla para Tiempo Completo / DE: Se permite asignar un máximo de 2 horas semanales. Requiere ingresar el N° de Resolución o Constancia.';
        case 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA':
          return `Regla para Tiempo Completo / DE: Máximo 2 horas semanales (puede extenderse hasta 3 horas si marcas abajo la opción de acreditación). Requiere indicar el nombre o código del proyecto RSU.`;
        case 'COMITES_TECNICOS_Y_COMISIONES':
          return `Regla para Tiempo Completo / DE: Disponible para presidentes de comités o miembros de comisiones. Permite hasta 10 horas si eres Presidente de Calidad/COTECU, o hasta 6 horas para comisiones especiales (selecciona tu caso abajo). Requiere número de Resolución.`;
        default:
          return 'No disponible para tu modalidad actual.';
      }
    }

    return '';
  };

  // 1. Cargar Períodos
  useEffect(() => {
    async function loadPeriodos() {
      try {
        const res = await apiGet<any>('/api/periodos', { limit: 100 });
        const list = Array.isArray(res.data) ? res.data : [];
        setPeriodos(list);
        const active = list.find((p: Periodo) => p.activo) || list[0];
        if (active) setSelectedPeriodoId(active.id);
      } catch (error) {
        toast.error('Error al cargar períodos');
      }
    }
    loadPeriodos();
  }, []);

  // 2. Cargar Docentes cuando cambie el período
  useEffect(() => {
    if (!selectedPeriodoId) return;
    async function loadDocentes() {
      try {
        const res = await apiGet<Docente[]>('/api/asignacion/docentes', { periodoId: selectedPeriodoId });
        setDocentes(res.data || []);
      } catch (error) {
        toast.error('Error al cargar docentes');
      }
    }
    loadDocentes();
  }, [selectedPeriodoId]);

  // 3. Cargar datos de Declaración cuando se selecciona un docente
  useEffect(() => {
    if (!selectedPeriodoId || !selectedDocenteId) {
      setDataLectiva(null);
      return;
    }
    
    async function loadData() {
      setLoadingDocenteData(true);
      try {
        // Inicializar form vacío
        const initial: any = {};
        ACTIVIDADES_ORDENADAS.forEach(act => {
          initial[act.id] = { horas: 0, descripcion: '', metadata: {} };
        });
        setFormData(initial);

        // Traer Lectiva
        const resL = await apiGet<any>('/api/declaracion/lectiva', { 
          periodoId: selectedPeriodoId, 
          docenteId: selectedDocenteId 
        });
        setDataLectiva(resL.data);

        // Traer No Lectiva
        const resNL = await apiGet<any>('/api/declaracion/no-lectiva', { 
          periodoId: selectedPeriodoId,
          docenteId: selectedDocenteId
        });
        if (resNL.data?.declaracion) {
          const dec = resNL.data.declaracion;
          setDataLectiva((prev: any) => prev ? { ...prev, declaracion: dec } : prev);
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
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar la declaración del docente');
      } finally {
        setLoadingDocenteData(false);
      }
    }
    loadData();
  }, [selectedPeriodoId, selectedDocenteId]);

  // Manejo de Modal de Cursos
  const abrirModalAsignacion = async () => {
    setIsModalOpen(true);
    setSelectedCursoId('');
    setSelectedGrupoNombre('A');
    setSelectedComponentes([]);
    
    try {
      if (planesEstudio.length === 0) {
        const resPlanes = await apiGet<PlanEstudio[]>('/api/planes-estudio');
        const planes = resPlanes.data || [];
        setPlanesEstudio(planes);
        const planActivo = planes.find(p => p.activo);
        if (planActivo) {
          setSelectedPlanEstudioId(planActivo.id);
        } else if (planes.length > 0) {
          setSelectedPlanEstudioId(planes[0].id);
        }
      }
    } catch (error) {
      toast.error('Error al cargar currículas');
    }
  };

  useEffect(() => {
    if (isModalOpen && selectedPeriodoId && selectedPlanEstudioId) {
      const loadCursos = async () => {
        try {
          const res = await apiGet<CursoDisponible[]>('/api/asignacion/cursos-disponibles', { 
            periodoId: selectedPeriodoId,
            planEstudioId: selectedPlanEstudioId
          });
          setCursosDisponibles(res.data || []);
        } catch (error) {
          toast.error('Error al cargar cursos disponibles');
        }
      };
      loadCursos();
    }
  }, [isModalOpen, selectedPeriodoId, selectedPlanEstudioId]);

  const abrirModalEdicion = async (c: any) => {
    try {
      if (planesEstudio.length === 0) {
        const resPlanes = await apiGet<PlanEstudio[]>('/api/planes-estudio');
        const planes = resPlanes.data || [];
        setPlanesEstudio(planes);
      }
      
      const targetPlanId = c.planEstudioId || selectedPlanEstudioId || planesEstudio.find(p => p.activo)?.id || planesEstudio[0]?.id;
      
      setSelectedPlanEstudioId(targetPlanId);
      setSelectedCursoId(c.cursoId);
      setSelectedGrupoNombre(c.seccion);
      
      const comps: TipoComponente[] = [];
      if (c.teo > 0) comps.push('TEORIA');
      if (c.pra > 0) comps.push('PRACTICA');
      if (c.lab > 0) comps.push('LABORATORIO');
      setSelectedComponentes(comps);
      
      setEditingAsignacion({
        ids: c.ids,
        cursoId: c.cursoId,
        grupoNombre: c.seccion,
        componentes: comps,
        planEstudioId: targetPlanId,
        tieneProgramacion: !!c.tieneProgramacion
      });
      
      setIsModalOpen(true);
    } catch (error) {
      toast.error('Error al preparar la edición');
    }
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setEditingAsignacion(null);
  };

  const ejecutarAsignacion = async () => {
    if (!selectedCursoId || !selectedGrupoNombre || selectedComponentes.length === 0) {
      toast.error('Complete todos los campos de asignación');
      return;
    }
    try {
      if (editingAsignacion) {
        // Eliminar horarios anteriores
        await Promise.all(editingAsignacion.ids.map(id => apiRequest(`/api/asignacion/carga-lectiva/${id}`, { method: 'DELETE' })));
      }

      await apiPost('/api/asignacion/carga-lectiva', {
        periodoId: selectedPeriodoId,
        docenteId: selectedDocenteId,
        cursoId: selectedCursoId,
        grupoNombre: selectedGrupoNombre.trim().toUpperCase() || 'A',
        componentes: selectedComponentes
      });

      toast.success(editingAsignacion ? 'Asignación modificada exitosamente' : 'Curso asignado exitosamente');
      setIsModalOpen(false);
      setIsConfirmModalOpen(false);
      setEditingAsignacion(null);

      // Recargar datos
      const resL = await apiGet<any>('/api/declaracion/lectiva', { 
        periodoId: selectedPeriodoId, 
        docenteId: selectedDocenteId 
      });
      setDataLectiva(resL.data);
    } catch (error: any) {
      toast.error(error instanceof ApiClientError ? error.message : 'Error al asignar curso');
    }
  };

  const asignarCurso = () => {
    if (!selectedCursoId || !selectedGrupoNombre || selectedComponentes.length === 0) {
      toast.error('Complete todos los campos de asignación');
      return;
    }

    if (editingAsignacion) {
      setIsConfirmModalOpen(true);
    } else {
      ejecutarAsignacion();
    }
  };

  const eliminarAsignacion = async (horarioIds: string[]) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) return;
    try {
      await Promise.all(horarioIds.map(id => apiRequest(`/api/asignacion/carga-lectiva/${id}`, { method: 'DELETE' })));
      toast.success('Asignación eliminada');
      // Recargar
      const resL = await apiGet<any>('/api/declaracion/lectiva', { 
        periodoId: selectedPeriodoId, 
        docenteId: selectedDocenteId 
      });
      setDataLectiva(resL.data);
    } catch (error: any) {
      toast.error('Error al eliminar asignación');
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
      [actId]: { ...prev[actId], metadata: { ...prev[actId].metadata, [metaField]: value } }
    }));
  };

  const calcularTotalHoras = () => {
    return Object.values(formData).reduce((sum, item) => sum + (Number(item.horas) || 0), 0);
  };

  const handleGuardarNoLectiva = async () => {
    if (!dataLectiva) return;
    
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

    const itemsParaGuardar = Object.entries(formData)
      .filter(([_, data]) => data.horas > 0)
      .map(([id, data]) => ({
        tipoActividad: id as TipoActividadNoLectiva,
        horasSemanales: Number(data.horas),
        descripcion: data.descripcion,
        metadata: data.metadata || {},
      }));

    setGuardando(true);
    try {
      await apiPost(`/api/declaracion/no-lectiva?docenteId=${selectedDocenteId}`, {
        periodoId: selectedPeriodoId,
        items: itemsParaGuardar,
        observaciones: 'Guardado por el Administrador.',
      });
      toast.success('Declaración guardada exitosamente.');
      setIsEditing(false);
      const resNL = await apiGet<any>('/api/declaracion/no-lectiva', { periodoId: selectedPeriodoId, docenteId: selectedDocenteId });
      if (resNL.data?.declaracion) {
        setDataLectiva((prev: any) => prev ? { ...prev, declaracion: resNL.data.declaracion } : prev);
      }
      setTimeout(() => {
        document.getElementById('horario-personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (error: any) {
      toast.error(error instanceof ApiClientError ? error.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const clickHorario = async () => {
    if (isEditing) {
      await handleGuardarNoLectiva();
    }
    setHorarioHabilitado(true);
    setTimeout(() => {
      document.getElementById('horario-personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const docentesFiltrados = useMemo(() => {
    return docentes.filter(d => 
      d.nombreCompleto.toLowerCase().includes(searchDocente.toLowerCase()) || 
      d.codigo.toLowerCase().includes(searchDocente.toLowerCase())
    );
  }, [docentes, searchDocente]);

  if (authLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

  const docenteInfo = dataLectiva?.docente;
  const asignaciones = dataLectiva?.asignaciones || [];
  const totalNoLectivas = calcularTotalHoras();

  const cursosAgrupados = asignaciones.reduce((acc: any, asig: any) => {
    const key = asig.cursoCodigo;
    if (!acc[key]) {
      acc[key] = {
        ids: [],
        cursoId: asig.cursoId,
        planEstudioId: asig.planEstudioId,
        codigo: asig.cursoCodigo,
        nombre: asig.cursoNombre,
        ciclo: asig.ciclo,
        secciones: new Set<string>(),
        teo: 0,
        pra: 0,
        lab: 0,
        alumnos: asig.alumnosAprox || 50,
        tieneProgramacion: false
      };
    }
    acc[key].ids.push(asig.id);
    if (asig.grupoNombre) acc[key].secciones.add(asig.grupoNombre);
    
    if (asig.tipoComponente === 'TEORIA') acc[key].teo += asig.horas;
    if (asig.tipoComponente === 'PRACTICA') acc[key].pra += asig.horas;
    if (asig.tipoComponente === 'LABORATORIO') acc[key].lab += asig.horas;
    if (asig.diaSemana || asig.horaInicio || asig.ambienteId) {
      acc[key].tieneProgramacion = true;
    }
    return acc;
  }, {} as Record<string, any>);
  const lineasCursos = Object.values(cursosAgrupados);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fadeIn">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Carga Académica" 
          description="Gestione y asigne la carga lectiva y no lectiva de los docentes."
        />
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Período:</label>
          <select
            value={selectedPeriodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-800 dark:text-slate-250 shadow-sm focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/5 cursor-pointer transition-colors duration-150"
          >
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.activo ? '(Activo)' : ''}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mt-6 gap-6">
        {/* Sidebar: Lista de Docentes */}
        <div className="w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-550 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <BookOpen className="h-4 w-4 text-primary" /> Docentes
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Buscar docente..."
                value={searchDocente}
                onChange={e => setSearchDocente(e.target.value)}
                className="input w-full pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {docentesFiltrados.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDocenteId(d.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all duration-150 border-l-4 ${
                  selectedDocenteId === d.id 
                    ? 'bg-primary/5 border-primary text-primary font-semibold dark:bg-primary/15' 
                    : 'border-transparent text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="font-semibold truncate">{d.nombreCompleto}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                  <span className="font-mono text-[11px] opacity-80">{d.codigo}</span>
                  <span className={d.horasLectivasAsignadas > 0 ? 'text-primary font-semibold' : 'opacity-70'}>
                    {d.horasLectivasAsignadas}h asignadas
                  </span>
                </div>
              </button>
            ))}
            {docentesFiltrados.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-550 text-sm p-4">No hay docentes.</div>
            )}
          </div>
        </div>

        {/* Contenido Principal: Declaración de Carga */}
        <div className="flex-1 overflow-y-auto pr-2 pb-16 custom-scrollbar">
          {!selectedDocenteId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-550 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80">
              <BookOpen className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-700 opacity-60" />
              <p className="text-sm font-semibold">Seleccione un docente para gestionar su carga horaria.</p>
            </div>
          ) : loadingDocenteData ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : dataLectiva ? (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Encabezado PDF-like */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary to-indigo-700 dark:from-primary-900/60 dark:to-indigo-950/60 p-5 sm:px-6 border-b border-primary/10">
                  <h1 className="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
                    CARGA HORARIA - DECLARACIÓN DE CARGA HORARIA ASIGNADA
                  </h1>
                  <p className="text-indigo-100 dark:text-indigo-200/90 text-xs mt-1 font-medium">Período Académico {dataLectiva.periodo.nombre}</p>
                </div>
                
                <div className="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                  <h2 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 mb-4 uppercase tracking-wider">I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/50 dark:border-slate-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase w-32 flex-shrink-0">FACULTAD:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-semibold text-sm">Ingeniería</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/50 dark:border-slate-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase w-32 flex-shrink-0">DPTO. ACADÉMICO:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-semibold text-sm">{docenteInfo.departamento?.nombre || 'Dpto. de Ingeniería de Sistemas'}</span>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="py-2.5">NOMBRE COMPLETO</th>
                          <th className="text-center py-2.5">CONDICIÓN</th>
                          <th className="text-center py-2.5">CATEGORÍA</th>
                          <th className="text-center py-2.5">MODALIDAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-transparent">
                          <td className="font-semibold text-slate-900 dark:text-slate-50 py-3">{docenteInfo.nombreCompleto}</td>
                          <td className="text-center py-3"><span className="badge badge-gray">NOMBRADO</span></td>
                          <td className="text-center py-3">{Formateadores.categoriaDocente(docenteInfo.categoria)}</td>
                          <td className="text-center font-medium text-slate-800 dark:text-slate-200 py-3">
                            {Formateadores.dedicacionDocente(docenteInfo.dedicacion)} - {docenteInfo.horasDedicacion}H
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 1. TRABAJO LECTIVO */}
                <div className="p-5 sm:px-6">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="h-4 w-1 bg-blue-600 rounded"></span>
                      Carga horaria lectiva
                    </h2>
                    <Button 
                      size="sm" 
                      onClick={abrirModalAsignacion} 
                      className="btn-primary h-8 text-xs font-semibold px-3 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Asignar Curso
                    </Button>
                  </div>
                  
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="text-center py-2.5">CÓDIGO</th>
                          <th className="py-2.5">NOMBRE DEL CURSO</th>
                          <th className="text-center py-2.5">SECCIÓN</th>
                          <th className="text-center py-2.5">TIPO</th>
                          <th className="text-center py-2.5">Escuela Prof.</th>
                          <th className="text-center py-2.5">Ciclo</th>
                          <th className="text-center py-2.5">Alumnos</th>
                          <th className="text-center py-2.5">Teo + Pra</th>
                          <th className="text-center py-2.5">Lab</th>
                          <th className="text-center py-2.5">Total Hrs.</th>
                          <th className="text-center py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasCursos.map((c: any, i: number) => {
                          const totalHrs = c.teo + c.pra + c.lab;
                          return (
                            <tr key={i} className="group">
                              <td className="text-center font-mono text-xs text-slate-500 dark:text-slate-400 py-3">{c.codigo}</td>
                              <td className="font-semibold text-slate-800 dark:text-slate-100 py-3">{c.nombre}</td>
                              <td className="text-center font-bold text-primary py-3">{Array.from(c.secciones).join(', ') || '-'}</td>
                              <td className="text-center py-3"><span className="badge badge-gray">OB</span></td>
                              <td className="text-center text-slate-500 dark:text-slate-400 py-3">Ing. Sistemas</td>
                              <td className="text-center font-medium py-3">{c.ciclo}</td>
                              <td className="text-center text-slate-500 dark:text-slate-400 py-3">Aprox. {c.alumnos}</td>
                              <td className="text-center font-medium text-sky-650 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 py-3">{c.teo + c.pra}</td>
                              <td className="text-center font-medium text-indigo-650 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 py-3">{c.lab}</td>
                              <td className="text-center font-bold text-indigo-700 dark:text-indigo-300 bg-primary/5 dark:bg-primary/10 py-3">{totalHrs}</td>
                              <td className="py-3 pr-4">
                                <div className="table-actions">
                                  <button 
                                    onClick={() => abrirModalEdicion(c)}
                                    className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-all duration-150"
                                    title="Editar asignación"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => eliminarAsignacion(c.ids)}
                                    className="p-1 rounded-md text-red-500 hover:text-red-755 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 transition-all duration-150"
                                    title="Eliminar asignación"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {lineasCursos.length === 0 && (
                          <tr>
                            <td colSpan={11} className="p-6 text-center text-slate-450 dark:text-slate-550">No tiene carga lectiva asignada.</td>
                          </tr>
                        )}
                        <tr className="bg-slate-50/30 dark:bg-slate-800/20 font-bold border-t border-slate-200 dark:border-slate-800 hover:bg-transparent">
                          <td colSpan={9} className="p-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TOTAL HORAS LECTIVAS:</td>
                          <td className="p-4 text-center text-base font-extrabold text-primary bg-primary/5 dark:bg-primary/10">{dataLectiva.totalHorasLectivas}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECCIONES 2-10: ACTIVIDADES NO LECTIVAS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 sm:p-6 shadow-sm space-y-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b pb-2 flex items-center gap-2">
                  <span className="h-4 w-1 bg-amber-500 rounded"></span>
                  Carga horaria no lectiva
                </h2>
                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200/40 dark:border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-slate-705 dark:text-slate-350">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Información sobre la declaración No Lectiva:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 opacity-90 text-xs">
                      <li>El docente debe declarar exactamente <strong>{dataLectiva.horasNoLectivasDisponibles} horas</strong> no lectivas.</li>
                      <li>Como administrador, usted puede visualizar o modificar esta información si es necesario.</li>
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
                      <div key={act.id} className="border-b border-slate-100 dark:border-slate-850 pb-6 last:border-0 last:pb-0">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 space-y-1">
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{act.num}. {act.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-455 font-medium bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800/60 leading-relaxed mt-1 text-justify">
                              {obtenerDescripcionSencilla(act.id, data.metadata)}
                            </p>
                          </div>
                          <div className="flex-[1.3] flex gap-4 items-start justify-end">
                            <div className="flex-1 space-y-2">
                              {act.id !== 'PREPARACION_Y_EVALUACION' && (
                                <textarea 
                                  disabled={!isEditing}
                                  className="input min-h-[72px] resize-y" 
                                  placeholder="Detalle de las actividades..." 
                                  value={data.descripcion} 
                                  onChange={(e) => handleFieldChange(act.id, 'descripcion', e.target.value)} 
                                />
                              )}

                              {(act.id === 'CONSEJERIA' || act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA') && esTiempoCompleto && (
                                <label className="flex items-center gap-2 text-xs font-medium text-slate-650 dark:text-slate-405 select-none cursor-pointer">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditing}
                                    checked={data.metadata?.excepcionAcreditacion === true}
                                    onChange={(e) => handleMetadataChange(act.id, 'excepcionAcreditacion', e.target.checked)}
                                    className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                                  />
                                  Excepción por acreditación (permite hasta 3h)
                                </label>
                              )}

                              {(act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                                <label className="flex items-center gap-2 text-xs font-medium text-slate-650 dark:text-slate-405 select-none cursor-pointer">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditing}
                                    checked={data.metadata?.esMiembroConsejoFacultad === true}
                                    onChange={(e) => handleMetadataChange(act.id, 'esMiembroConsejoFacultad', e.target.checked)}
                                    className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                                  />
                                  Miembro del Consejo de Facultad (máx. 3h)
                                </label>
                              )}

                              {act.id === 'COMITES_TECNICOS_Y_COMISIONES' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-405 uppercase tracking-wider">Tipo de comisión</label>
                                    <select
                                      disabled={!isEditing}
                                      value={data.metadata?.esPresidenteCalidad ? 'PRESIDENTE' : data.metadata?.esComisionGeneral ? 'COMISION' : ''}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        handleMetadataChange(act.id, 'esPresidenteCalidad', v === 'PRESIDENTE');
                                        handleMetadataChange(act.id, 'esComisionGeneral', v === 'COMISION');
                                      }}
                                      className="input mt-1 h-9 py-1 px-3"
                                    >
                                      <option value="">Seleccione…</option>
                                      <option value="PRESIDENTE">Presidente Calidad/COTECU</option>
                                      <option value="COMISION">Comisión Especial</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-405 uppercase tracking-wider">N° Resolución</label>
                                    <input
                                      disabled={!isEditing}
                                      type="text"
                                      className="input mt-1 h-9 py-1 px-3"
                                      value={data.metadata?.resolucion || ''}
                                      onChange={(e) => handleMetadataChange(act.id, 'resolucion', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}

                              {act.id === 'INVESTIGACION' && (
                                <div>
                                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Código / Proyecto (VRI)</label>
                                  <input
                                    disabled={!isEditing}
                                    type="text"
                                    className="input mt-1 h-9 py-1 px-3"
                                    value={data.metadata?.codigoProyecto || ''}
                                    onChange={(e) => handleMetadataChange(act.id, 'codigoProyecto', e.target.value)}
                                  />
                                  {horasNum > 0 && !String(data.metadata?.codigoProyecto || '').trim() && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                      <Info className="h-3 w-3" /> Falta el código/proyecto (se recomienda registrarlo).
                                    </div>
                                  )}
                                </div>
                              )}

                              {(act.id === 'ASESORIA_DE_TESIS' || act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA' || act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {act.id === 'ASESORIA_DE_TESIS' && (
                                    <div className="sm:col-span-2">
                                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-405 uppercase tracking-wider">N° Resolución / Constancia</label>
                                      <input
                                        disabled={!isEditing}
                                        type="text"
                                        className="input mt-1 h-9 py-1 px-3"
                                        value={data.metadata?.resolucion || ''}
                                        onChange={(e) => handleMetadataChange(act.id, 'resolucion', e.target.value)}
                                      />
                                    </div>
                                  )}
                                  {act.id === 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA' && (
                                    <div className="sm:col-span-2">
                                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Proyecto RSU (código/nombre)</label>
                                      <input
                                        disabled={!isEditing}
                                        type="text"
                                        className="input mt-1 h-9 py-1 px-3"
                                        value={data.metadata?.proyecto || ''}
                                        onChange={(e) => handleMetadataChange(act.id, 'proyecto', e.target.value)}
                                      />
                                    </div>
                                  )}
                                  {(act.id === 'ACTIVIDADES_DE_GOBIERNO' || act.id === 'ACTIVIDADES_DE_ADMINISTRACION') && (
                                    <div className="sm:col-span-2">
                                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Cargo / sustento</label>
                                      <input
                                        disabled={!isEditing}
                                        type="text"
                                        className="input mt-1 h-9 py-1 px-3"
                                        value={data.metadata?.cargo || ''}
                                        onChange={(e) => handleMetadataChange(act.id, 'cargo', e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {restr.max === 0 && (
                                <div className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">
                                  No aplica para la dedicación actual.
                                </div>
                              )}
                            </div>
                            <div className="w-32 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Horas:</label>
                                <input 
                                  disabled={inputDeshabilitado}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="input h-10 px-3 text-center font-extrabold text-slate-900 dark:text-slate-100 disabled:opacity-50" 
                                  value={data.horas} 
                                  onChange={(e) => handleFieldChange(act.id, 'horas', e.target.value)} 
                                  onBlur={() => handleHorasBlur(act.id)} 
                                />
                              </div>
                              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1.5 text-right">
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
                <div className="pt-6 border-t border-slate-200 dark:border-slate-850 flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    {/* Card 1: Horas Lectivas */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Horas Lectivas</span>
                      <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400 mt-3">{dataLectiva.totalHorasLectivas} h</span>
                    </div>
                    {/* Card 2: Horas No Lectivas */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Horas No Lectivas</span>
                      <div className="flex items-baseline justify-between mt-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-800 dark:text-white">{totalNoLectivas} h</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">/ {dataLectiva.horasNoLectivasDisponibles} h req.</span>
                        </div>
                        <span className={`badge ${totalNoLectivas === dataLectiva.horasNoLectivasDisponibles ? 'badge-success' : 'badge-warning'}`}>
                          {totalNoLectivas === dataLectiva.horasNoLectivasDisponibles ? 'Completado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                    {/* Card 3: Total General */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Total General</span>
                      <div className="flex items-baseline gap-1.5 mt-3">
                        <span className="text-2xl font-black text-emerald-650 dark:text-emerald-400">
                          {dataLectiva.totalHorasLectivas + totalNoLectivas} h
                        </span>
                        <span className="text-xs text-slate-450 dark:text-slate-500 font-semibold">
                          / {docenteInfo.horasDedicacion} h ded.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={() => setIsEditing(true)}
                      disabled={isEditing}
                      className="btn-outline gap-2 shadow-sm font-semibold transition-all duration-150"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar Declaración
                    </Button>
                    
                    <Button
                      onClick={handleGuardarNoLectiva}
                      disabled={!isEditing || guardando || totalNoLectivas !== dataLectiva.horasNoLectivasDisponibles}
                      className="btn-primary gap-2 shadow-sm font-semibold transition-all duration-150"
                    >
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar Declaración
                    </Button>

                    <Button
                      onClick={clickHorario}
                      disabled={totalNoLectivas !== dataLectiva.horasNoLectivasDisponibles || guardando}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 font-bold h-10 px-4 rounded-md inline-flex items-center justify-center text-sm"
                    >
                      <Calendar className="h-4 w-4" />
                      Horario
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* 3. HORARIO PERSONAL */}
              <div id="horario-personal">
                {horarioHabilitado && dataLectiva?.declaracion && dataLectiva.declaracion.items.length > 0 && (
                  <PanelDistribucionHoraria
                    docenteId={docenteInfo.id}
                    periodoId={dataLectiva.periodo.id}
                    declaracionItems={dataLectiva.declaracion.items}
                    horariosLectivos={dataLectiva.asignaciones || []}
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal para Asignar Curso */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) setEditingAsignacion(null); }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{editingAsignacion ? 'Editar Asignación' : 'Asignar Curso'} a {docenteInfo?.nombreCompleto}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="label">Currícula (Plan de Estudios)</label>
              <select 
                value={selectedPlanEstudioId}
                onChange={(e) => {
                  setSelectedPlanEstudioId(e.target.value);
                  setSelectedCursoId('');
                  setSelectedGrupoNombre('A');
                }}
                className="input cursor-pointer"
              >
                <option value="">Seleccione una currícula...</option>
                {planesEstudio.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.anio}) {p.activo ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Cursos Disponibles</label>
              <div className="table-container max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th className="text-center">T + P</th>
                      <th className="text-center">L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cursosDisponibles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-slate-400 dark:text-slate-550">
                          No hay cursos en esta currícula
                        </td>
                      </tr>
                    ) : (
                      cursosDisponibles.map(c => (
                        <tr 
                          key={c.id} 
                          onClick={() => {
                            setSelectedCursoId(c.id);
                            setSelectedGrupoNombre('A');
                          }}
                          className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${selectedCursoId === c.id ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300' : ''}`}
                        >
                          <td>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <input 
                                type="radio" 
                                checked={selectedCursoId === c.id} 
                                readOnly
                                className="w-4 h-4 text-primary focus:ring-primary border-slate-350 dark:border-slate-700 dark:bg-slate-800 focus:ring-offset-0 focus:ring-2"
                              />
                              {c.codigo}
                            </div>
                          </td>
                          <td className="font-semibold">{c.nombre} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Ciclo {c.ciclo})</span></td>
                          <td className="text-center text-slate-500 dark:text-slate-400">{c.horasTeoria + c.horasPractica}h</td>
                          <td className="text-center text-slate-500 dark:text-slate-400">{c.horasLaboratorio}h</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {selectedCursoId && (
              <div>
                <label className="label">Sección / Grupo</label>
                <div className="flex flex-col gap-1">
                  <select 
                    value={selectedGrupoNombre}
                    onChange={(e) => setSelectedGrupoNombre(e.target.value)}
                    className="input cursor-pointer"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Seleccione el grupo predefinido (catálogo estático).</span>
                </div>
              </div>
            )}

            {selectedCursoId && (
              <div>
                <label className="label">Componentes a Asignar</label>
                <div className="flex gap-4">
                  {(['TEORIA', 'PRACTICA', 'LABORATORIO'] as TipoComponente[]).map(comp => {
                    const curso = cursosDisponibles.find(c => c.id === selectedCursoId);
                    const hasHoras = comp === 'TEORIA' ? curso?.horasTeoria : comp === 'PRACTICA' ? curso?.horasPractica : curso?.horasLaboratorio;
                    if (!hasHoras) return null;
                    
                    return (
                      <label key={comp} className="flex items-center gap-2 cursor-pointer text-slate-805 dark:text-slate-205 select-none">
                        <input 
                          type="checkbox"
                          checked={selectedComponentes.includes(comp)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedComponentes([...selectedComponentes, comp]);
                            else setSelectedComponentes(selectedComponentes.filter(c => c !== comp));
                          }}
                          className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-350 dark:border-slate-700 dark:bg-slate-800 focus:ring-offset-0 focus:ring-2"
                        />
                        <span className="text-sm font-semibold">{comp.charAt(0) + comp.slice(1).toLowerCase()}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="btn-outline font-semibold" onClick={cerrarModal}>Cancelar</Button>
            <Button onClick={asignarCurso} className="btn-primary font-semibold">
              {editingAsignacion ? 'Guardar Cambios' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Advertencia / Confirmación para Modificar Asignaciones con Horarios Programados */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500 font-bold">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirmar Modificación de Asignación
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
              Advertencia de Modificación: Este curso ya está registrado en la carga académica del docente en el sistema.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Al guardar los cambios, el sistema <strong>eliminará primero todos los registros de horarios y componentes anteriores</strong> asociados a este curso y grupo. Posteriormente, se crearán las nuevas asignaciones según su selección.
            </p>
            {editingAsignacion?.tieneProgramacion && (
              <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-350 leading-relaxed font-medium">
                <strong>Importante:</strong> El docente ya ha programado horarios (días, horas o aulas) para esta materia. Esta programación detallada también se perderá y el docente deberá volver a configurarla.
              </div>
            )}
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">
              ¿Está seguro de que desea confirmar esta modificación en el sistema?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="btn-outline font-semibold" onClick={() => setIsConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={ejecutarAsignacion} className="btn-primary bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500/30">
              Confirmar y Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
