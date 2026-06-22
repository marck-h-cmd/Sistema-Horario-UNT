import { NextRequest } from 'next/server';
import { ServicioCurso } from '@/services/cursos/ServicioCurso';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';

const servicioCurso = new ServicioCurso();

const updateCursoSchema = z.object({
  codigo: z.string().min(3).max(20).optional(),
  nombre: z.string().min(3).max(100).optional(),
  creditos: z.number().int().positive().optional(),
  horasTeoria: z.number().int().min(0).optional(),
  horasPractica: z.number().int().min(0).optional(),
  horasLaboratorio: z.number().int().min(0).optional(),
  ciclo: z.number().int().min(1).max(10).optional(),
  tipoCurso: z.string().optional(),
  departamentoId: z.number().int().optional(),
  activo: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const curso = await servicioCurso.obtenerPorId(params.id);
    return createSuccessResponse(curso);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error obteniendo curso:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener curso', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = updateCursoSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const curso = await servicioCurso.actualizar(params.id, validation.data);
    return createSuccessResponse(curso);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error actualizando curso:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar curso', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await servicioCurso.eliminar(params.id);
    return createSuccessResponse({ message: 'Curso desactivado exitosamente' });
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error eliminando curso:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al eliminar curso', 500);
  }
}
