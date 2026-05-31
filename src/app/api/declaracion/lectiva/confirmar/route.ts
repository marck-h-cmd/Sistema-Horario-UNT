import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ValidacionHorarioService } from '@/services/validacionHorarioService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';

const validatorService = new ValidacionHorarioService();

const confirmSchema = z.object({
  periodoId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = confirmSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'El periodoId es requerido y debe ser un UUID válido', 400);
    }

    const { periodoId } = validation.data;

    // Buscar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    const resultado = await validatorService.confirmarCargaLectiva(docente.id, periodoId, user.userId);
    return createSuccessResponse(resultado, 'Carga académica lectiva confirmada exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details);
    }
    console.error('Error en POST /api/declaracion/lectiva/confirmar:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
