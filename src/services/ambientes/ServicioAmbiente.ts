import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { TipoAmbiente, Prisma } from '@prisma/client';

export interface AmbienteFiltros {
  search?: string;
  tipo?: TipoAmbiente;
  activo?: boolean;
  page?: number;
  limit?: number;
}

export interface AmbienteCreateInput {
  codigo: string;
  nombre: string;
  tipo: TipoAmbiente;
  capacidad: number;
  ubicacion?: string;
}

export interface AmbienteUpdateInput extends Partial<AmbienteCreateInput> {
  activo?: boolean;
}

export class ServicioAmbiente {
  async listar(filtros: AmbienteFiltros) {
    const {
      search,
      tipo,
      activo,
      page = 1,
      limit = 20,
    } = filtros;

    const where: Prisma.AmbienteWhereInput = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { ubicacion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tipo) where.tipo = tipo;
    if (activo !== undefined) where.activo = activo;

    const [ambientes, total] = await Promise.all([
      prisma.ambiente.findMany({
        where,
        include: {
          _count: {
            select: {
              horarios: true,
              mantenimientos: true,
            },
          },
        },
        orderBy: { codigo: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ambiente.count({ where }),
    ]);

    return {
      data: ambientes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obtenerPorId(id: string) {
    const ambiente = await prisma.ambiente.findUnique({
      where: { id },
      include: {
        horarios: {
          where: { estado: { not: 'CANCELADO' } },
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
                    planEstudioCurso: {
                      include: {
                        curso: { select: { nombre: true, codigo: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        mantenimientos: {
          where: { completado: false },
        },
      },
    }) as any;

    if (!ambiente) {
      throw new AppError('Ambiente no encontrado', 404, 'AMBIENTE_NOT_FOUND');
    }

    if (ambiente.horarios) {
      ambiente.horarios = ambiente.horarios.map((h: any) => {
        if (h.cursoDocenteGrupo) {
          return {
            ...h,
            grupo: {
              ...h.cursoDocenteGrupo.grupo,
              cursoDocente: h.cursoDocenteGrupo.cursoDocente
            }
          };
        }
        return h;
      });
    }

    return ambiente;
  }

  async crear(datos: AmbienteCreateInput) {
    const existente = await prisma.ambiente.findUnique({
      where: { codigo: datos.codigo },
    });

    if (existente) {
      throw new AppError('Ya existe un ambiente con ese código', 409, 'AMBIENTE_DUPLICADO');
    }

    return prisma.ambiente.create({
      data: datos,
    });
  }

  async actualizar(id: string, datos: AmbienteUpdateInput) {
    await this.obtenerPorId(id);

    if (datos.codigo) {
      const existente = await prisma.ambiente.findFirst({
        where: { 
          codigo: datos.codigo,
          id: { not: id }
        },
      });
      if (existente) {
        throw new AppError('Ya existe otro ambiente con ese código', 409, 'AMBIENTE_DUPLICADO');
      }
    }

    return prisma.ambiente.update({
      where: { id },
      data: datos,
    });
  }

  async eliminar(id: string) {
    const ambiente = await this.obtenerPorId(id);

    const horariosActivos = await prisma.horario.count({
      where: {
        ambienteId: id,
        estado: { in: ['CONFIRMADO', 'PUBLICADO'] },
      },
    });

    if (horariosActivos > 0) {
      throw new AppError(
        'No se puede eliminar el ambiente porque tiene horarios activos',
        409,
        'AMBIENTE_CON_HORARIOS'
      );
    }

    return prisma.ambiente.update({
      where: { id },
      data: { activo: false },
    });
  }
}
