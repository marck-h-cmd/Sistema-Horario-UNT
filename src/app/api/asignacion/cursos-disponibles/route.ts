import { NextRequest } from 'next/server';
import { CargaLectivaService } from '@/services/cargaLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const service = new CargaLectivaService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['ADMINISTRADOR', 'OPERADOR', 'SUPER_ADMIN']);
  if (authResult) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const planEstudioId = searchParams.get('planEstudioId') || undefined;

    if (!periodoId) {
      return createErrorResponse('MISSING_PERIOD', 'El parámetro periodoId es requerido', 400);
    }

    const cursos = await service.listarCursosDisponibles(periodoId, planEstudioId);
    return createSuccessResponse(cursos);
  } catch (error: any) {
    console.error('Error en GET /api/asignacion/cursos-disponibles:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
