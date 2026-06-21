import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { Prisma } from '@prisma/client';

export interface CursoFiltros {
  search?: string;
  ciclo?: number;
  activo?: boolean;
  departamentoId?: number;
  planEstudioId?: string;
  page?: number;
  limit?: number;
}

export interface CursoCreateInput {
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  ciclo: number;
  tipoCurso?: string;
  departamentoId?: number;
}

export interface CursoUpdateInput extends Partial<CursoCreateInput> {
  activo?: boolean;
}

export class ServicioCurso {
  private readonly CACHE_TTL = 600;

  async listar(filtros: CursoFiltros) {
    const {
      search,
      ciclo,
      activo,
      departamentoId,
      page = 1,
      limit = 20,
    } = filtros;

    const where: Prisma.PlanEstudioCursoWhereInput = {};

    if (search) {
      where.curso = {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
        ]
      };
    }

    if (ciclo) where.ciclo = ciclo;
    if (activo !== undefined) where.curso = { ...((where.curso as any) || {}), activo };
    if (departamentoId) where.departamentoId = departamentoId;
    if (filtros.planEstudioId) {
      where.planEstudioId = filtros.planEstudioId;
    } else {
      where.planEstudio = { activo: true };
    }

    const [planCursos, total] = await Promise.all([
      prisma.planEstudioCurso.findMany({
        where,
        include: {
          curso: true,
          departamento: {
            select: { id: true, nombre: true }
          },
          _count: {
            select: {
              cursosDocentes: true,
            },
          },
        },
        orderBy: [{ ciclo: 'asc' }, { curso: { codigo: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planEstudioCurso.count({ where }),
    ]);

    const result = planCursos.map(pc => ({
      id: pc.curso.id,
      planEstudioCursoId: pc.id,
      codigo: pc.curso.codigo,
      nombre: pc.curso.nombre,
      ciclo: pc.ciclo,
      creditos: pc.creditos,
      horasTeoria: pc.horasTeoria,
      horasPractica: pc.horasPractica,
      horasLaboratorio: pc.horasLaboratorio,
      activo: pc.curso.activo,
      departamento: pc.departamento,
      _count: {
        cursosDocente: pc._count.cursosDocentes,
      }
    }));

    return {
      data: result,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async obtenerPorId(id: string) {
    const curso = await prisma.curso.findUnique({
      where: { id },
      include: {
        planesEstudio: {
          where: { planEstudio: { activo: true } },
          include: {
            cursosDocentes: {
              where: { activo: true },
              include: {
                docente: {
                  include: {
                    usuario: {
                      select: { nombre: true, apellidos: true, email: true },
                    },
                  },
                },
                cursoDocenteGrupos: {
                  where: { activo: true },
                  include: { grupo: true }
                }
              },
            },
          }
        }
      },
    }) as any;

    if (!curso) {
      throw new AppError('Curso no encontrado', 404, 'CURSO_NOT_FOUND');
    }

    const pc = curso.planesEstudio[0];

    return {
      ...curso,
      ciclo: pc?.ciclo,
      creditos: pc?.creditos,
      horasTeoria: pc?.horasTeoria,
      horasPractica: pc?.horasPractica,
      horasLaboratorio: pc?.horasLaboratorio,
      cursosDocente: pc?.cursosDocentes || [],
      grupos: pc?.cursosDocentes.flatMap((cd: any) => cd.cursoDocenteGrupos) || [],
    };
  }

  async obtenerPorCodigo(codigo: string) {
    const curso = await prisma.curso.findUnique({
      where: { codigo },
      include: {
        planesEstudio: {
          where: { planEstudio: { activo: true } },
          include: {
            cursosDocentes: {
              include: { 
                cursoDocenteGrupos: { 
                  include: { 
                    grupo: true 
                  } 
                } 
              }
            }
          }
        }
      },
    }) as any;

    if (!curso) {
      throw new AppError('Curso no encontrado', 404, 'CURSO_NOT_FOUND');
    }

    const pc = curso.planesEstudio[0];

    return {
      ...curso,
      ciclo: pc?.ciclo,
      creditos: pc?.creditos,
      grupos: pc?.cursosDocentes.flatMap((cd: any) => cd.cursoDocenteGrupos) || [],
    };
  }

  async crear(datos: CursoCreateInput) {
    const existente = await prisma.curso.findUnique({
      where: { codigo: datos.codigo },
    });

    if (existente) {
      throw new AppError('Ya existe un curso con ese código', 409, 'CURSO_DUPLICADO');
    }

    const horasTotales = datos.horasTeoria + datos.horasPractica + datos.horasLaboratorio;
    if (horasTotales === 0) {
      throw new AppError('El curso debe tener al menos una hora asignada', 400, 'CURSO_SIN_HORAS');
    }

    let plan = await prisma.planEstudio.findFirst({ where: { activo: true } });
    if (!plan) {
      plan = await prisma.planEstudio.create({
        data: {
          nombre: `Plan ${new Date().getFullYear()}`,
          anio: new Date().getFullYear(),
          activo: true
        }
      });
    }

    const curso = await prisma.curso.create({
      data: {
        codigo: datos.codigo,
        nombre: datos.nombre,
        planesEstudio: {
          create: {
            planEstudioId: plan.id,
            ciclo: datos.ciclo,
            creditos: datos.creditos,
            horasTeoria: datos.horasTeoria,
            horasPractica: datos.horasPractica,
            horasLaboratorio: datos.horasLaboratorio,
            departamentoId: datos.departamentoId,
          }
        }
      },
      include: {
        planesEstudio: true,
      },
    });

    await this.invalidarCache();
    return curso;
  }

  async actualizar(id: string, datos: CursoUpdateInput) {
    const curso = await this.obtenerPorId(id);

    if (datos.codigo && datos.codigo !== curso.codigo) {
      const existente = await prisma.curso.findUnique({
        where: { codigo: datos.codigo },
      });
      if (existente) {
        throw new AppError('Ya existe un curso con ese código', 409, 'CURSO_DUPLICADO');
      }
    }

    const updateData: any = {};
    if (datos.codigo) updateData.codigo = datos.codigo;
    if (datos.nombre) updateData.nombre = datos.nombre;
    if (datos.activo !== undefined) updateData.activo = datos.activo;

    const cursoActualizado = await prisma.curso.update({
      where: { id },
      data: updateData,
    });
    
    // update planEstudioCurso
    await prisma.planEstudioCurso.updateMany({
      where: { cursoId: id, planEstudio: { activo: true } },
      data: {
        ...(datos.ciclo && { ciclo: datos.ciclo }),
        ...(datos.creditos && { creditos: datos.creditos }),
        ...(datos.horasTeoria !== undefined && { horasTeoria: datos.horasTeoria }),
        ...(datos.horasPractica !== undefined && { horasPractica: datos.horasPractica }),
        ...(datos.horasLaboratorio !== undefined && { horasLaboratorio: datos.horasLaboratorio }),
        ...(datos.departamentoId !== undefined && { departamentoId: datos.departamentoId }),
      }
    });

    await this.invalidarCache();
    return cursoActualizado;
  }

  async eliminar(id: string) {
    await prisma.curso.update({
      where: { id },
      data: { activo: false },
    });

    await this.invalidarCache();
  }

  async buscar(termino: string, limite: number = 10) {
    if (!termino || termino.length < 2) return [];

    const planes = await prisma.planEstudioCurso.findMany({
      where: {
        curso: {
          activo: true,
          OR: [
            { codigo: { contains: termino, mode: 'insensitive' } },
            { nombre: { contains: termino, mode: 'insensitive' } },
          ],
        },
        planEstudio: { activo: true }
      },
      include: { curso: true },
      take: limite,
      orderBy: { curso: { codigo: 'asc' } },
    });
    
    return planes.map(pc => ({
      id: pc.curso.id,
      codigo: pc.curso.codigo,
      nombre: pc.curso.nombre,
      creditos: pc.creditos,
      ciclo: pc.ciclo,
    }));
  }

  async obtenerPorCiclo(ciclo: number) {
    const cacheKey = `cursos:ciclo:${ciclo}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const planes = await prisma.planEstudioCurso.findMany({
      where: { ciclo, planEstudio: { activo: true }, curso: { activo: true } },
      include: {
        curso: true,
        cursosDocentes: {
          where: { activo: true },
          include: {
            cursoDocenteGrupos: {
              include: {
                grupo: true
              }
            }
          }
        }
      },
      orderBy: { curso: { codigo: 'asc' } },
    }) as any[];

    const cursos = planes.map(pc => ({
      ...pc.curso,
      ciclo: pc.ciclo,
      creditos: pc.creditos,
      grupos: pc.cursosDocentes.flatMap((cd: any) => cd.cursoDocenteGrupos),
    }));

    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(cursos));

    return cursos;
  }

  async asignarDocente(cursoId: string, docenteId: string, horasAsignadas: number) {
    await this.obtenerPorId(cursoId);
    
    const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
    if (!docente) {
      throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    }

    const pc = await prisma.planEstudioCurso.findFirst({
      where: { cursoId, planEstudio: { activo: true } }
    });
    
    if (!pc) throw new AppError('Plan estudio curso no encontrado', 404, 'PLAN_ESTUDIO_CURSO_NOT_FOUND');

    const periodo = await prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) throw new AppError('No hay periodo académico activo', 400, 'NO_PERIODO_ACTIVO');

    const existente = await prisma.cursoDocente.findUnique({
      where: {
        planEstudioCursoId_docenteId_periodoId: { planEstudioCursoId: pc.id, docenteId, periodoId: periodo.id },
      },
    });

    if (existente) {
      return prisma.cursoDocente.update({
        where: { id: existente.id },
        data: { horasAsignadas, activo: true },
      });
    }

    return prisma.cursoDocente.create({
      data: {
        planEstudioCursoId: pc.id,
        docenteId,
        periodoId: periodo.id,
        horasAsignadas,
      },
    });
  }

  async removerDocente(cursoId: string, docenteId: string) {
    const pc = await prisma.planEstudioCurso.findFirst({
      where: { cursoId, planEstudio: { activo: true } }
    });
    if (!pc) return;
    
    const periodo = await prisma.periodoAcademico.findFirst({ where: { activo: true } });
    if (!periodo) return;

    return prisma.cursoDocente.updateMany({
      where: { planEstudioCursoId: pc.id, docenteId, periodoId: periodo.id },
      data: { activo: false },
    });
  }

  private async invalidarCache(): Promise<void> {
    const keys = await redis.keys('cursos:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}