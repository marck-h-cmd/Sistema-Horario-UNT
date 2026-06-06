import { prisma } from '@/lib/prisma';
import { AppError } from '@/services/auth/AuthService';
import { TipoActividadNoLectiva, DedicacionDocente } from '@prisma/client';

export interface DeclaracionItemInput {
  tipoActividad: TipoActividadNoLectiva;
  horasSemanales: number;
  descripcion?: string;
  metadata?: any;
}

export class CargaNoLectivaService {
  /**
   * Obtiene la declaración actual de un docente para un período académico
   */
  async obtenerDeclaracionActual(docenteId: string, periodoId: string) {
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: { select: { nombre: true, apellidos: true } },
      },
    });

    if (!docente) {
      throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    }

    // 1. Calcular horas de dedicación
    const horasDedicacion = this.obtenerHorasDedicacion(docente.dedicacion);

    // 2. Calcular horas lectivas (desde Horarios del periodo)
    const horarios = await prisma.horario.findMany({
      where: {
        docenteId,
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: { curso: true }
    });
    
    let horasLectivas = 0;
    for (const h of horarios) {
      switch (h.tipoComponente) {
        case 'TEORIA': horasLectivas += h.curso.horasTeoria; break;
        case 'PRACTICA': horasLectivas += h.curso.horasPractica; break;
        case 'LABORATORIO': horasLectivas += h.curso.horasLaboratorio; break;
      }
    }

    // 3. Calcular horas no lectivas disponibles
    const horasNoLectivasDisponibles = Math.max(0, horasDedicacion - horasLectivas);

    // 4. Buscar declaración existente
    const declaracion = await prisma.declaracionNoLectiva.findUnique({
      where: {
        docenteId_periodoId: {
          docenteId,
          periodoId,
        },
      },
      include: {
        items: true,
      },
    });

    return {
      docente: {
        id: docente.id,
        codigo: docente.codigo,
        nombreCompleto: `${docente.usuario.nombre} ${docente.usuario.apellidos}`,
        categoria: docente.categoria,
        dedicacion: docente.dedicacion,
        horasDedicacion,
      },
      horasLectivas,
      horasNoLectivasDisponibles,
      declaracion: declaracion
        ? {
            id: declaracion.id,
            fechaDeclaracion: declaracion.fechaDeclaracion,
            totalHoras: declaracion.totalHoras,
            observaciones: declaracion.observaciones,
            items: declaracion.items,
          }
        : null,
    };
  }

  /**
   * Registra o actualiza la declaración de carga no lectiva
   */
  async guardarDeclaracion(
    docenteId: string,
    periodoId: string,
    items: DeclaracionItemInput[],
    observaciones?: string,
    usuarioId?: string
  ) {
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
    });

    if (!docente) {
      throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    }

    // 1. Calcular horas disponibles
    const horasDedicacion = this.obtenerHorasDedicacion(docente.dedicacion);
    const horarios = await prisma.horario.findMany({
      where: { docenteId, periodoId, estado: { not: 'CANCELADO' } },
      include: { curso: true }
    });
    
    let horasLectivas = 0;
    for (const h of horarios) {
      switch (h.tipoComponente) {
        case 'TEORIA': horasLectivas += h.curso.horasTeoria; break;
        case 'PRACTICA': horasLectivas += h.curso.horasPractica; break;
        case 'LABORATORIO': horasLectivas += h.curso.horasLaboratorio; break;
      }
    }
    const horasNoLectivasDisponibles = Math.max(0, horasDedicacion - horasLectivas);

    // 2. Validar que no se exceda el total
    const totalHorasDeclaradas = items.reduce((sum, item) => sum + item.horasSemanales, 0);
    if (totalHorasDeclaradas > horasNoLectivasDisponibles) {
      throw new AppError(
        `El total de horas no lectivas declaradas (${totalHorasDeclaradas}h) excede las horas disponibles (${horasNoLectivasDisponibles}h). Su dedicación es de ${horasDedicacion}h y tiene ${horasLectivas}h asignadas en carga lectiva.`,
        400,
        'EXCEDE_HORAS_DISPONIBLES'
      );
    }

    // 3. Validar individualmente cada tipo de actividad
    for (const item of items) {
      this.validarActividad(item, horasLectivas);
    }

    // 4. Persistir en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Buscar si ya existe la cabecera
      const existente = await tx.declaracionNoLectiva.findUnique({
        where: {
          docenteId_periodoId: { docenteId, periodoId },
        },
      });

      let declaracionId = existente?.id;

      if (existente) {
        // Actualizar cabecera
        await tx.declaracionNoLectiva.update({
          where: { id: existente.id },
          data: {
            totalHoras: totalHorasDeclaradas,
            observaciones,
          },
        });
        // Eliminar items antiguos
        await tx.declaracionNoLectivaItem.deleteMany({
          where: { declaracionId: existente.id },
        });
      } else {
        // Crear cabecera
        const nueva = await tx.declaracionNoLectiva.create({
          data: {
            docenteId,
            periodoId,
            totalHoras: totalHorasDeclaradas,
            observaciones,
          },
        });
        declaracionId = nueva.id;
      }

      // Crear nuevos items
      const itemsCreados = [];
      for (const item of items) {
        const itemCreado = await tx.declaracionNoLectivaItem.create({
          data: {
            declaracionId: declaracionId!,
            tipoActividad: item.tipoActividad,
            horasSemanales: item.horasSemanales,
            descripcion: item.descripcion,
            metadata: item.metadata || {},
          },
        });
        itemsCreados.push(itemCreado);
      }

      // Auditoría
      await tx.registroAuditoria.create({
        data: {
          usuarioId: usuarioId || docente.usuarioId,
          accion: existente ? 'ACTUALIZAR_DECLARACION_NO_LECTIVA' : 'CREAR_DECLARACION_NO_LECTIVA',
          entidad: 'DeclaracionNoLectiva',
          entidadId: declaracionId,
          datos: {
            periodoId,
            docenteId,
            totalHoras: totalHorasDeclaradas,
            items: items.map((i) => ({ tipo: i.tipoActividad, horas: i.horasSemanales })),
          },
        },
      });

      return {
        id: declaracionId,
        totalHoras: totalHorasDeclaradas,
        items: itemsCreados,
      };
    });

    return result;
  }

  /**
   * Retorna las reglas de validación por tipo de actividad no lectiva
   */
  obtenerReglasValidacion() {
    return {
      PREPARACION_Y_EVALUACION: {
        descripcion: 'Preparación de clases y evaluación de estudiantes (Exactamente 50% de la carga lectiva asignada)',
        maxPercentageOfLectiva: 0.5,
        minHours: 0,
        requiredFields: [],
      },
      CONSEJERIA: {
        description: 'Tutoría y consejería a estudiantes (máximo 3 horas semanales)',
        maxHours: 3,
        requiredFields: ['numAlumnos', 'ciclo'],
      },
      INVESTIGACION: {
        description: 'Actividades de investigación científica (máximo 6 horas semanales)',
        maxHours: 6,
        requiredFields: ['codigoProyecto'],
      },
      CAPACITACION: {
        description: 'Capacitación o perfeccionamiento docente (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: [],
      },
      ACTIVIDADES_DE_GOBIERNO: {
        description: 'Desempeño de cargos de gobierno universitario (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: ['cargo'],
      },
      ACTIVIDADES_DE_ADMINISTRACION: {
        description: 'Desempeño de cargos de administración académica (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: ['cargo'],
      },
      ASESORIA_DE_TESIS: {
        description: 'Asesoría de proyectos de tesis (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: ['resolucion'],
      },
      RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        description: 'Proyectos de RSU o proyección social (máximo 3 horas semanales)',
        maxHours: 3,
        requiredFields: [],
      },
      COMITES_TECNICOS_Y_COMISIONES: {
        description: 'Trabajo en comités técnicos o comisiones oficiales (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: ['resolucion'],
      },
    };
  }

  /**
   * Valida un item de actividad no lectiva según el reglamento
   */
  private validarActividad(item: DeclaracionItemInput, horasLectivas: number) {
    const { tipoActividad, horasSemanales, metadata } = item;

    if (horasSemanales <= 0) {
      throw new AppError(`Las horas semanales para la actividad ${tipoActividad} deben ser mayores a 0`, 400, 'INVALID_HOURS');
    }

    switch (tipoActividad) {
      case TipoActividadNoLectiva.PREPARACION_Y_EVALUACION: {
        const maxPermitido = Math.floor(horasLectivas * 0.5);
        if (horasSemanales > maxPermitido) {
          throw new AppError(
            `Las horas de Preparación y Evaluación (${horasSemanales}h) exceden el límite del 50% de su carga lectiva (${maxPermitido}h para una carga lectiva de ${horasLectivas}h).`,
            400,
            'PREPARACION_EXCEDE_LIMITE'
          );
        }
        break;
      }
      case TipoActividadNoLectiva.CONSEJERIA: {
        if (horasSemanales > 3) {
          throw new AppError('La actividad de Consejería permite un máximo de 3 horas semanales.', 400, 'CONSEJERIA_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.INVESTIGACION: {
        if (horasSemanales > 6) {
          throw new AppError('La actividad de Investigación permite un máximo de 6 horas semanales.', 400, 'INVESTIGACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.CAPACITACION: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Capacitación permite un máximo de 2 horas semanales.', 400, 'CAPACITACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ACTIVIDADES_DE_GOBIERNO: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Gobierno permite un máximo de 2 horas semanales.', 400, 'GOBIERNO_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ACTIVIDADES_DE_ADMINISTRACION: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Administración permite un máximo de 2 horas semanales.', 400, 'ADMINISTRACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ASESORIA_DE_TESIS: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Asesoría de Tesis permite un máximo de 2 horas semanales.', 400, 'ASESORIA_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        if (horasSemanales > 3) {
          throw new AppError('La actividad de Responsabilidad Social Universitaria permite un máximo de 3 horas semanales.', 400, 'RSU_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.COMITES_TECNICOS_Y_COMISIONES: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad en Comités o Comisiones permite un máximo de 2 horas semanales.', 400, 'COMITES_MAX_HORAS');
        }
        break;
      }
      default:
        break;
    }
  }

  private obtenerHorasDedicacion(dedicacion: DedicacionDocente): number {
    switch (dedicacion) {
      case DedicacionDocente.TIEMPO_COMPLETO_40H:
      case DedicacionDocente.DEDICACION_EXCLUSIVA:
        return 40;
      case DedicacionDocente.TIEMPO_PARCIAL_20H:
        return 20;
      default:
        return 40;
    }
  }
}
