import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { ROLES } from '@/lib/constantes';
import { ControladorColaDocentes } from '@/services/ventanas/ControladorColaDocentes';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';

const reprogramarSchema = z.object({
  docenteId: z.string().uuid(),
});

/**
 * Handler POST para reprogramar el turno de un docente ausente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMINISTRADOR,
    ROLES.OPERADOR,
  ]);
  if (authResult) return authResult;

  try {
    const body = await request.json();
    const validation = reprogramarSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const { docenteId } = validation.data;
    const controlador = new ControladorColaDocentes();
    await controlador.reprogramarTurno(params.id, docenteId);

    const colaActualizada = await controlador.obtenerColaFormateada(params.id);

    return createSuccessResponse(colaActualizada, 'Turno reprogramado exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error reprogramando turno:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al reprogramar el turno', 500);
  }
}
