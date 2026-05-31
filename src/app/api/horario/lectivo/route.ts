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

    // Obtener horarios que ya tienen programación en el calendario (diaSemana, horaInicio y horaFin no nulos)
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId: docente.id,
        estado: { not: 'CANCELADO' },
        diaSemana: { not: null },
        horaInicio: { not: null },
        horaFin: { not: null },
      },
      include: {
        curso: { select: { codigo: true, nombre: true } },
        grupo: { select: { nombre: true } },
        ambiente: { select: { nombre: true } },
      },
    });

    const items = horarios.map(h => ({
      id: h.id,
      tipo: 'LECTIVA',
      cursoCodigo: h.curso.codigo,
      cursoNombre: h.curso.nombre,
      grupoNombre: h.grupo?.nombre || null,
      ambienteNombre: h.ambiente?.nombre || null,
      tipoComponente: h.tipoComponente,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      estado: h.estado,
    }));

    return createSuccessResponse(items);
  } catch (error: any) {
    console.error('Error en GET /api/horario/lectivo:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
