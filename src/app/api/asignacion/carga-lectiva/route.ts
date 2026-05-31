import { NextRequest } from 'next/server';
import { CargaLectivaService } from '@/services/cargaLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';

const service = new CargaLectivaService();

const asignacionSchema = z.object({
  periodoId: z.string().uuid(),
  docenteId: z.string().uuid(),
  cursoId: z.string().uuid(),
  grupoId: z.string().uuid(),
  componentes: z.array(z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO'])),
});

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, ['ADMINISTRADOR', 'SUPER_ADMIN', 'OPERADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = asignacionSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de asignación inválidos', 400, validation.error.errors);
    }

    const resultado = await service.asignarCargaLectiva(validation.data, user.userId);
    return createSuccessResponse(resultado, 'Carga lectiva asignada exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details);
    }
    console.error('Error en POST /api/asignacion/carga-lectiva:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
