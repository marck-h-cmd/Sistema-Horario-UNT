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

    // 2. Calcular horas lectivas (desde CursoDocente activo)
    const asignacionesLectivas = await prisma.cursoDocente.findMany({
      where: {
        docenteId,
        activo: true,
      },
    });
    const horasLectivas = asignacionesLectivas.reduce((sum, cd) => sum + cd.horasAsignadas, 0);

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
    const asignacionesLectivas = await prisma.cursoDocente.findMany({
      where: { docenteId, activo: true },
    });
    const horasLectivas = asignacionesLectivas.reduce((sum, cd) => sum + cd.horasAsignadas, 0);
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
        descripcion: 'Preparación de clases y evaluación de estudiantes (máximo 50% de la carga lectiva asignada)',
        maxPercentageOfLectiva: 0.5,
        minHours: 0,
        requiredFields: [],
      },
      CONSEJERIA: {
        description: 'Tutoría y consejería a estudiantes (mínimo 1 hora semanal)',
        minHours: 1,
        requiredFields: ['numAlumnos', 'ciclo'],
      },
      INVESTIGACION: {
        description: 'Actividades de investigación científica (mínimo 4 horas semanales)',
        minHours: 4,
        requiredFields: ['codigoProyecto'],
      },
      CAPACITACION: {
        description: 'Capacitación o perfeccionamiento docente (máximo 5 horas semanales)',
        maxHours: 5,
        requiredFields: [],
      },
      ACTIVIDADES_DE_GOBIERNO: {
        description: 'Desempeño de cargos de gobierno universitario',
        requiredFields: ['cargo'],
      },
      ACTIVIDADES_DE_ADMINISTRACION: {
        description: 'Desempeño de cargos de administración académica',
        requiredFields: ['cargo'],
      },
      ASESORIA_DE_TESIS: {
        description: 'Asesoría de proyectos de tesis (requiere número de resolución decanal)',
        requiredFields: ['resolucion'],
      },
      RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        description: 'Proyectos de RSU o proyección social (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: [],
      },
      COMITES_TECNICOS_Y_COMISIONES: {
        description: 'Trabajo en comités técnicos o comisiones oficiales (requiere resolución)',
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
        const maxPermitido = Math.round((horasLectivas * 0.5) * 10) / 10;
        if (horasSemanales > maxPermitido) {
          throw new AppError(
            `Las horas de Preparación y Evaluación (${horasSemanales}h) exceden el límite reglamentario del 50% de su carga lectiva (${maxPermitido}h para una carga lectiva de ${horasLectivas}h).`,
            400,
            'PREPARACION_EXCEDE_LIMITE'
          );
        }
        break;
      }
      case TipoActividadNoLectiva.CONSEJERIA: {
        if (horasSemanales < 1) {
          throw new AppError('La actividad de Consejería requiere un mínimo de 1 hora semanal.', 400, 'CONSEJERIA_MIN_HORAS');
        }
        if (!metadata?.numAlumnos || !metadata?.ciclo) {
          throw new AppError('La actividad de Consejería requiere especificar el Número de Alumnos y el Ciclo en los metadatos.', 400, 'CONSEJERIA_METADATA_MISSING');
        }
        break;
      }
      case TipoActividadNoLectiva.INVESTIGACION: {
        if (horasSemanales < 4) {
          throw new AppError('La actividad de Investigación requiere un mínimo de 4 horas semanales.', 400, 'INVESTIGACION_MIN_HORAS');
        }
        if (!metadata?.codigoProyecto) {
          throw new AppError('La actividad de Investigación requiere especificar el Código del Proyecto de investigación.', 400, 'INVESTIGACION_METADATA_MISSING');
        }
        break;
      }
      case TipoActividadNoLectiva.CAPACITACION: {
        if (horasSemanales > 5) {
          throw new AppError('La actividad de Capacitación permite un máximo de 5 horas semanales.', 400, 'CAPACITACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ASESORIA_DE_TESIS: {
        if (!metadata?.resolucion) {
          throw new AppError('La actividad de Asesoría de Tesis requiere el Número de Resolución Decanal de aprobación.', 400, 'ASESORIA_METADATA_MISSING');
        }
        break;
      }
      case TipoActividadNoLectiva.RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Responsabilidad Social Universitaria permite un máximo de 2 horas semanales.', 400, 'RSU_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.COMITES_TECNICOS_Y_COMISIONES: {
        if (!metadata?.resolucion) {
          throw new AppError('La actividad en Comités o Comisiones requiere especificar el Número de Resolución de designación.', 400, 'COMITES_METADATA_MISSING');
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
