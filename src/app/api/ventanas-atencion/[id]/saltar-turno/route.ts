import { NextRequest } from 'next/server';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

const gestorVentanas = new GestorVentanasAtencion();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { deltaSeconds } = body;

    if (typeof deltaSeconds !== 'number' || deltaSeconds <= 0) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere un deltaSeconds numérico mayor que cero', 400);
    }

    const resultado = await gestorVentanas.saltarTurno(params.id, deltaSeconds);
    return createSuccessResponse(resultado);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error al saltar turno:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al saltar turno', 500);
  }
}
