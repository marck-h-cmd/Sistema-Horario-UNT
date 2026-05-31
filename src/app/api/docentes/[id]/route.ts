import { NextRequest } from 'next/server';
import { ServicioDocente } from '@/services/docentes/ServicioDocente';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';
import { CategoriaDocente } from '@prisma/client';

const servicioDocente = new ServicioDocente();

const updateDocenteSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  apellidos: z.string().min(2).max(100).optional(),
  categoria: z.nativeEnum(CategoriaDocente).optional(),
  departamentoId: z.number().int().optional(),
  dni: z.string().length(8, 'El DNI debe tener exactamente 8 dígitos').regex(/^\d+$/, 'El DNI debe contener solo números').optional(),
  telefono: z.string().optional(),
  whatsapp: z.string().optional(),
  activo: z.boolean().optional(),
  fechaIngreso: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docente = await servicioDocente.obtenerPorId(params.id);
    return createSuccessResponse(docente);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error obteniendo docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener docente', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = updateDocenteSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const docente = await servicioDocente.actualizar(params.id, validation.data);
    return createSuccessResponse(docente);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error actualizando docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar docente', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await servicioDocente.eliminar(params.id);
    return createSuccessResponse({ message: 'Docente desactivado exitosamente' });
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error eliminando docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al eliminar docente', 500);
  }
}
