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
  private readonly CACHE_TTL = 600; // 10 minutos

  async listar(filtros: CursoFiltros) {
    const {
      search,
      ciclo,
      activo,
      page = 1,
      limit = 20,
    } = filtros;

    const where: Prisma.CursoWhereInput = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (ciclo) where.ciclo = ciclo;
    if (activo !== undefined) where.activo = activo;
    if (filtros.departamentoId) where.departamentoId = filtros.departamentoId;
    if (filtros.planEstudioId) {
      where.planesEstudio = {
        some: { planEstudioId: filtros.planEstudioId }
      };
    }

    const [cursos, total] = await Promise.all([
      prisma.curso.findMany({
        where,
        include: {
          departamento: {
            select: { id: true, nombre: true }
          },
          grupos: {
            select: {
              id: true,
              nombre: true,
              capacidad: true,
              activo: true,
            },
            where: { activo: true },
          },
          _count: {
            select: {
              cursosDocente: true,
              horarios: true,
            },
          },
        },
        orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.curso.count({ where }),
    ]);

    return {
      data: cursos,
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
        grupos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
        },
        cursosDocente: {
          where: { activo: true },
          include: {
            docente: {
              include: {
                usuario: {
                  select: { nombre: true, apellidos: true, email: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            horarios: true,
          },
        },
      },
    });

    if (!curso) {
      throw new AppError('Curso no encontrado', 404, 'CURSO_NOT_FOUND');
    }

    return curso;
  }

  async obtenerPorCodigo(codigo: string) {
    const curso = await prisma.curso.findUnique({
      where: { codigo },
      include: {
        grupos: true,
      },
    });

    if (!curso) {
      throw new AppError('Curso no encontrado', 404, 'CURSO_NOT_FOUND');
    }

    return curso;
  }

  async crear(datos: CursoCreateInput) {
    // Validar código único
    const existente = await prisma.curso.findUnique({
      where: { codigo: datos.codigo },
    });

    if (existente) {
      throw new AppError('Ya existe un curso con ese código', 409, 'CURSO_DUPLICADO');
    }

    // Validar horas totales
    const horasTotales = datos.horasTeoria + datos.horasPractica + datos.horasLaboratorio;
    if (horasTotales === 0) {
      throw new AppError('El curso debe tener al menos una hora asignada', 400, 'CURSO_SIN_HORAS');
    }

    const curso = await prisma.curso.create({
      data: {
        ...datos,
        grupos: {
          create: [
            { nombre: 'A', capacidad: 30 },
            { nombre: 'B', capacidad: 30 },
          ],
        },
      },
      include: {
        grupos: true,
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

    const cursoActualizado = await prisma.curso.update({
      where: { id },
      data: datos,
      include: {
        grupos: true,
      },
    });

    await this.invalidarCache();

    return cursoActualizado;
  }

  async eliminar(id: string) {
    const curso = await this.obtenerPorId(id);

    const horariosActivos = await prisma.horario.count({
      where: {
        cursoId: id,
        estado: { in: ['CONFIRMADO', 'PUBLICADO'] },
      },
    });

    if (horariosActivos > 0) {
      throw new AppError(
        'No se puede eliminar el curso porque tiene horarios activos',
        409,
        'CURSO_CON_HORARIOS'
      );
    }

    await prisma.curso.update({
      where: { id },
      data: { activo: false },
    });

    await this.invalidarCache();
  }

  async buscar(termino: string, limite: number = 10) {
    if (!termino || termino.length < 2) return [];

    return prisma.curso.findMany({
      where: {
        activo: true,
        OR: [
          { codigo: { contains: termino, mode: 'insensitive' } },
          { nombre: { contains: termino, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        creditos: true,
        ciclo: true,
      },
      take: limite,
      orderBy: { codigo: 'asc' },
    });
  }

  async obtenerPorCiclo(ciclo: number) {
    const cacheKey = `cursos:ciclo:${ciclo}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const cursos = await prisma.curso.findMany({
      where: { ciclo, activo: true },
      include: {
        grupos: {
          where: { activo: true },
          select: { id: true, nombre: true },
        },
      },
      orderBy: { codigo: 'asc' },
    });

    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(cursos));

    return cursos;
  }

  async asignarDocente(cursoId: string, docenteId: string, horasAsignadas: number) {
    // Verificar que existan
    await this.obtenerPorId(cursoId);
    
    const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
    if (!docente) {
      throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    }

    const existente = await prisma.cursoDocente.findUnique({
      where: {
        cursoId_docenteId: { cursoId, docenteId },
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
        cursoId,
        docenteId,
        horasAsignadas,
      },
    });
  }

  async removerDocente(cursoId: string, docenteId: string) {
    return prisma.cursoDocente.updateMany({
      where: { cursoId, docenteId },
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