import { NextRequest } from 'next/server';
import { ServicioCurso } from '@/services/cursos/ServicioCurso';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';
import { z } from 'zod';

const servicioCurso = new ServicioCurso();

const cursoSchema = z.object({
  codigo: z.string().min(3).max(20),
  nombre: z.string().min(3).max(100),
  creditos: z.number().int().positive(),
  horasTeoria: z.number().int().min(0),
  horasPractica: z.number().int().min(0),
  horasLaboratorio: z.number().int().min(0),
  ciclo: z.number().int().min(1).max(10),
  tipoCurso: z.string().optional(),
  departamentoId: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const ciclo = parseInt(searchParams.get('ciclo') || '0');
    const departamentoId = parseInt(searchParams.get('departamentoId') || '0');
    const planEstudioId = searchParams.get('planEstudioId') || undefined;
    const activo = searchParams.get('activo') === 'true' ? true : 
                   searchParams.get('activo') === 'false' ? false : undefined;

    const resultado = await servicioCurso.listar({
      page,
      limit,
      search,
      ciclo: ciclo > 0 ? ciclo : undefined,
      departamentoId: departamentoId > 0 ? departamentoId : undefined,
      planEstudioId,
      activo,
    });

    return createPaginatedResponse(resultado.data, page, limit, resultado.meta.total);
  } catch (error: any) {
    console.error('Error listando cursos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar cursos', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = cursoSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const curso = await servicioCurso.crear(validation.data);
    return createSuccessResponse(curso, undefined, 201);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error creando curso:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear curso', 500);
  }
}
