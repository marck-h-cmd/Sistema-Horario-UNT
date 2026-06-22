import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId') ?? undefined;

    const docente = await prisma.docente.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'Docente no encontrado', 404);
    }

    const where: any = { cursoDocenteGrupo: { cursoDocente: { docenteId: params.id } } };
    if (periodoId) where.periodoId = periodoId;

    const horarios = await prisma.horario.findMany({
      where,
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: { planEstudioCurso: { include: { curso: true } } }
            }
          }
        },
        periodo: {
          select: { id: true, nombre: true, estado: true },
        },
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const mappedHorarios = horarios.map((h: any) => ({
      ...h,
      grupo: h.cursoDocenteGrupo ? {
        ...h.cursoDocenteGrupo.grupo,
        cursoDocente: h.cursoDocenteGrupo.cursoDocente
      } : null
    }));

    return createSuccessResponse(mappedHorarios);
  } catch (error: any) {
    console.error('Error obteniendo horario del docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener horario', 500);
  }
}