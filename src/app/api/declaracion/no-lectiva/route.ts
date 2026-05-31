import { NextRequest } from 'next/server';
import { CargaNoLectivaService, DeclaracionItemInput } from '@/services/cargaNoLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const service = new CargaNoLectivaService();

const itemSchema = z.object({
  tipoActividad: z.enum([
    'PREPARACION_Y_EVALUACION',
    'CONSEJERIA',
    'INVESTIGACION',
    'CAPACITACION',
    'ACTIVIDADES_DE_GOBIERNO',
    'ACTIVIDADES_DE_ADMINISTRACION',
    'ASESORIA_DE_TESIS',
    'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA',
    'COMITES_TECNICOS_Y_COMISIONES',
  ]),
  horasSemanales: z.number().int().positive(),
  descripcion: z.string().optional(),
  metadata: z.any().optional(),
});

const saveSchema = z.object({
  periodoId: z.string().uuid(),
  items: z.array(itemSchema),
  observaciones: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');

    if (!periodoId) {
      return createErrorResponse('MISSING_PERIOD', 'El parámetro periodoId es requerido', 400);
    }

    // Buscar el docenteId asociado al usuario actual
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    const data = await service.obtenerDeclaracionActual(docente.id, periodoId);
    return createSuccessResponse(data);
  } catch (error: any) {
    console.error('Error en GET /api/declaracion/no-lectiva:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = saveSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de declaración inválidos', 400, validation.error.errors);
    }

    // Buscar el docenteId asociado al usuario actual
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    const resultado = await service.guardarDeclaracion(
      docente.id,
      validation.data.periodoId,
      validation.data.items,
      validation.data.observaciones,
      user.userId
    );

    return createSuccessResponse(resultado, 'Declaración no lectiva guardada exitosamente');
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details);
    }
    console.error('Error en POST /api/declaracion/no-lectiva:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
