import { prisma } from '@/lib/prisma';
import { AppError } from '@/services/auth/AuthService';
import { TipoComponente, EstadoHorario, DedicacionDocente, Prisma } from '@prisma/client';

export interface AsignacionCargaInput {
  periodoId: string;
  docenteId: string;
  cursoId: string;
  grupoId: string;
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
  async listarCursosDisponibles(periodoId: string) {
    const cursos = await prisma.curso.findMany({
      where: { activo: true },
      include: {
        grupos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
    });

    const result = [];

    for (const curso of cursos) {
      const gruposConAsignaciones = [];

      for (const grupo of curso.grupos) {
        const horarios = await prisma.horario.findMany({
          where: {
            periodoId,
            cursoId: curso.id,
            grupoId: grupo.id,
            estado: { not: 'CANCELADO' },
          },
          include: {
            docente: {
              include: {
                usuario: { select: { nombre: true, apellidos: true } },
              },
            },
          },
        });

        const asignaciones = horarios.map((h) => ({
          horarioId: h.id,
          docenteId: h.docenteId,
          docenteNombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`,
          componente: h.tipoComponente,
          horas: this.obtenerHorasComponente(curso, h.tipoComponente),
          diaSemana: h.diaSemana,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          ambienteId: h.ambienteId,
          estado: h.estado,
        }));

        gruposConAsignaciones.push({
          id: grupo.id,
          nombre: grupo.nombre,
          capacidad: grupo.capacidad,
          asignaciones,
        });
      }

      result.push({
        id: curso.id,
        codigo: curso.codigo,
        nombre: curso.nombre,
        ciclo: curso.ciclo,
        horasTeoria: curso.horasTeoria,
        horasPractica: curso.horasPractica,
        horasLaboratorio: curso.horasLaboratorio,
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
      where.departamento = { equals: departamento, mode: 'insensitive' };
    }

    const docentes = await prisma.docente.findMany({
      where,
      include: {
        usuario: {
          select: { nombre: true, apellidos: true, email: true },
        },
      },
      orderBy: [{ codigo: 'asc' }],
    });

    const result = [];

    for (const docente of docentes) {
      // Sumar horas asignadas desde Horarios no cancelados en este período
      const horarios = await prisma.horario.findMany({
        where: {
          periodoId,
          docenteId: docente.id,
          estado: { not: 'CANCELADO' },
        },
        include: {
          curso: {
            select: { horasTeoria: true, horasPractica: true, horasLaboratorio: true },
          },
        },
      });

      let horasLectivasAsignadas = 0;
      for (const h of horarios) {
        horasLectivasAsignadas += this.obtenerHorasComponente(h.curso, h.tipoComponente);
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
        departamento: docente.departamento,
      });
    }

    return result;
  }

  /**
   * Asigna carga lectiva a un docente (asigna componentes específicos en un grupo)
   */
  async asignarCargaLectiva(datos: AsignacionCargaInput, creadorUsuarioId: string) {
    const { periodoId, docenteId, cursoId, grupoId, componentes } = datos;

    if (!componentes || componentes.length === 0) {
      throw new AppError('Debe especificar al menos un componente (TEORIA, PRACTICA o LABORATORIO) para asignar', 400, 'NO_COMPONENTS');
    }

    // 1. Obtener curso, docente y grupo
    const [curso, docente, grupo] = await Promise.all([
      prisma.curso.findUnique({ where: { id: cursoId } }),
      prisma.docente.findUnique({ where: { id: docenteId }, include: { usuario: true } }),
      prisma.grupo.findUnique({ where: { id: grupoId } }),
    ]);

    if (!curso) throw new AppError('Curso no encontrado', 404, 'CURSO_NOT_FOUND');
    if (!docente) throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    if (!grupo) throw new AppError('Grupo no encontrado', 404, 'GRUPO_NOT_FOUND');

    // 2. Calcular las horas de la nueva asignación
    let horasNuevaAsignacion = 0;
    for (const comp of componentes) {
      horasNuevaAsignacion += this.obtenerHorasComponente(curso, comp);
    }

    if (horasNuevaAsignacion === 0) {
      throw new AppError('Los componentes seleccionados no tienen horas asignadas en el plan de estudios del curso', 400, 'ZERO_HOURS');
    }

    // 3. Validar límite de horas del docente según dedicación
    const limiteHoras = this.obtenerHorasDedicacion(docente.dedicacion);
    const horariosExistentes = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId,
        estado: { not: 'CANCELADO' },
        // Excluir el grupo/curso actual para permitir la actualización de la asignación
        NOT: {
          cursoId,
          grupoId,
        },
      },
      include: {
        curso: {
          select: { horasTeoria: true, horasPractica: true, horasLaboratorio: true },
        },
      },
    });

    let horasLectivasAsignadas = 0;
    for (const h of horariosExistentes) {
      horasLectivasAsignadas += this.obtenerHorasComponente(h.curso, h.tipoComponente);
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
          cursoId,
          grupoId,
          tipoComponente: comp,
          estado: { not: 'CANCELADO' },
          docenteId: { not: docenteId },
        },
        include: {
          docente: { include: { usuario: true } },
        },
      });

      if (cruceGrupoComponente) {
        throw new AppError(
          `El componente de ${comp} para el grupo ${grupo.nombre} ya está asignado al docente ${cruceGrupoComponente.docente.usuario.nombre} ${cruceGrupoComponente.docente.usuario.apellidos}`,
          400,
          'COMPONENTE_DUPLICADO'
        );
      }
    }

    const advertencias: string[] = [];
    // 5. Advertir si hay cruce de horarios con clases previamente programadas del docente
    // (Solo aplica a horarios que ya tienen día y hora configurados)
    const horariosProgramadosDocente = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId,
        estado: { not: 'CANCELADO' },
        diaSemana: { not: null },
        horaInicio: { not: null },
        horaFin: { not: null },
      },
    });

    if (horariosProgramadosDocente.length > 0) {
      advertencias.push('El docente ya tiene una programación de horarios activa en este período. Verifique posibles cruces al asignar aulas y horarios.');
    }

    // 6. Transacción: Registrar Horarios en BORRADOR y actualizar CursoDocente
    const result = await prisma.$transaction(async (tx) => {
      // Eliminar asignaciones previas del docente en este grupo y curso
      await tx.horario.deleteMany({
        where: {
          periodoId,
          cursoId,
          grupoId,
          docenteId,
        },
      });

      const nuevosHorarios = [];
      for (const comp of componentes) {
        const horario = await tx.horario.create({
          data: {
            periodoId,
            cursoId,
            docenteId,
            grupoId,
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
          docenteId,
          cursoId,
          estado: { not: 'CANCELADO' },
        },
        include: {
          curso: {
            select: { horasTeoria: true, horasPractica: true, horasLaboratorio: true },
          },
        },
      });

      let totalHorasCursoDocente = 0;
      for (const h of todosHorariosCursoDocente) {
        totalHorasCursoDocente += this.obtenerHorasComponente(h.curso, h.tipoComponente);
      }

      // Upsert CursoDocente
      await tx.cursoDocente.upsert({
        where: {
          cursoId_docenteId: {
            cursoId,
            docenteId,
          },
        },
        create: {
          cursoId,
          docenteId,
          horasAsignadas: totalHorasCursoDocente,
          activo: true,
        },
        update: {
          horasAsignadas: totalHorasCursoDocente,
          activo: true,
        },
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
            cursoId,
            grupoId,
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
    });

    if (!horario) throw new AppError('Asignación no encontrada', 404, 'ASSIGNMENT_NOT_FOUND');

    await prisma.$transaction(async (tx) => {
      // Eliminar el horario
      await tx.horario.delete({
        where: { id: horarioId },
      });

      // Recalcular horas del docente en el curso
      const todosHorariosCursoDocente = await tx.horario.findMany({
        where: {
          docenteId: horario.docenteId,
          cursoId: horario.cursoId,
          estado: { not: 'CANCELADO' },
        },
        include: {
          curso: {
            select: { horasTeoria: true, horasPractica: true, horasLaboratorio: true },
          },
        },
      });

      let totalHorasCursoDocente = 0;
      for (const h of todosHorariosCursoDocente) {
        totalHorasCursoDocente += this.obtenerHorasComponente(h.curso, h.tipoComponente);
      }

      if (totalHorasCursoDocente > 0) {
        await tx.cursoDocente.update({
          where: {
            cursoId_docenteId: {
              cursoId: horario.cursoId,
              docenteId: horario.docenteId,
            },
          },
          data: { horasAsignadas: totalHorasCursoDocente },
        });
      } else {
        // Desactivar CursoDocente si ya no tiene horas
        await tx.cursoDocente.update({
          where: {
            cursoId_docenteId: {
              cursoId: horario.cursoId,
              docenteId: horario.docenteId,
            },
          },
          data: { horasAsignadas: 0, activo: false },
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
            docenteId: horario.docenteId,
            cursoId: horario.cursoId,
            grupoId: horario.grupoId,
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
