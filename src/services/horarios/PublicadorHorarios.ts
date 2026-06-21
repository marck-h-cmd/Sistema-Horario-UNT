import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { EstadoHorario } from '@prisma/client';

export interface ResultadoPublicacion {
  periodoId: string;
  horariosPublicados: number;
  errores: string[];
  advertencias: string[];
}

export class PublicadorHorarios {
  /**
   * Publica todos los horarios confirmados de un período
   */
  async publicar(periodoId: string, usuarioId: string): Promise<ResultadoPublicacion> {
    const resultado: ResultadoPublicacion = {
      periodoId,
      horariosPublicados: 0,
      errores: [],
      advertencias: [],
    };

    // Verificar que el período exista
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo) {
      throw new AppError('Período no encontrado', 404, 'PERIODO_NOT_FOUND');
    }

    if (periodo.estado === 'FINALIZADO' || periodo.estado === 'ARCHIVADO') {
      throw new AppError('No se puede publicar en un período finalizado o archivado', 400, 'PERIODO_NO_ACTIVO');
    }

    // Verificar que haya horarios para publicar
    const horariosConfirmados = await prisma.horario.count({
      where: {
        periodoId,
        estado: 'CONFIRMADO',
      },
    });

    if (horariosConfirmados === 0) {
      resultado.advertencias.push('No hay horarios confirmados para publicar');
      return resultado;
    }

    // Verificar conflictos antes de publicar
    const conflictos = await this.verificarConflictosPrePublicacion(periodoId);
    if (conflictos.length > 0) {
      resultado.advertencias.push(
        `Se encontraron ${conflictos.length} conflictos. Revise antes de publicar.`
      );
    }

    // Publicar en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar todos los horarios confirmados a publicados
      const publicacion = await tx.horario.updateMany({
        where: {
          periodoId,
          estado: 'CONFIRMADO',
        },
        data: {
          estado: 'PUBLICADO',
          publicado: true,
        },
      });

      resultado.horariosPublicados = publicacion.count;

      // 2. Cancelar horarios en borrador que no fueron confirmados
      await tx.horario.updateMany({
        where: {
          periodoId,
          estado: 'BORRADOR',
        },
        data: {
          estado: 'CANCELADO',
        },
      });

      // 3. Actualizar estado del período
      await tx.periodoAcademico.update({
        where: { id: periodoId },
        data: {
          estado: 'ACTIVO',
          activo: true,
        },
      });
    });

    // Invalidar cachés
    await this.invalidarCaches(periodoId);

    // Notificar vía WebSocket
    await redis.publish('ws:horarios', JSON.stringify({
      type: 'horarios:publicados',
      data: {
        periodoId,
        cantidad: resultado.horariosPublicados,
        publicadoPor: usuarioId,
      },
      timestamp: new Date().toISOString(),
    }));

    return resultado;
  }

  /**
   * Despublica los horarios de un período
   */
  async despublicar(periodoId: string, usuarioId: string): Promise<ResultadoPublicacion> {
    const resultado: ResultadoPublicacion = {
      periodoId,
      horariosPublicados: 0,
      errores: [],
      advertencias: [],
    };

    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo) {
      throw new AppError('Período no encontrado', 404, 'PERIODO_NOT_FOUND');
    }

    if (periodo.estado !== 'ACTIVO') {
      throw new AppError('Solo se pueden despublicar horarios de períodos activos', 400, 'PERIODO_NO_ACTIVO');
    }

    await prisma.$transaction(async (tx) => {
      const despublicacion = await tx.horario.updateMany({
        where: {
          periodoId,
          estado: 'PUBLICADO',
        },
        data: {
          estado: 'CONFIRMADO',
          publicado: false,
        },
      });

      resultado.horariosPublicados = despublicacion.count;

      await tx.periodoAcademico.update({
        where: { id: periodoId },
        data: {
          estado: 'BORRADOR',
          activo: false,
        },
      });
    });

    await this.invalidarCaches(periodoId);

    await redis.publish('ws:horarios', JSON.stringify({
      type: 'horarios:despublicados',
      data: {
        periodoId,
        cantidad: resultado.horariosPublicados,
        despublicadoPor: usuarioId,
      },
      timestamp: new Date().toISOString(),
    }));

    return resultado;
  }

  /**
   * Verifica conflictos antes de publicar
   */
  private async verificarConflictosPrePublicacion(periodoId: string): Promise<any[]> {
    const conflictos = await prisma.validacionHorario.findMany({
      where: {
        cumple: false,
        horario: {
          periodoId,
          estado: 'CONFIRMADO',
        },
      },
      include: {
        horario: {
          include: {
            cursoDocenteGrupo: {
              include: {
                grupo: true,
                cursoDocente: {
                  include: {
                    docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                    planEstudioCurso: { include: { curso: { select: { codigo: true, nombre: true } } } }
                  }
                }
              }
            }
          },
        },
      },
    });

    return conflictos;
  }

  /**
   * Obtiene el estado de publicación de un período
   */
  async obtenerEstadoPublicacion(periodoId: string): Promise<{
    periodoId: string;
    estadoPeriodo: string;
    totalHorarios: number;
    borradores: number;
    confirmados: number;
    publicados: number;
    cancelados: number;
    porcentajePublicado: number;
  }> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo) {
      throw new AppError('Período no encontrado', 404, 'PERIODO_NOT_FOUND');
    }

    const [total, borradores, confirmados, publicados, cancelados] = await Promise.all([
      prisma.horario.count({ where: { periodoId } }),
      prisma.horario.count({ where: { periodoId, estado: 'BORRADOR' } }),
      prisma.horario.count({ where: { periodoId, estado: 'CONFIRMADO' } }),
      prisma.horario.count({ where: { periodoId, estado: 'PUBLICADO' } }),
      prisma.horario.count({ where: { periodoId, estado: 'CANCELADO' } }),
    ]);

    return {
      periodoId,
      estadoPeriodo: periodo.estado,
      totalHorarios: total,
      borradores,
      confirmados,
      publicados,
      cancelados,
      porcentajePublicado: total > 0 ? Math.round((publicados / total) * 100) : 0,
    };
  }

  private async invalidarCaches(periodoId: string): Promise<void> {
    const keys = await redis.keys(`disponibilidad:${periodoId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del(`estadisticas:resumen:${periodoId}`);
  }
}