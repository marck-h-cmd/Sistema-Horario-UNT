import { NextRequest } from 'next/server';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { ROLES } from '@/lib/constantes';

const servicioHorario = new ServicioHorario();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere el ID del período', 400);
    }

    const horarios = await servicioHorario.obtenerPorDocente(params.id, periodoId);

    return createSuccessResponse(horarios);
  } catch (error: any) {
    console.error('Error obteniendo horario del docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener horario', 500);
  }
}

export async function PUT(
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
    const user = request.user;
    const horario = await servicioHorario.actualizar(params.id, body, user);
    return createSuccessResponse(horario);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error actualizando horario:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar horario', 500);
  }
}

export async function DELETE(
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
    const user = request.user;
    const resultado = await servicioHorario.eliminar(params.id, user);
    return createSuccessResponse(resultado);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error eliminando horario:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al eliminar horario', 500);
  }
}