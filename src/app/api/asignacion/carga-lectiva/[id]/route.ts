import { NextRequest } from 'next/server';
import { CargaLectivaService } from '@/services/cargaLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';

const service = new CargaLectivaService();

const updateSchema = z.object({
  periodoId: z.string().uuid(),
  docenteId: z.string().uuid(),
  cursoId: z.string().uuid(),
  grupoId: z.string().uuid(),
  componentes: z.array(z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO'])),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, ['ADMINISTRADOR', 'SUPER_ADMIN', 'OPERADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de asignación inválidos', 400, validation.error.errors);
    }

    // Para modificar, eliminamos primero la asignación actual e insertamos la nueva
    await service.eliminarCargaLectiva(params.id, user.userId);
    const resultado = await service.asignarCargaLectiva(validation.data, user.userId);

    return createSuccessResponse(resultado, 'Asignación modificada exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details);
    }
    console.error('Error en PUT /api/asignacion/carga-lectiva/[id]:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, ['ADMINISTRADOR', 'SUPER_ADMIN', 'OPERADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const resultado = await service.eliminarCargaLectiva(params.id, user.userId);
    return createSuccessResponse(resultado, 'Asignación removida exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error en DELETE /api/asignacion/carga-lectiva/[id]:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
