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
        cursoDocenteGrupo: {
          cursoDocente: { docenteId }
        },
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            cursoDocente: {
              include: {
                planEstudioCurso: true
              }
            }
          }
        }
      }
    });
    
    let horasLectivas = 0;
    for (const h of horarios) {
      const plan = h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso;
      if (!plan) continue;
      switch (h.tipoComponente) {
        case 'TEORIA': horasLectivas += plan.horasTeoria; break;
        case 'PRACTICA': horasLectivas += plan.horasPractica; break;
        case 'LABORATORIO': horasLectivas += plan.horasLaboratorio; break;
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
      include: {
        cargos: {
          where: { activo: true },
        },
      },
    });

    if (!docente) {
      throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    }

    // 1. Calcular horas disponibles
    const horasDedicacion = this.obtenerHorasDedicacion(docente.dedicacion);
    const horarios = await prisma.horario.findMany({
      where: {
        cursoDocenteGrupo: {
          cursoDocente: { docenteId }
        },
        periodoId,
        estado: { not: 'CANCELADO' }
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            cursoDocente: {
              include: {
                planEstudioCurso: true
              }
            }
          }
        }
      }
    });
    const parseTime = (t: string) => {
      const parts = t.split(':');
      return parseInt(parts[0], 10) + (parseInt(parts[1] || '0', 10) / 60);
    };

    let horasLectivas = 0;
    for (const h of horarios) {
      if (h.horaInicio && h.horaFin) {
        horasLectivas += parseTime(h.horaFin) - parseTime(h.horaInicio);
      } else {
        const plan = h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso;
        if (plan) {
          switch (h.tipoComponente) {
            case 'TEORIA': horasLectivas += plan.horasTeoria; break;
            case 'PRACTICA': horasLectivas += plan.horasPractica; break;
            case 'LABORATORIO': horasLectivas += plan.horasLaboratorio; break;
          }
        }
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
      this.validarActividad(item, horasLectivas, docente);
    }

    // 4. Persistir en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Buscar si ya existe la cabecera
      const existente = await tx.declaracionNoLectiva.findUnique({
        where: {
          docenteId_periodoId: { docenteId, periodoId },
        },
        include: {
          items: true,
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

      const itemsExistentes = existente?.items ?? [];
      const existentesPorTipo = new Map(
        itemsExistentes.map((item) => [item.tipoActividad, item])
      );
      const tiposEntrantes = new Set(items.map((item) => item.tipoActividad));
      const itemsSincronizados = [];

      // Actualizar o crear items, preservando IDs cuando la actividad ya existe
      for (const item of items) {
        const itemExistente = existentesPorTipo.get(item.tipoActividad);

        if (itemExistente) {
          // Si las horas declaradas disminuyeron, se invalida la distribución previa
          if (itemExistente.horasSemanales > item.horasSemanales) {
            await tx.distribucionNoLectiva.deleteMany({
              where: { declaracionItemId: itemExistente.id },
            });
          }

          const itemActualizado = await tx.declaracionNoLectivaItem.update({
            where: { id: itemExistente.id },
            data: {
              horasSemanales: item.horasSemanales,
              descripcion: item.descripcion,
              metadata: item.metadata || {},
            },
          });
          itemsSincronizados.push(itemActualizado);
          continue;
        }

        const itemCreado = await tx.declaracionNoLectivaItem.create({
          data: {
            declaracionId: declaracionId!,
            tipoActividad: item.tipoActividad,
            horasSemanales: item.horasSemanales,
            descripcion: item.descripcion,
            metadata: item.metadata || {},
          },
        });
        itemsSincronizados.push(itemCreado);
      }

      // Eliminar actividades removidas de la declaración
      const itemsEliminados = itemsExistentes.filter(
        (itemExistente) => !tiposEntrantes.has(itemExistente.tipoActividad)
      );

      if (itemsEliminados.length > 0) {
        const idsEliminados = itemsEliminados.map((item) => item.id);

        await tx.distribucionNoLectiva.deleteMany({
          where: {
            declaracionItemId: { in: idsEliminados },
          },
        });

        await tx.declaracionNoLectivaItem.deleteMany({
          where: {
            id: { in: idsEliminados },
          },
        });
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
        items: itemsSincronizados,
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
        descripcion: 'TC: Max 50% de carga lectiva. TP: Exactamente 4 horas.',
        maxPercentageOfLectiva: 0.5,
        minHours: 0,
        requiredFields: [],
      },
      CONSEJERIA: {
        description: 'Tutoría y consejería a estudiantes (máximo 2h, o 3h con excepción de acreditación para TC)',
        maxHours: 3,
        requiredFields: [],
      },
      INVESTIGACION: {
        description: 'Actividades de investigación científica (TC: max 6h, TP: max 3h)',
        maxHours: 6,
        requiredFields: ['codigoProyecto'],
      },
      CAPACITACION: {
        description: 'Capacitación o perfeccionamiento docente (TC: max 2h, TP: 0h)',
        maxHours: 2,
        requiredFields: [],
      },
      ACTIVIDADES_DE_GOBIERNO: {
        description: 'Desempeño de cargos de gobierno universitario (TC: según cargo, TP: 0h)',
        maxHours: 20,
        requiredFields: ['cargo'],
      },
      ACTIVIDADES_DE_ADMINISTRACION: {
        description: 'Desempeño de cargos de administración académica (TC: según cargo, TP: 0h)',
        maxHours: 20,
        requiredFields: ['cargo'],
      },
      ASESORIA_DE_TESIS: {
        description: 'Asesoría de proyectos de tesis (máximo 2 horas semanales)',
        maxHours: 2,
        requiredFields: ['resolucion'],
      },
      RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        description: 'Proyectos de RSU o proyección social (máximo 2h, o 3h con excepción de acreditación para TC)',
        maxHours: 3,
        requiredFields: ['proyecto'],
      },
      COMITES_TECNICOS_Y_COMISIONES: {
        description: 'Trabajo en comités técnicos o comisiones oficiales (TC: max 2h a 10h según comisión, TP: 0h)',
        maxHours: 10,
        requiredFields: ['resolucion'],
      },
    };
  }

  /**
   * Valida un item de actividad no lectiva según el reglamento
   */
  private validarActividad(item: DeclaracionItemInput, horasLectivas: number, docente: any) {
    const { tipoActividad, horasSemanales, metadata } = item;

    if (horasSemanales <= 0) {
      throw new AppError(`Las horas semanales para la actividad ${tipoActividad} deben ser mayores a 0`, 400, 'INVALID_HOURS');
    }

    const esTiempoCompleto = docente.dedicacion === DedicacionDocente.TIEMPO_COMPLETO_40H || docente.dedicacion === DedicacionDocente.DEDICACION_EXCLUSIVA;
    const esTiempoParcial = docente.dedicacion === DedicacionDocente.TIEMPO_PARCIAL_20H;

    switch (tipoActividad) {
      case TipoActividadNoLectiva.PREPARACION_Y_EVALUACION: {
        if (esTiempoCompleto) {
          const maxPermitido = Math.floor(horasLectivas * 0.5);
          if (horasSemanales > maxPermitido) {
            throw new AppError(
              `Las horas de Preparación y Evaluación (${horasSemanales}h) exceden el límite del 50% de su carga lectiva (${maxPermitido}h para una carga lectiva de ${horasLectivas}h).`,
              400,
              'PREPARACION_EXCEDE_LIMITE'
            );
          }
        } else if (esTiempoParcial) {
          if (horasSemanales !== 4) {
            throw new AppError(
              `Para docentes a Tiempo Parcial (TP1), las horas de Preparación y Evaluación deben ser exactamente 4 horas (valor actual: ${horasSemanales}h).`,
              400,
              'PREPARACION_EXCEDE_LIMITE'
            );
          }
        }
        break;
      }
      case TipoActividadNoLectiva.CONSEJERIA: {
        const excepcionAcreditacion = metadata?.excepcionAcreditacion === true;
        let maxPermitido = 2;
        if (esTiempoCompleto && excepcionAcreditacion) {
          maxPermitido = 3;
        }

        if (horasSemanales > maxPermitido) {
          throw new AppError(`La actividad de Consejería permite un máximo de ${maxPermitido} horas semanales${maxPermitido === 3 ? ' (con excepción por acreditación)' : ''}.`, 400, 'CONSEJERIA_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.INVESTIGACION: {
        const maxPermitido = esTiempoCompleto ? 6 : 3;
        if (horasSemanales > maxPermitido) {
          throw new AppError(`La actividad de Investigación permite un máximo de ${maxPermitido} horas semanales para su dedicación.`, 400, 'INVESTIGACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.CAPACITACION: {
        if (esTiempoParcial && horasSemanales > 0) {
          throw new AppError('Los docentes a Tiempo Parcial no pueden registrar horas en Formación Académica y Capacitación (0 horas).', 400, 'CAPACITACION_MAX_HORAS');
        }
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Capacitación permite un máximo de 2 horas semanales.', 400, 'CAPACITACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ACTIVIDADES_DE_GOBIERNO:
      case TipoActividadNoLectiva.ACTIVIDADES_DE_ADMINISTRACION: {
        if (esTiempoParcial) {
          throw new AppError('Los docentes a Tiempo Parcial no pueden registrar horas en Actividades de Gobierno o Administración (0 horas).', 400, 'GOBIERNO_MAX_HORAS');
        }

        const activeCargo = docente.cargos?.find((c: any) => c.activo);
        let maxPermitido = 2;
        
        if (activeCargo) {
          const tipoCargo = activeCargo.tipoCargo;
          if (tipoCargo === 'DECANO' || tipoCargo === 'DIRECTOR_DE_POSTGRADO') {
            maxPermitido = 20;
          } else if (tipoCargo === 'DIRECTOR_DE_ESCUELA' || tipoCargo === 'JEFE_DE_DEPARTAMENTO') {
            maxPermitido = 10;
          }
        }

        if (metadata?.esMiembroConsejoFacultad) {
          maxPermitido = Math.max(maxPermitido, 3);
        }

        if (horasSemanales > maxPermitido) {
          throw new AppError(`La actividad de ${tipoActividad === TipoActividadNoLectiva.ACTIVIDADES_DE_GOBIERNO ? 'Gobierno' : 'Administración'} permite un máximo de ${maxPermitido} horas semanales según su cargo.`, 400, 'ADMINISTRACION_MAX_HORAS');
        }
        break;
      }
      case TipoActividadNoLectiva.ASESORIA_DE_TESIS: {
        if (horasSemanales > 2) {
          throw new AppError('La actividad de Asesoría de Tesis permite un máximo de 2 horas semanales.', 400, 'ASESORIA_MAX_HORAS');
        }
        if (!metadata?.resolucion) {
          throw new AppError('Se requiere ingresar el Número de Resolución o Constancia oficial para la Asesoría de Tesis.', 400, 'FALTA_RESOLUCION');
        }
        break;
      }
      case TipoActividadNoLectiva.RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: {
        const excepcionAcreditacion = metadata?.excepcionAcreditacion === true;
        let maxPermitido = 2;
        if (esTiempoCompleto && excepcionAcreditacion) {
          maxPermitido = 3;
        }

        if (horasSemanales > maxPermitido) {
          throw new AppError(`La actividad de Responsabilidad Social Universitaria permite un máximo de ${maxPermitido} horas semanales${maxPermitido === 3 ? ' (con excepción por acreditación)' : ''}.`, 400, 'RSU_MAX_HORAS');
        }
        if (!metadata?.proyecto) {
          throw new AppError('Se requiere ingresar obligatoriamente el código/nombre del proyecto de RSU validado.', 400, 'FALTA_PROYECTO_RSU');
        }
        break;
      }
      case TipoActividadNoLectiva.COMITES_TECNICOS_Y_COMISIONES: {
        if (esTiempoParcial) {
          throw new AppError('Los docentes a Tiempo Parcial no pueden registrar horas en Comités Técnicos o Comisiones (0 horas).', 400, 'COMITES_MAX_HORAS');
        }
        
        let maxPermitido = 2;
        
        if (metadata?.esPresidenteCalidad) {
          maxPermitido = 10;
        } else if (metadata?.esComisionGeneral) {
          maxPermitido = 6;
        }

        if (horasSemanales > maxPermitido) {
          throw new AppError(`La actividad en Comités o Comisiones permite un máximo de ${maxPermitido} horas semanales según su designación.`, 400, 'COMITES_MAX_HORAS');
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
