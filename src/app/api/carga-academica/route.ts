import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const planEstudioCursoId = searchParams.get('planEstudioCursoId') || undefined;
    const cursoId = searchParams.get('cursoId') || undefined;
    const docenteId = searchParams.get('docenteId') || undefined;
    const periodoId = searchParams.get('periodoId') || undefined;
    const search = searchParams.get('search') || undefined;

    const where: any = { activo: true };

    if (planEstudioCursoId) where.planEstudioCursoId = planEstudioCursoId;
    if (cursoId) where.planEstudioCurso = { cursoId };
    if (docenteId) where.docenteId = docenteId;
    if (periodoId) where.periodoId = periodoId;

    if (search) {
      where.OR = [
        { planEstudioCurso: { curso: { codigo: { contains: search, mode: 'insensitive' } } } },
        { planEstudioCurso: { curso: { nombre: { contains: search, mode: 'insensitive' } } } },
        {
          docente: {
            usuario: {
              OR: [
                { nombre: { contains: search, mode: 'insensitive' } },
                { apellidos: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cursoDocente.findMany({
        where,
        include: {
          planEstudioCurso: {
            include: {
              curso: { select: { id: true, codigo: true, nombre: true } }
            }
          },
          docente: {
            include: {
              usuario: { select: { nombre: true, apellidos: true, email: true } },
            },
          },
        },
        orderBy: [{ planEstudioCurso: { curso: { codigo: 'asc' } } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cursoDocente.count({ where }),
    ]);

    return createPaginatedResponse(items, page, limit, total);
  } catch (error) {
    console.error('Error listando carga académica:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar carga académica', 500);
  }
}
