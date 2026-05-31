import { NextRequest } from 'next/server';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';
import { z } from 'zod';

const gestorVentanas = new GestorVentanasAtencion();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId') || undefined;
    const estado = searchParams.get('estado') as any || undefined;

    // Sincronizar automáticamente ventanas por fecha/hora
    await gestorVentanas.autoProcesarVentanas();

    const ventanas = await gestorVentanas.listarVentanas(periodoId, estado);

    return createSuccessResponse(ventanas);
  } catch (error: any) {
    console.error('Error listando ventanas:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar ventanas', 500);
  }
}

const crearVentanaSchema = z.object({
  periodoId: z.string().uuid(),
  nombre: z.string().min(3).max(100),
  categorias: z.array(z.string()).optional(),
  categoria: z.enum(['PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'CONTRATADO', 'INVITADO']).optional(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  ordenAtencion: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validation = crearVentanaSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const categorias = validation.data.categorias ?? 
                       (validation.data.categoria ? [validation.data.categoria] : 
                        validation.data.ordenAtencion ?? ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'CONTRATADO', 'INVITADO']);

    const ventana = await gestorVentanas.crearVentana({
      periodoId: validation.data.periodoId,
      nombre: validation.data.nombre,
      categorias,
      fechaInicio: validation.data.fechaInicio,
      fechaFin: validation.data.fechaFin,
    });

    return createSuccessResponse(ventana, undefined, 201);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error creando ventana:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear ventana', 500);
  }
}