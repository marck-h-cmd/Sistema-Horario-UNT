import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'periodoId es requerido', 400);
    }

    const ventanas = await prisma.ventanaAtencion.findMany({
      where: { periodoId },
      include: {
        atenciones: {
          select: { estado: true }
        }
      },
      orderBy: { fechaInicio: 'asc' }
    });

    const reporte = ventanas.map(w => {
      const atendidos = w.atenciones.filter(a => a.estado === 'ATENDIDO').length;
      const pendientes = w.atenciones.filter(a => a.estado === 'ESPERANDO' || a.estado === 'EN_ATENCION').length;
      const ausentes = w.atenciones.filter(a => a.estado === 'AUSENTE').length;

      return {
        id: w.id,
        nombre: w.nombre,
        categorias: w.categorias,
        fechaInicio: w.fechaInicio,
        fechaFin: w.fechaFin,
        estado: w.estado,
        atendidos,
        pendientes,
        ausentes,
        total: w.atenciones.length
      };
    });

    return createSuccessResponse(reporte);

  } catch (error: any) {
    console.error('Error cargando reporte de cola:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al cargar reporte de cola', 500);
  }
}
