import { NextRequest } from 'next/server';
import { CargaNoLectivaService } from '@/services/cargaNoLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const service = new CargaNoLectivaService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE', 'ADMINISTRADOR', 'OPERADOR']);
  if (authResult) return authResult;

  try {
    const reglas = service.obtenerReglasValidacion();
    return createSuccessResponse(reglas);
  } catch (error: any) {
    console.error('Error en GET /api/declaracion/no-lectiva/validaciones:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
