import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    // Buscar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    const disponibilidad = await prisma.disponibilidadDocente.findMany({
      where: { docenteId: docente.id },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    return createSuccessResponse(disponibilidad);
  } catch (error: any) {
    console.error('Error en GET /api/horario/disponibilidad:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
