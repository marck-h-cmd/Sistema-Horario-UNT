import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');

    if (!periodoId) {
      return createErrorResponse('MISSING_PERIOD', 'El parámetro periodoId es requerido', 400);
    }

    // Buscar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    const distribuciones = await prisma.distribucionNoLectiva.findMany({
      where: {
        docenteId: docente.id,
        periodoId,
      },
      include: {
        declaracionItem: {
          select: {
            tipoActividad: true,
            descripcion: true,
          },
        },
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    const items = distribuciones.map(d => ({
      id: d.id,
      tipo: 'NO_LECTIVA',
      declaracionItemId: d.declaracionItemId,
      tipoActividad: d.declaracionItem.tipoActividad,
      descripcion: d.declaracionItem.descripcion || '',
      diaSemana: d.diaSemana,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
    }));

    return createSuccessResponse(items);
  } catch (error: any) {
    console.error('Error en GET /api/horario/no-lectivo/distribucion:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
