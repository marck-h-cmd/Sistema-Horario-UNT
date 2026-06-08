import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ValidacionHorarioService } from '@/services/validacionHorarioService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const validatorService = new ValidacionHorarioService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE', 'ADMINISTRADOR', 'OPERADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    let docenteId = searchParams.get('docenteId');

    if (!periodoId) {
      return createErrorResponse('MISSING_PERIOD', 'El parámetro periodoId es requerido', 400);
    }

    // Si el usuario es DOCENTE, ignorar docenteId de query params y usar el suyo propio
    if (user.rol === 'DOCENTE') {
      const docente = await prisma.docente.findUnique({
        where: { usuarioId: user.userId },
      });
      if (!docente) {
        return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
      }
      docenteId = docente.id;
    } else if (!docenteId) {
      return createErrorResponse('MISSING_DOCENTE', 'El parámetro docenteId es requerido para administradores/operadores', 400);
    }

    const resultado = await validatorService.ejecutarValidaciones(docenteId, periodoId);
    return createSuccessResponse(resultado);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details);
    }
    console.error('Error en GET /api/declaracion/lectiva/validaciones:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
