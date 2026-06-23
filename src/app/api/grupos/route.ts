import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const cursoId = searchParams.get('cursoId') || undefined;
    const ciclo = parseInt(searchParams.get('ciclo') || '0');
    const activo = searchParams.get('activo') === 'true' ? true :
      searchParams.get('activo') === 'false' ? false : undefined;

    const where: any = {};

    if (cursoId) {
      where.cursoDocente = { planEstudioCurso: { cursoId } };
    } else if (ciclo > 0) {
      where.cursoDocente = { planEstudioCurso: { ciclo } };
    }

    if (activo !== undefined) {
      where.activo = activo;
    }

    if (search) {
      where.OR = [
        { grupo: { nombre: { contains: search, mode: 'insensitive' } } },
        { cursoDocente: { planEstudioCurso: { curso: { nombre: { contains: search, mode: 'insensitive' } } } } },
        { cursoDocente: { planEstudioCurso: { curso: { codigo: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [grupos, total] = await Promise.all([
      prisma.cursoDocenteGrupo.findMany({
        where,
        include: {
          grupo: true,
          cursoDocente: {
            include: {
              planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } },
              docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } }
            }
          },
          _count: {
            select: { horarios: true },
          },
        },
        orderBy: [
          { cursoDocente: { planEstudioCurso: { ciclo: 'asc' } } },
          { cursoDocente: { planEstudioCurso: { curso: { codigo: 'asc' } } } },
          { grupo: { nombre: 'asc' } },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cursoDocenteGrupo.count({ where }),
    ]);

    const mappedGrupos = grupos.map(g => ({
      id: g.id,
      nombre: g.grupo.nombre,
      capacidad: g.capacidad,
      activo: g.activo,
      cursoDocenteId: g.cursoDocenteId,
      grupoId: g.grupoId,
      curso: {
        ...g.cursoDocente?.planEstudioCurso?.curso,
        ciclo: g.cursoDocente?.planEstudioCurso?.ciclo,
      },
      docenteNombre: g.cursoDocente?.docente?.usuario
        ? `${g.cursoDocente.docente.usuario.nombre} ${g.cursoDocente.docente.usuario.apellidos}`
        : 'Sin Asignar',
      _count: g._count,
    }));

    return createPaginatedResponse(mappedGrupos, page, limit, total);
  } catch (error: any) {
    console.error('Error listando grupos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar grupos', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cursoDocenteId = body.cursoDocenteId || body.cursoId;

    if (!cursoDocenteId) {
      return createErrorResponse('BAD_REQUEST', 'El cursoDocenteId es requerido', 400);
    }

    if (!body.nombre) {
      return createErrorResponse('BAD_REQUEST', 'El nombre del grupo es requerido', 400);
    }

    let staticGrupo = await prisma.grupo.findUnique({
      where: { nombre: body.nombre },
    });

    if (!staticGrupo) {
      staticGrupo = await prisma.grupo.create({
        data: { nombre: body.nombre }
      });
    }

    const cdg = await prisma.cursoDocenteGrupo.create({
      data: {
        cursoDocenteId,
        grupoId: staticGrupo.id,
        capacidad: body.capacidad || 40,
        activo: body.activo ?? true,
      },
      include: {
        grupo: true,
        cursoDocente: {
          include: { planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } } }
        },
        _count: {
          select: { horarios: true },
        },
      },
    });

    const mappedGrupo = {
      id: cdg.id,
      nombre: cdg.grupo.nombre,
      capacidad: cdg.capacidad,
      activo: cdg.activo,
      cursoDocenteId: cdg.cursoDocenteId,
      grupoId: cdg.grupoId,
      curso: {
        ...cdg.cursoDocente?.planEstudioCurso?.curso,
        ciclo: cdg.cursoDocente?.planEstudioCurso?.ciclo,
      },
      _count: cdg._count,
    };

    return createSuccessResponse(mappedGrupo, undefined, 201);
  } catch (error: any) {
    console.error('Error creando grupo:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear grupo', 500);
  }
}