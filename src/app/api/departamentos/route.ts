import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const departamentos = await prisma.departamentoAcademico.findMany({
      include: {
        facultad: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });
    
    return createSuccessResponse(departamentos);
  } catch (error: any) {
    console.error('Error al obtener departamentos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener departamentos', 500);
  }
}
