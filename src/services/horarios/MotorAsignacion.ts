import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { 
  CategoriaDocente, 
  DiaSemana, 
  EstadoHorario,
  TipoAmbiente 
} from '@prisma/client';
import { ValidadorHorario, type ValidacionConflicto } from './ValidadorHorario';
import { ConflictoHorario } from './ValidadorConflictos';
import { AppError } from '@/services/auth/AuthService';

/**
 * Representa una solicitud de asignación de horario
 */
export interface SolicitudAsignacion {
  periodoId: string;
  cursoId: string;
  docenteId?: string;        // Si no se especifica, se busca el mejor disponible
  grupoId?: string;
  ambienteId?: string;       // Si no se especifica, se busca el mejor disponible
  tipoAmbiente?: TipoAmbiente;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  creadoPor?: string;
}

/**
 * Resultado de una asignación
 */
export interface ResultadoAsignacion {
  exitoso: boolean;
  horarioId?: string;
  conflicto?: any;
  mensaje: string;
  asignacionAlternativa?: {
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
    ambienteId: string;
    ambienteNombre: string;
  };
}

/**
 * Orden de jerarquía para asignación de horarios
 * Refleja las reglas de la UNT:
 * 1. Nombrados: Principal > Asociado > Auxiliar
 * 2. Contratados
 * 3. Jefes de Práctica (Invitado)
 * 
 * Dentro de cada categoría: mayor antigüedad primero (código menor)
 */
const JERARQUIA_CATEGORIAS: Record<CategoriaDocente, number> = {
  PRINCIPAL: 1,
  ASOCIADO: 2,
  AUXILIAR: 3,
  CONTRATADO: 4,
  INVITADO: 5, // Jefe de práctica
};

/**
 * Categorías consideradas como "Nombrados"
 */
const CATEGORIAS_NOMBRADOS: CategoriaDocente[] = ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR'];

/**
 * Motor de asignación de horarios.
 * 
 * Implementa la lógica de negocio para asignar horarios respetando:
 * - Jerarquía de categorías docentes (nombrados primero, luego contratados)
 * - Antigüedad dentro de cada categoría
 * - Disponibilidad de ambientes (aulas y laboratorios)
 * - Validación de conflictos antes de confirmar
 * - Búsqueda de alternativas cuando no se puede asignar
 */
export class MotorAsignacion {
  private validadorHorario: ValidadorHorario;

  constructor() {
    this.validadorHorario = new ValidadorHorario();
  }

  /**
   * Asigna un horario siguiendo la jerarquía establecida.
   * 
   * Flujo:
   * 1. Si se especifica docente, validar que esté disponible
   * 2. Si no, buscar el mejor docente disponible según jerarquía
   * 3. Si se especifica ambiente, validar que esté disponible
   * 4. Si no, buscar el mejor ambiente disponible
   * 5. Validar conflictos antes de confirmar
   * 6. Si hay conflictos, buscar alternativas
   * 7. Crear el horario si todo está bien
   */
  async asignarHorario(
    solicitud: SolicitudAsignacion
  ): Promise<ResultadoAsignacion> {
    const {
      periodoId,
      cursoId,
      grupoId,
      diaSemana,
      horaInicio,
      horaFin,
      creadoPor,
    } = solicitud;

    let docenteId = solicitud.docenteId;
    let ambienteId = solicitud.ambienteId;
    const mensajes: string[] = [];

    // ==========================================
    // PASO 1: Seleccionar docente según jerarquía
    // ==========================================
    if (!docenteId) {
      const mejorDocente = await this.buscarMejorDocente(
        periodoId,
        cursoId,
        diaSemana,
        horaInicio,
        horaFin
      );

      if (!mejorDocente) {
        return {
          exitoso: false,
          mensaje: 'No se encontró ningún docente disponible para este horario según la jerarquía establecida.',
        };
      }

      docenteId = mejorDocente.id;
      mensajes.push(`Docente asignado por jerarquía: ${mejorDocente.usuario.nombre} ${mejorDocente.usuario.apellidos} (${mejorDocente.categoria})`);
    }

    if (!docenteId) {
      return { exitoso: false, mensaje: 'No se pudo determinar un docente para la asignación.' };
    }

    // Verificar que el docente tenga el curso asignado
    const cursoDocente = await prisma.cursoDocente.findUnique({
      where: {
        cursoId_docenteId: { cursoId, docenteId },
      },
    });

    if (!cursoDocente) {
      return {
        exitoso: false,
        mensaje: `El docente seleccionado no tiene asignado este curso.`,
      };
    }

    // ==========================================
    // PASO 2: Seleccionar ambiente según tipo
    // ==========================================
    if (!ambienteId) {
      const curso = await prisma.curso.findUnique({
        where: { id: cursoId },
        select: { horasLaboratorio: true, horasTeoria: true, horasPractica: true },
      });

      const tipoNecesario = curso && curso.horasLaboratorio > 0 
        ? 'LABORATORIO' as TipoAmbiente 
        : solicitud.tipoAmbiente || 'AULA' as TipoAmbiente;

      const mejorAmbiente = await this.buscarMejorAmbiente(
        periodoId,
        tipoNecesario,
        diaSemana,
        horaInicio,
        horaFin
      );

      if (!mejorAmbiente) {
        // Crear conflicto para no disponibilidad de ambiente
        const conflicto: ConflictoHorario = {
          tipo: 'CRUCE_AULA',
          severidad: 'ERROR',
          mensaje: `No se encontró ningún ${tipoNecesario.toLowerCase()} disponible en este horario.`,
          horarioActual: {
            cursoNombre: 'Desconocido',
            docenteNombre: 'Desconocido',
            ambienteNombre: tipoNecesario,
            diaSemana,
            horaInicio,
            horaFin,
          },
          horarioConflicto: {
            id: '',
            cursoNombre: '',
            docenteNombre: '',
            ambienteNombre: tipoNecesario,
            diaSemana,
            horaInicio,
            horaFin,
          },
          metadata: { tipoAmbiente: tipoNecesario },
        };

        return {
          exitoso: false,
          conflicto,
          mensaje: `No se encontró ningún ${tipoNecesario.toLowerCase()} disponible en este horario.`,
        };
      }

      ambienteId = mejorAmbiente.id;
      mensajes.push(`Ambiente asignado: ${mejorAmbiente.codigo} - ${mejorAmbiente.nombre}`);
    }

    if (!ambienteId) {
      return { exitoso: false, mensaje: 'No se pudo determinar un ambiente para la asignación.' };
    }

    // ==========================================
    // PASO 3: Validar conflictos
    // ==========================================
    const resultadoValidacion = await this.validadorHorario.validarHorario(
      periodoId,
      docenteId!,
      cursoId,
      ambienteId!,
      grupoId,
      diaSemana,
      horaInicio,
      horaFin
    );

    // ==========================================
    // PASO 4: Si hay conflictos, buscar alternativas
    // ==========================================
    if (!resultadoValidacion.valido) {
      const primerConflicto = resultadoValidacion.conflictos[0];

      // Intentar buscar una alternativa
      const alternativa = await this.buscarAlternativa(
        periodoId,
        cursoId,
        docenteId!, // docenteId debe estar definido aquí
        grupoId,
        diaSemana,
        horaInicio,
        horaFin,
        resultadoValidacion.conflictos
      );

      if (alternativa) {
        // Registrar el conflicto original
        await this.registrarConflicto(
          periodoId, cursoId, docenteId!, ambienteId!,
          diaSemana, horaInicio, horaFin,
          primerConflicto
        );

        return {
          exitoso: false,
          conflicto: primerConflicto,
          mensaje: `Conflicto detectado: ${primerConflicto.mensaje}. Se encontró una alternativa.`,
          asignacionAlternativa: alternativa,
        };
      }

      // No hay alternativa, registrar conflicto
      await this.registrarConflicto(
        periodoId, cursoId, docenteId!, ambienteId!,
        diaSemana, horaInicio, horaFin,
        primerConflicto
      );

      return {
        exitoso: false,
        conflicto: primerConflicto,
        mensaje: `No se pudo asignar: ${primerConflicto.mensaje}. No se encontraron alternativas.`,
      };
    }

    // ==========================================
    // PASO 5: Crear el horario
    // ==========================================
    try {
      const horario = await prisma.horario.create({
        data: {
          periodoId,
          cursoId,
          docenteId,
          grupoId: grupoId || null,
          ambienteId,
          diaSemana,
          horaInicio,
          horaFin,
          estado: 'BORRADOR' as EstadoHorario,
          creadoPor: creadoPor || 'sistema',
          fechaCreacion: new Date(),
        },
        include: {
          curso: { select: { codigo: true, nombre: true } },
          docente: {
            include: {
              usuario: { select: { nombre: true, apellidos: true } },
            },
          },
          ambiente: { select: { codigo: true, nombre: true, tipo: true } },
          grupo: { select: { nombre: true } },
        },
      });

      mensajes.push('Horario asignado exitosamente.');

      return {
        exitoso: true,
        horarioId: horario.id,
        mensaje: mensajes.join(' '),
      };
    } catch (error: any) {
      console.error('Error creando horario en MotorAsignacion:', error);
      return {
        exitoso: false,
        mensaje: `Error al crear el horario: ${error.message}`,
      };
    }
  }

  /**
   * Busca el mejor docente disponible según jerarquía
   * 
   * Orden:
   * 1. Por categoría (PRINCIPAL > ASOCIADO > AUXILIAR > CONTRATADO > INVITADO)
   * 2. Por antigüedad (usando código como proxy - menor código = mayor antigüedad)
   */
  private async buscarMejorDocente(
    periodoId: string,
    cursoId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string
  ): Promise<any> {
    // Obtener docentes que tienen el curso asignado
    const cursoDocentes = await prisma.cursoDocente.findMany({
      where: {
        cursoId,
        activo: true,
        docente: {
          usuario: { activo: true },
        },
      },
      include: {
        docente: {
          include: {
            usuario: { select: { id: true, nombre: true, apellidos: true } },
          },
        },
      },
    });

    if (cursoDocentes.length === 0) return null;

    // Ordenar por jerarquía de categoría y antigüedad
    const docentesOrdenados = cursoDocentes
      .map(cd => cd.docente)
      .sort((a, b) => {
        // 1. Primero por modalidad (Nombrados vs Contratados)
        const esNombradoA = CATEGORIAS_NOMBRADOS.includes(a.categoria);
        const esNombradoB = CATEGORIAS_NOMBRADOS.includes(b.categoria);
        
        if (esNombradoA !== esNombradoB) {
          return esNombradoA ? -1 : 1;
        }

        // 2. Luego por jerarquía de categoría
        const jerarquiaA = JERARQUIA_CATEGORIAS[a.categoria] || 99;
        const jerarquiaB = JERARQUIA_CATEGORIAS[b.categoria] || 99;
        
        if (jerarquiaA !== jerarquiaB) {
          return jerarquiaA - jerarquiaB;
        }
        
        // 3. Finalmente por antigüedad (código como proxy: menor código = más antiguo)
        return (a.codigo || '').localeCompare(b.codigo || '');
      });

    // Buscar el primero que esté disponible
    for (const docente of docentesOrdenados) {
      const estaLibre = await this.validadorHorario.estaLibreDocente(
        periodoId, docente.id, diaSemana, horaInicio, horaFin
      );

      if (estaLibre) {
        return docente;
      }
    }

    return null;
  }

  /**
   * Busca el mejor ambiente disponible del tipo especificado
   */
  private async buscarMejorAmbiente(
    periodoId: string,
    tipo: TipoAmbiente,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string
  ): Promise<any> {
    const ambientes = await prisma.ambiente.findMany({
      where: {
        tipo,
        activo: true,
      },
      orderBy: [
        { capacidad: 'desc' }, // Preferir ambientes más grandes
        { codigo: 'asc' },
      ],
    });

    for (const ambiente of ambientes) {
      const estaLibre = await this.validadorHorario.estaLibreAmbiente(
        periodoId, ambiente.id, diaSemana, horaInicio, horaFin
      );

      if (estaLibre) {
        return ambiente;
      }
    }

    return null;
  }

  /**
   * Busca alternativas de horario cuando hay conflicto
   * Prueba otros ambientes y franjas horarias cercanas
   */
  private async buscarAlternativa(
    periodoId: string,
    cursoId: string,
    docenteId: string,
    grupoId: string | undefined,
    diaSemanaOriginal: DiaSemana,
    horaInicioOriginal: string,
    horaFinOriginal: string,
    conflictos: ValidacionConflicto[]
  ): Promise<ResultadoAsignacion['asignacionAlternativa'] | null> {
    const diasAlternativos: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']
      .filter(d => d !== diaSemanaOriginal) as DiaSemana[];

    // Primero: probar otros ambientes en el mismo horario
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      select: { horasLaboratorio: true },
    });

    const tipoNecesario = curso && curso.horasLaboratorio > 0 ? 'LABORATORIO' : 'AULA';
    
    const ambientesAlternativos = await prisma.ambiente.findMany({
      where: {
        tipo: tipoNecesario as TipoAmbiente,
        activo: true,
        id: {
          notIn: conflictos
            .map((c) => c.detalle?.ambienteId)
            .filter((id): id is string => Boolean(id)),
        },
      },
    });

    for (const ambiente of ambientesAlternativos) {
      const estaLibre = await this.validadorHorario.estaLibreAmbiente(
        periodoId, ambiente.id, diaSemanaOriginal, horaInicioOriginal, horaFinOriginal
      );

      if (estaLibre) {
        return {
          diaSemana: diaSemanaOriginal,
          horaInicio: horaInicioOriginal,
          horaFin: horaFinOriginal,
          ambienteId: ambiente.id,
          ambienteNombre: `${ambiente.codigo} - ${ambiente.nombre}`,
        };
      }
    }

    // Segundo: probar otros días en el mismo ambiente (el primer ambiente disponible)
    const ambienteDefault = await this.buscarMejorAmbiente(
      periodoId, tipoNecesario as TipoAmbiente, diaSemanaOriginal, horaInicioOriginal, horaFinOriginal
    );

    if (ambienteDefault) {
      for (const dia of diasAlternativos) {
        const estaLibre = await this.validadorHorario.estaLibreAmbiente(
          periodoId, ambienteDefault.id, dia, horaInicioOriginal, horaFinOriginal
        );

        if (estaLibre) {
          const docenteLibre = await this.validadorHorario.estaLibreDocente(
            periodoId, docenteId, dia, horaInicioOriginal, horaFinOriginal
          );

          if (docenteLibre) {
            return {
              diaSemana: dia,
              horaInicio: horaInicioOriginal,
              horaFin: horaFinOriginal,
              ambienteId: ambienteDefault.id,
              ambienteNombre: `${ambienteDefault.codigo} - ${ambienteDefault.nombre}`,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Registra un conflicto en la base de datos para auditoría
   */
  private async registrarConflicto(
    periodoId: string,
    cursoId: string,
    docenteId: string,
    ambienteId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    conflicto: ValidacionConflicto | ConflictoHorario
  ): Promise<void> {
    const horarioId =
      'horarioConflicto' in conflicto
        ? conflicto.horarioConflicto.id
        : conflicto.detalle?.horarioId;

    if (!horarioId) return;

    try {
      await prisma.validacionHorario.create({
        data: {
          horarioId,
          tipoRegla: ((): any => {
            const mapa: Record<string, string> = {
              CRUCE_DOCENTE: 'CRUCE_DOCENTE',
              CRUCE_AMBIENTE: 'CRUCE_AULA',
              CRUCE_AULA: 'CRUCE_AULA',
              CRUCE_LABORATORIO: 'CRUCE_AULA',
              CRUCE_GRUPO: 'CRUCE_AULA',
              HORAS_EXCEDIDAS: 'SUPERA_HORAS_MAX_DIARIAS',
              SUPERA_HORAS_MAX_DIARIAS: 'SUPERA_HORAS_MAX_DIARIAS',
              SUPERA_HORAS_CONTINUAS: 'SUPERA_HORAS_CONTINUAS',
              DESCANSO_INSUFICIENTE: 'DESCANSO_INSUFICIENTE',
              HORAS_REQUERIDAS: 'SUPERA_HORAS_MAX_DIARIAS',
              CARGA_HORARIA: 'SUPERA_HORAS_MAX_DIARIAS',
            };
            return (mapa[conflicto.tipo] || 'CRUCE_DOCENTE') as any;
          })(),
          cumple: false,
          mensaje: conflicto.mensaje,
          metadata: {
            periodoId,
            cursoId,
            docenteId,
            ambienteId,
            diaSemana,
            horaInicio,
            horaFin,
            conflictoDetalle: {
              tipo: conflicto.tipo,
              severidad: conflicto.severidad,
              horarioConflictoId: horarioId,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error registrando conflicto:', error);
    }
  }

  /**
   * Asigna horarios en lote para un período completo
   * Útil para asignación masiva al inicio del período
   */
  async asignarLote(
    periodoId: string,
    creadoPor?: string
  ): Promise<{
    totalSolicitadas: number;
    asignadas: number;
    conConflicto: number;
    resultados: ResultadoAsignacion[];
  }> {
    const resultados: ResultadoAsignacion[] = [];
    
    // Obtener todos los cursos con docentes asignados
    const cursosDocentes = await prisma.cursoDocente.findMany({
      where: { activo: true },
      include: {
        curso: true,
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
      },
    });

    // Ordenar por jerarquía (modalidad, categoría, antigüedad)
    const ordenados = cursosDocentes.sort((a, b) => {
      const docA = a.docente;
      const docB = b.docente;

      // 1. Modalidad
      const esNombradoA = CATEGORIAS_NOMBRADOS.includes(docA.categoria);
      const esNombradoB = CATEGORIAS_NOMBRADOS.includes(docB.categoria);
      
      if (esNombradoA !== esNombradoB) {
        return esNombradoA ? -1 : 1;
      }

      // 2. Categoría
      const jerarquiaA = JERARQUIA_CATEGORIAS[docA.categoria] || 99;
      const jerarquiaB = JERARQUIA_CATEGORIAS[docB.categoria] || 99;
      
      if (jerarquiaA !== jerarquiaB) {
        return jerarquiaA - jerarquiaB;
      }
      
      // 3. Antigüedad
      return (docA.codigo || '').localeCompare(docB.codigo || '');
    });

    const diasHabiles: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
    const franjas = [
      { inicio: '08:00', fin: '10:00' },
      { inicio: '10:00', fin: '12:00' },
      { inicio: '12:00', fin: '14:00' },
      { inicio: '14:00', fin: '16:00' },
      { inicio: '16:00', fin: '18:00' },
      { inicio: '18:00', fin: '20:00' },
    ];

    for (const cd of ordenados) {
      for (const dia of diasHabiles) {
        for (const franja of franjas) {
          const resultado = await this.asignarHorario({
            periodoId,
            cursoId: cd.cursoId,
            docenteId: cd.docenteId,
            diaSemana: dia,
            horaInicio: franja.inicio,
            horaFin: franja.fin,
            creadoPor,
          });

          resultados.push(resultado);
          
          if (resultado.exitoso) break; // Pasar al siguiente curso
        }
      }
    }

    return {
      totalSolicitadas: resultados.length,
      asignadas: resultados.filter(r => r.exitoso).length,
      conConflicto: resultados.filter(r => !r.exitoso && r.conflicto).length,
      resultados,
    };
  }
}