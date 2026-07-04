import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { DiaSemana, EstadoHorario, Prisma } from '@prisma/client';
import { GestorNotificaciones } from '../notificaciones/GestorNotificaciones';
import { ValidadorHorario } from './ValidadorHorario';
import { ValidadorConflictos } from './ValidadorConflictos';
import { validarFranjaHorariaPermitida } from '@/lib/horario-horas';

export interface CrearHorarioDTO {
  periodoId: string;
  cursoId: string;
  docenteId: string;
  cursoDocenteGrupoId?: string;
  ambienteId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export interface FiltrosHorario {
  periodoId?: string;
  docenteId?: string;
  cursoId?: string;
  ambienteId?: string;
  diaSemana?: DiaSemana;
  estado?: EstadoHorario;
  ciclo?: number;
}

export interface PaginacionParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ServicioHorario {
  private gestorNotificaciones: GestorNotificaciones;
  private validadorHorario: ValidadorHorario;
  private validadorConflictos: ValidadorConflictos;

  constructor() {
    this.gestorNotificaciones = new GestorNotificaciones();
    this.validadorHorario = new ValidadorHorario();
    this.validadorConflictos = new ValidadorConflictos();
  }

  private mapHorario(horario: any) {
    if (!horario) return null;
    const cursoDocente = horario.cursoDocenteGrupo?.cursoDocente;
    return {
      ...horario,
      curso: cursoDocente?.planEstudioCurso?.curso ? {
        ...cursoDocente.planEstudioCurso.curso,
        ciclo: cursoDocente.planEstudioCurso.ciclo,
        horasTeoria: cursoDocente.planEstudioCurso.horasTeoria,
        horasPractica: cursoDocente.planEstudioCurso.horasPractica,
        horasLaboratorio: cursoDocente.planEstudioCurso.horasLaboratorio,
        creditos: cursoDocente.planEstudioCurso.creditos,
      } : null,
      docente: cursoDocente?.docente || null,
      grupo: horario.cursoDocenteGrupo?.grupo || null,
    };
  }

  async listar(filtros: FiltrosHorario, paginacion: PaginacionParams) {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = paginacion;
    const where: Prisma.HorarioWhereInput = {};

    if (filtros.periodoId) where.periodoId = filtros.periodoId;
    if (filtros.docenteId) where.cursoDocenteGrupo = { cursoDocente: { docenteId: filtros.docenteId } };
    if (filtros.cursoId) where.cursoDocenteGrupo = { ...where.cursoDocenteGrupo, cursoDocente: { ...((where.cursoDocenteGrupo as any)?.cursoDocente || {}), planEstudioCurso: { cursoId: filtros.cursoId } } };
    if (filtros.ambienteId) where.ambienteId = filtros.ambienteId;
    if (filtros.diaSemana) where.diaSemana = filtros.diaSemana;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.ciclo) where.cursoDocenteGrupo = { ...where.cursoDocenteGrupo, cursoDocente: { ...((where.cursoDocenteGrupo as any)?.cursoDocente || {}), planEstudioCurso: { ciclo: filtros.ciclo } } };

    const [horarios, total] = await Promise.all([
      prisma.horario.findMany({
        where,
        include: {
          cursoDocenteGrupo: {
            include: {
              grupo: true,
              cursoDocente: {
                include: {
                  docente: { include: { usuario: { select: { id: true, nombre: true, apellidos: true } } } },
                  planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } }
                }
              }
            }
          },
          ambiente: { select: { id: true, codigo: true, nombre: true, tipo: true } },
          periodo: { select: { id: true, nombre: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.horario.count({ where }),
    ]);

    return {
      data: horarios.map(h => this.mapHorario(h)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obtenerPorId(id: string) {
    const horario = await prisma.horario.findUnique({
      where: { id },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { id: true, nombre: true, apellidos: true, email: true } } } },
                planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } }
              }
            }
          }
        },
        ambiente: true,
        periodo: true,
        validaciones: true,
      },
    });

    if (!horario) {
      throw new AppError('Horario no encontrado', 404, 'HORARIO_NOT_FOUND');
    }

    return this.mapHorario(horario);
  }

  async crear(datos: CrearHorarioDTO, usuarioId: string) {
    // Validar que el período exista y esté activo
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: datos.periodoId },
    });
    if (!periodo) {
      throw new AppError('Período no encontrado', 404, 'PERIODO_NOT_FOUND');
    }
    if (periodo.estado === 'FINALIZADO' || periodo.estado === 'ARCHIVADO') {
      throw new AppError('El período no está activo', 400, 'PERIODO_NOT_ACTIVE');
    }

    // Validar que el grupo exista y pertenezca al curso
    let cursoDocenteGrupo = null;
    if (datos.cursoDocenteGrupoId) {
      cursoDocenteGrupo = await prisma.cursoDocenteGrupo.findUnique({
        where: { id: datos.cursoDocenteGrupoId },
        include: {
          cursoDocente: {
            include: {
              planEstudioCurso: true
            }
          }
        }
      });
      if (!cursoDocenteGrupo || cursoDocenteGrupo.cursoDocente.planEstudioCurso.cursoId !== datos.cursoId) {
        throw new AppError('Grupo no encontrado o no pertenece al curso', 404, 'GRUPO_NOT_FOUND');
      }
    } else {
      throw new AppError('El grupoId es requerido para el nuevo esquema de horarios', 400, 'GRUPO_REQUIRED');
    }

    // Validar que el docente asignado al grupo coincida
    if (cursoDocenteGrupo.cursoDocente.docenteId !== datos.docenteId) {
      throw new AppError('El docente no está asignado a este grupo', 400, 'DOCENTE_NO_ASIGNADO');
    }

    // Validar que el ambiente exista y esté activo
    const ambiente = await prisma.ambiente.findUnique({
      where: { id: datos.ambienteId },
    });
    if (!ambiente || !ambiente.activo) {
      throw new AppError('Ambiente no encontrado o inactivo', 404, 'AMBIENTE_NOT_FOUND');
    }

    const franja = validarFranjaHorariaPermitida(datos.horaInicio, datos.horaFin);
    if (!franja.valido) {
      throw new AppError(franja.mensaje!, 400, 'FRANJA_HORARIA_INVALIDA');
    }

    const validacion = await this.validadorHorario.validarHorario(
      datos.periodoId,
      datos.docenteId,
      datos.cursoId,
      datos.ambienteId,
      datos.cursoDocenteGrupoId,
      datos.diaSemana,
      datos.horaInicio,
      datos.horaFin
    );

    const validacionConflictos = await this.validadorConflictos.validarTodo({
      periodoId: datos.periodoId,
      docenteId: datos.docenteId,
      cursoId: datos.cursoId,
      ambienteId: datos.ambienteId,
      grupoId: datos.cursoDocenteGrupoId,
      diaSemana: datos.diaSemana,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      validarDocente: false,
      validarGrupo: false,
      validarAmbiente: true
    });

    const errorCruceAmbiente = validacionConflictos.conflictos.find(c => c.tipo === 'CRUCE_AULA' || c.tipo === 'CRUCE_LABORATORIO');
    if (errorCruceAmbiente) {
      throw new AppError(errorCruceAmbiente.mensaje, 409, 'CRUCE_AMBIENTE');
    }

    const errores = validacion.conflictos.filter((c) => c.severidad === 'ERROR' && c.tipo !== 'CRUCE_AMBIENTE');
    if (errores.length > 0) {
      throw new AppError(errores.map((e) => e.mensaje).join(' '), 400, 'VALIDACION_HORARIO');
    }





    const docente = await prisma.docente.findUnique({
      where: { id: datos.docenteId },
      select: { usuarioId: true },
    });

    const dataToCreate: any = {
      periodoId: datos.periodoId,
      ambienteId: datos.ambienteId,
      cursoDocenteGrupoId: datos.cursoDocenteGrupoId,
      diaSemana: datos.diaSemana,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      estado: 'BORRADOR',
      creadoPor: usuarioId,
      fechaCreacion: new Date(),
    };

    const horario = await prisma.horario.create({
      data: dataToCreate,
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                planEstudioCurso: { include: { curso: true } }
              }
            }
          }
        },
        ambiente: true,
        periodo: true,
      },
    });

    const alertasCarga = validacion.conflictos.filter(
      (c) => c.tipo === 'CARGA_HORARIA' || c.tipo === 'HORAS_REQUERIDAS'
    );
    if (docente && alertasCarga.length > 0) {
      try {
        await this.gestorNotificaciones.enviarNotificacion({
          usuarioId: docente.usuarioId,
          tipo: 'ALERTA_CARGA_HORARIA',
          titulo: 'Desfase de horas en programación',
          mensaje: alertasCarga.map((a) => a.mensaje).join(' '),
          prioridad: alertasCarga.some((a) => a.severidad === 'ERROR') ? 'ALTA' : 'MEDIA',
          canal: 'CORREO',
          metadata: { horarioId: horario.id, cursoId: datos.cursoId },
        });
      } catch (error) {
        console.error('Error enviando alerta de carga horaria:', error);
      }
    }

    return this.mapHorario(horario);
  }

  async confirmar(id: string, usuarioId: string) {
    const horario = await this.obtenerPorId(id);

    if (horario.estado === 'CONFIRMADO') {
      return horario;
    }

    if (horario.estado === 'PUBLICADO') {
      throw new AppError('No se puede confirmar un horario que ya está publicado', 400, 'HORARIO_PUBLICADO');
    }

    const horarioConfirmado = await prisma.horario.update({
      where: { id },
      data: {
        estado: 'CONFIRMADO',
        confirmadoPor: usuarioId,
        fechaConfirmacion: new Date(),
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { id: true, nombre: true, apellidos: true, email: true } } } },
                planEstudioCurso: { include: { curso: true } }
              }
            }
          }
        },
        ambiente: true,
      },
    });

    // Enviar notificación al docente
    try {
      await this.gestorNotificaciones.enviarNotificacion({
        usuarioId: horarioConfirmado.cursoDocenteGrupo.cursoDocente.docente.usuarioId,
        tipo: 'CONFIRMACION_HORARIO',
        titulo: 'Horario Confirmado',
        mensaje: `Se ha confirmado tu horario para el curso ${horarioConfirmado.cursoDocenteGrupo.cursoDocente.planEstudioCurso.curso.nombre} el día ${horarioConfirmado.diaSemana || 'Desconocido'} de ${horarioConfirmado.horaInicio || '--:--'} a ${horarioConfirmado.horaFin || '--:--'} en el ambiente ${horarioConfirmado.ambiente ? horarioConfirmado.ambiente.nombre : 'Sin ambiente'}.`,
        prioridad: 'ALTA',
        canal: 'SISTEMA',
        metadata: {
          horarioId: horarioConfirmado.id,
          cursoId: horarioConfirmado.cursoDocenteGrupo.cursoDocente.planEstudioCurso.cursoId,
        },
      });
    } catch (error) {
      console.error('Error enviando notificación de confirmación:', error);
      // No lanzamos error para no revertir la confirmación del horario
    }

    return this.mapHorario(horarioConfirmado);
  }

  async actualizar(id: string, datos: Partial<CrearHorarioDTO>, usuarioRol?: string) {
    const horario = await this.obtenerPorId(id);

    if (horario.estado === 'PUBLICADO' && usuarioRol !== 'ADMINISTRADOR') {
      throw new AppError('No se puede modificar un horario publicado', 400, 'HORARIO_PUBLICADO');
    }

    const horarioActualizado = await prisma.horario.update({
      where: { id },
      data: {
        ambienteId: datos.ambienteId,
        cursoDocenteGrupoId: datos.cursoDocenteGrupoId,
        diaSemana: datos.diaSemana,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        estado: 'BORRADOR', // Resetear estado al editar
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                planEstudioCurso: { include: { curso: true } }
              }
            }
          }
        },
        ambiente: true,
        periodo: true,
      },
    });

    return this.mapHorario(horarioActualizado);
  }

  async eliminar(id: string, usuarioRol?: string) {
    const horario = await this.obtenerPorId(id);

    if (horario.estado === 'PUBLICADO' && usuarioRol !== 'ADMINISTRADOR') {
      throw new AppError('No se puede eliminar un horario publicado', 400, 'HORARIO_PUBLICADO');
    }

    await prisma.horario.delete({
      where: { id },
    });

    return { message: 'Horario eliminado exitosamente' };
  }

  async obtenerPorDocente(docenteId: string, periodoId: string) {
    const horarios = await prisma.horario.findMany({
      where: {
        cursoDocenteGrupo: { cursoDocente: { docenteId } },
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } }
              }
            }
          }
        },
        ambiente: { select: { id: true, codigo: true, nombre: true, tipo: true } },
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    return horarios.map(h => this.mapHorario(h));
  }

  async obtenerPorAmbiente(ambienteId: string, periodoId: string) {
    const horarios = await prisma.horario.findMany({
      where: {
        ambienteId,
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } }
              }
            }
          }
        },
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    return horarios.map(h => this.mapHorario(h));
  }
}