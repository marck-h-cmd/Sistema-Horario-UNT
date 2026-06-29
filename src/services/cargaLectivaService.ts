import { prisma } from '@/lib/prisma';
import { AppError } from '@/services/auth/AuthService';
import { TipoComponente, EstadoHorario, DedicacionDocente, Prisma } from '@prisma/client';

export interface AsignacionCargaInput {
  periodoId: string;
  docenteId: string;
  cursoId?: string;
  planEstudioCursoId?: string;
  grupoNombre: string;
  componentes: TipoComponente[];
}

export class CargaLectivaService {
  /**
   * Obtiene la dedicación en horas numéricas de un docente
   */
  obtenerHorasDedicacion(dedicacion: DedicacionDocente): number {
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

  /**
   * Lista todos los cursos del período con sus grupos y asignaciones de docentes
   */
  async listarCursosDisponibles(periodoId: string, planEstudioId?: string) {
    let targetPlanId = planEstudioId;
    if (!targetPlanId) {
      const activePlan = await prisma.planEstudio.findFirst({
        where: { activo: true }
      });
      targetPlanId = activePlan?.id;
    }

    if (!targetPlanId) {
      return [];
    }

    const planCursos = await prisma.planEstudioCurso.findMany({
      where: { planEstudioId: targetPlanId },
      include: {
        curso: true,
        cursosDocentes: {
          where: { periodoId, activo: true },
          include: {
            cursoDocenteGrupos: {
              where: { activo: true },
              include: { grupo: true },
              orderBy: { grupo: { nombre: 'asc' } }
            }
          }
        }
      },
      orderBy: [{ ciclo: 'asc' }, { curso: { codigo: 'asc' } }],
    });

    const result = [];

    for (const pc of planCursos) {
      const gruposConAsignaciones = [];

      for (const cd of pc.cursosDocentes) {
        for (const cdg of cd.cursoDocenteGrupos) {
          const horarios = await prisma.horario.findMany({
            where: {
              periodoId,
              cursoDocenteGrupoId: cdg.id,
              estado: { not: 'CANCELADO' },
            },
            include: {
              cursoDocenteGrupo: {
                include: {
                  grupo: true,
                  cursoDocente: {
                    include: {
                      docente: {
                        include: {
                          usuario: { select: { nombre: true, apellidos: true } },
                        },
                      },
                    }
                  }
                }
              }
            },
          });

          const asignaciones = horarios.map((h) => ({
            horarioId: h.id,
            docenteId: h.cursoDocenteGrupo.cursoDocente.docenteId,
            docenteNombre: `${h.cursoDocenteGrupo.cursoDocente.docente.usuario.nombre} ${h.cursoDocenteGrupo.cursoDocente.docente.usuario.apellidos}`,
            componente: h.tipoComponente,
            horas: this.obtenerHorasComponente(pc, h.tipoComponente),
            diaSemana: h.diaSemana,
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            ambienteId: h.ambienteId,
            estado: h.estado,
          }));

          gruposConAsignaciones.push({
            id: cdg.id,
            nombre: cdg.grupo.nombre,
            capacidad: cdg.capacidad,
            asignaciones,
          });
        }
      }

      result.push({
        id: pc.cursoId,
        planEstudioCursoId: pc.id,
        codigo: pc.curso.codigo,
        nombre: pc.curso.nombre,
        ciclo: pc.ciclo,
        horasTeoria: pc.horasTeoria,
        horasPractica: pc.horasPractica,
        horasLaboratorio: pc.horasLaboratorio,
        creditos: pc.creditos,
        tipoCurso: pc.tipoCurso,
        grupos: gruposConAsignaciones,
      });
    }

    return result;
  }

  /**
   * Lista docentes disponibles de un departamento con sus horas lectivas asignadas en el período
   */
  async listarDocentesDisponibles(periodoId: string, departamento?: string) {
    const where: Prisma.DocenteWhereInput = {
      usuario: { activo: true },
    };

    if (departamento) {
      where.departamento = { nombre: { equals: departamento, mode: 'insensitive' } };
    }

    const docentes = await prisma.docente.findMany({
      where,
      include: {
        usuario: {
          select: { nombre: true, apellidos: true, email: true },
        },
        departamento: {
          select: { nombre: true }
        }
      },
      orderBy: [{ codigo: 'asc' }],
    });

    const result = [];

    for (const docente of docentes) {
      // Sumar horas asignadas desde Horarios no cancelados en este período
      const horarios = await prisma.horario.findMany({
        where: {
          periodoId,
          estado: { not: 'CANCELADO' },
          cursoDocenteGrupo: {
            cursoDocente: {
              docenteId: docente.id,
              periodoId
            }
          }
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
        },
      });

      let horasLectivasAsignadas = 0;
      const parseTime = (t: string) => {
        const parts = t.split(':');
        return parseInt(parts[0]) + (parseInt(parts[1] || '0') / 60);
      };

      for (const h of horarios) {
        const horas = h.horaInicio && h.horaFin 
          ? parseTime(h.horaFin) - parseTime(h.horaInicio)
          : this.obtenerHorasComponente(h.cursoDocenteGrupo.cursoDocente.planEstudioCurso, h.tipoComponente);
        horasLectivasAsignadas += horas;
      }

      result.push({
        id: docente.id,
        codigo: docente.codigo,
        nombreCompleto: `${docente.usuario.nombre} ${docente.usuario.apellidos}`,
        email: docente.usuario.email,
        categoria: docente.categoria,
        dedicacion: docente.dedicacion,
        horasDedicacion: this.obtenerHorasDedicacion(docente.dedicacion),
        horasLectivasAsignadas,
        departamento: docente.departamento?.nombre,
      });
    }

    return result;
  }

  /**
   * Asigna carga lectiva a un docente (asigna componentes específicos en un grupo)
   */
  async asignarCargaLectiva(datos: AsignacionCargaInput, creadorUsuarioId: string) {
    const { periodoId, docenteId, cursoId, planEstudioCursoId, grupoNombre, componentes } = datos;

    if (!componentes || componentes.length === 0) {
      throw new AppError('Debe especificar al menos un componente (TEORIA, PRACTICA o LABORATORIO) para asignar', 400, 'NO_COMPONENTS');
    }

    let targetPlanEstudioCursoId = planEstudioCursoId;
    if (!targetPlanEstudioCursoId && cursoId) {
      const activePlan = await prisma.planEstudio.findFirst({ where: { activo: true } });
      if (activePlan) {
        const pec = await prisma.planEstudioCurso.findUnique({
          where: {
            planEstudioId_cursoId: {
              planEstudioId: activePlan.id,
              cursoId
            }
          }
        });
        targetPlanEstudioCursoId = pec?.id;
      }
    }

    if (!targetPlanEstudioCursoId) {
      throw new AppError('No se pudo determinar la versión del plan de estudios del curso', 400, 'CURRICULUM_VERSION_NOT_FOUND');
    }

    // 1. Obtener planEstudioCurso, docente
    const [planEstudioCurso, docente] = await Promise.all([
      prisma.planEstudioCurso.findUnique({
        where: { id: targetPlanEstudioCursoId },
        include: { curso: true }
      }),
      prisma.docente.findUnique({ where: { id: docenteId }, include: { usuario: true } }),
    ]);

    if (!planEstudioCurso) throw new AppError('Curso en el plan de estudios no encontrado', 404, 'CURSO_PLAN_NOT_FOUND');
    if (!docente) throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');

    // 2. Calcular las horas de la nueva asignación
    let horasNuevaAsignacion = 0;
    for (const comp of componentes) {
      horasNuevaAsignacion += this.obtenerHorasComponente(planEstudioCurso, comp);
    }

    if (horasNuevaAsignacion === 0) {
      throw new AppError('Los componentes seleccionados no tienen horas asignadas en el plan de estudios del curso', 400, 'ZERO_HOURS');
    }

    // 3. Validar límite de horas del docente según dedicación
    const limiteHoras = this.obtenerHorasDedicacion(docente.dedicacion);
    const horariosExistentes = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
        cursoDocenteGrupo: {
          cursoDocente: {
            docenteId,
            periodoId,
            NOT: {
              planEstudioCursoId: targetPlanEstudioCursoId,
            }
          }
        }
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
      },
    });

    let horasLectivasAsignadas = 0;
    const componentesVistos = new Set<string>();
    for (const h of horariosExistentes) {
      if (h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso) {
        const key = `${h.cursoDocenteGrupoId}-${h.tipoComponente}`;
        if (!componentesVistos.has(key)) {
          horasLectivasAsignadas += this.obtenerHorasComponente(h.cursoDocenteGrupo.cursoDocente.planEstudioCurso, h.tipoComponente);
          componentesVistos.add(key);
        }
      }
    }

    const totalProyectado = horasLectivasAsignadas + horasNuevaAsignacion;
    if (totalProyectado > limiteHoras) {
      throw new AppError(
        `La asignación excede la dedicación del docente (${limiteHoras}h). Actualmente tiene ${horasLectivasAsignadas}h asignadas y se intentan asignar ${horasNuevaAsignacion}h adicionales (Total: ${totalProyectado}h).`,
        400,
        'EXCEDE_DEDICACION'
      );
    }

    // 4. Validar cruce de grupo y componente (No duplicar componente en otro docente)
    for (const comp of componentes) {
      const cruceGrupoComponente = await prisma.horario.findFirst({
        where: {
          periodoId,
          tipoComponente: comp,
          estado: { not: 'CANCELADO' },
          cursoDocenteGrupo: {
            grupo: { nombre: grupoNombre },
            cursoDocente: {
              planEstudioCursoId: targetPlanEstudioCursoId,
              docenteId: { not: docenteId },
              periodoId
            }
          }
        },
        include: {
          cursoDocenteGrupo: {
            include: {
              cursoDocente: {
                include: {
                  docente: { include: { usuario: true } }
                }
              }
            }
          }
        }
      });

      if (cruceGrupoComponente) {
        throw new AppError(
          `El componente de ${comp} para el grupo ${grupoNombre} ya está asignado al docente ${cruceGrupoComponente.cursoDocenteGrupo?.cursoDocente.docente.usuario.nombre} ${cruceGrupoComponente.cursoDocenteGrupo?.cursoDocente.docente.usuario.apellidos}`,
          400,
          'COMPONENTE_DUPLICADO'
        );
      }
    }

    const advertencias: string[] = [];
    // 5. Advertir si hay cruce de horarios con clases previamente programadas del docente
    const horariosProgramadosDocente = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
        diaSemana: { not: null },
        horaInicio: { not: null },
        horaFin: { not: null },
        cursoDocenteGrupo: {
          cursoDocente: {
            docenteId,
            periodoId
          }
        }
      },
    });

    if (horariosProgramadosDocente.length > 0) {
      advertencias.push('El docente ya tiene una programación de horarios activa en este período. Verifique posibles cruces al asignar aulas y horarios.');
    }

    // 6. Transacción: Registrar Horarios en BORRADOR y actualizar CursoDocente
    const result = await prisma.$transaction(async (tx) => {
      // Find or create CursoDocente
      let cd = await tx.cursoDocente.findUnique({
        where: {
          planEstudioCursoId_docenteId_periodoId: {
            planEstudioCursoId: targetPlanEstudioCursoId,
            docenteId,
            periodoId
          }
        }
      });

      if (!cd) {
        cd = await tx.cursoDocente.create({
          data: {
            planEstudioCursoId: targetPlanEstudioCursoId,
            docenteId,
            periodoId,
            horasAsignadas: 0,
            activo: true
          }
        });
      } else if (!cd.activo) {
        cd = await tx.cursoDocente.update({
          where: { id: cd.id },
          data: { activo: true }
        });
      }

      // Find static Grupo
      const grupo = await tx.grupo.findUnique({
        where: { nombre: grupoNombre }
      });

      if (!grupo) {
        throw new AppError(`El grupo ${grupoNombre} no existe en el catálogo estático`, 400, 'GRUPO_NOT_FOUND');
      }

      // Find or create CursoDocenteGrupo
      let cdg = await tx.cursoDocenteGrupo.findUnique({
        where: {
          cursoDocenteId_grupoId: {
            cursoDocenteId: cd.id,
            grupoId: grupo.id
          }
        }
      });

      if (!cdg) {
        cdg = await tx.cursoDocenteGrupo.create({
          data: {
            cursoDocenteId: cd.id,
            grupoId: grupo.id,
            capacidad: 40 // Default capacity
          }
        });
      }

      // Eliminar asignaciones previas del docente en este grupo
      await tx.horario.deleteMany({
        where: {
          periodoId,
          cursoDocenteGrupoId: cdg.id,
        },
      });

      const nuevosHorarios = [];
      for (const comp of componentes) {
        const horario = await tx.horario.create({
          data: {
            periodoId,
            cursoDocenteGrupoId: cdg.id,
            tipoComponente: comp,
            estado: EstadoHorario.BORRADOR,
            creadoPor: creadorUsuarioId,
          },
        });
        nuevosHorarios.push(horario);
      }

      // Calcular total de horas para CursoDocente
      const todosHorariosCursoDocente = await tx.horario.findMany({
        where: {
          periodoId,
          estado: { not: 'CANCELADO' },
          cursoDocenteGrupo: {
            cursoDocenteId: cd.id
          }
        },
      });

      let totalHorasCursoDocente = 0;
      const componentesVistos2 = new Set<string>();
      for (const h of todosHorariosCursoDocente) {
        const key = `${h.cursoDocenteGrupoId}-${h.tipoComponente}`;
        if (!componentesVistos2.has(key)) {
          totalHorasCursoDocente += this.obtenerHorasComponente(planEstudioCurso, h.tipoComponente);
          componentesVistos2.add(key);
        }
      }

      // Update CursoDocente
      await tx.cursoDocente.update({
        where: { id: cd.id },
        data: {
          horasAsignadas: totalHorasCursoDocente,
          activo: true
        }
      });

      // Auditoría
      await tx.registroAuditoria.create({
        data: {
          usuarioId: creadorUsuarioId,
          accion: 'ASIGNAR_CARGA_LECTIVA',
          entidad: 'Horario',
          datos: {
            periodoId,
            docenteId,
            planEstudioCursoId: targetPlanEstudioCursoId,
            grupoNombre,
            componentes,
            totalHoras: horasNuevaAsignacion,
          },
        },
      });

      return nuevosHorarios;
    });

    return {
      asignaciones: result,
      advertencias,
    };
  }

  /**
   * Remueve una asignación de carga (elimina el registro en Horario y actualiza CursoDocente)
   */
  async eliminarCargaLectiva(horarioId: string, usuarioId: string) {
    const horario = await prisma.horario.findUnique({
      where: { id: horarioId },
      include: {
        cursoDocenteGrupo: {
          include: {
            cursoDocente: true
          }
        }
      }
    });

    if (!horario) throw new AppError('Asignación no encontrada', 404, 'ASSIGNMENT_NOT_FOUND');

    const cdId = horario.cursoDocenteGrupo.cursoDocenteId;

    await prisma.$transaction(async (tx) => {
      // Eliminar el horario
      await tx.horario.delete({
        where: { id: horarioId },
      });

      // Recalcular horas del docente en el CursoDocente
      const todosHorariosCursoDocente = await tx.horario.findMany({
        where: {
          cursoDocenteGrupo: {
            cursoDocenteId: cdId
          },
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

      let totalHorasCursoDocente = 0;
      const componentesVistos3 = new Set<string>();
      for (const h of todosHorariosCursoDocente) {
        const key = `${h.cursoDocenteGrupoId}-${h.tipoComponente}`;
        if (!componentesVistos3.has(key)) {
          totalHorasCursoDocente += this.obtenerHorasComponente(h.cursoDocenteGrupo.cursoDocente.planEstudioCurso, h.tipoComponente);
          componentesVistos3.add(key);
        }
      }

      if (totalHorasCursoDocente > 0) {
        await tx.cursoDocente.update({
          where: { id: cdId },
          data: { horasAsignadas: totalHorasCursoDocente },
        });
      } else {
        // Desactivar CursoDocente si ya no tiene horas
        await tx.cursoDocente.update({
          where: { id: cdId },
          data: { horasAsignadas: 0, activo: false },
        });
        await tx.cursoDocenteGrupo.update({
          where: { id: horario.cursoDocenteGrupoId },
          data: { activo: false }
        });
      }

      // Auditoría
      await tx.registroAuditoria.create({
        data: {
          usuarioId,
          accion: 'ELIMINAR_CARGA_LECTIVA',
          entidad: 'Horario',
          entidadId: horarioId,
          datos: {
            docenteId: horario.cursoDocenteGrupo.cursoDocente.docenteId,
            planEstudioCursoId: horario.cursoDocenteGrupo.cursoDocente.planEstudioCursoId,
            cursoDocenteGrupoId: horario.cursoDocenteGrupoId,
            componente: horario.tipoComponente,
          },
        },
      });
    });

    return { message: 'Asignación eliminada exitosamente' };
  }

  /**
   * Helper para obtener las horas asociadas a un componente específico de un curso
   */
  obtenerHorasComponente(
    curso: { horasTeoria: number; horasPractica: number; horasLaboratorio: number },
    componente: TipoComponente
  ): number {
    switch (componente) {
      case TipoComponente.TEORIA:
        return curso.horasTeoria;
      case TipoComponente.PRACTICA:
        return curso.horasPractica;
      case TipoComponente.LABORATORIO:
        return curso.horasLaboratorio;
      default:
        return 0;
    }
  }
}
