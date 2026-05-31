import { NextRequest } from 'next/server';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

const gestorVentanas = new GestorVentanasAtencion();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Sincronizar automáticamente ventanas por fecha/hora
    await gestorVentanas.autoProcesarVentanas();

    const ventana = await gestorVentanas.obtenerVentana(params.id);
    return createSuccessResponse(ventana);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error obteniendo ventana:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener ventana', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    // Implementar actualización si es necesario
    return createSuccessResponse({ message: 'Ventana actualizada' });
  } catch (error: any) {
    console.error('Error actualizando ventana:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar ventana', 500);
  }
}