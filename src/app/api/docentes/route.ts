import { NextRequest } from 'next/server';
import { ServicioDocente } from '@/services/docentes/ServicioDocente';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';
import { z } from 'zod';
import { CategoriaDocente } from '@prisma/client';

const servicioDocente = new ServicioDocente();

const docenteSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(100),
  apellidos: z.string().min(2).max(100),
  codigo: z.string().min(3).max(20),
  categoria: z.nativeEnum(CategoriaDocente),
  departamento: z.string().optional(),
  telefono: z.string().optional(),
  whatsapp: z.string().optional(),
  fechaIngreso: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const categoria = searchParams.get('categoria') as CategoriaDocente || undefined;
    const activo = searchParams.get('activo') === 'true' ? true : 
                   searchParams.get('activo') === 'false' ? false : undefined;
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') || undefined) as 'asc' | 'desc' | undefined;

    const resultado = await servicioDocente.listar({
      page,
      limit,
      search,
      categoria,
      activo,
      sortBy,
      sortOrder,
    });

    return createPaginatedResponse(resultado.data, page, limit, resultado.meta.total);
  } catch (error: any) {
    console.error('Error listando docentes:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar docentes', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = docenteSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const docente = await servicioDocente.crear(validation.data);
    return createSuccessResponse(docente, undefined, 201);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error creando docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear docente', 500);
  }
}
