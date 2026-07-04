import { NextRequest } from 'next/server';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { ROLES } from '@/lib/constantes';

const servicioHorario = new ServicioHorario();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, [
    ROLES.ADMINISTRADOR,
    ROLES.SECRETARIA,
    ROLES.OPERADOR,
  ]);
  if (authResult) return authResult;

  try {
    const user = request.user!;
    const horarioConfirmado = await servicioHorario.confirmar(params.id, user.userId);
    return createSuccessResponse(horarioConfirmado);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error al confirmar horario:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al confirmar horario', 500);
  }
}
