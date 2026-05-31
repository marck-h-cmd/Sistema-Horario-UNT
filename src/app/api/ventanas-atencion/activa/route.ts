import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { TemporizadorService } from '@/services/ventanas/TemporizadorService';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';

const gestorVentanas = new GestorVentanasAtencion();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docenteId = searchParams.get('docenteId');

    // Sincronizar automáticamente ventanas por fecha/hora
    await gestorVentanas.autoProcesarVentanas();

    const ventana = await prisma.ventanaAtencion.findFirst({
      where: {
        estado: { in: ['ABIERTA', 'EN_CURSO'] },
      },
      include: {
        periodo: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!ventana) {
      return createSuccessResponse(null);
    }

    // Si se proporciona docenteId, buscar su posición en la cola
    let posicionCola: number | undefined;
    let turnoActual: number | undefined;
    let tiempoRestanteSegundos: number | undefined;
    let atencionEstado: string | undefined;

    if (docenteId) {
      const atencion = await prisma.atencionVentana.findFirst({
        where: {
          ventanaId: ventana.id,
          docenteId: docenteId,
        },
      });

      if (atencion) {
        posicionCola = atencion.posicion;
        atencionEstado = atencion.estado;

        // Si el docente está siendo atendido, obtener el tiempo restante de Redis
        if (atencion.estado === 'EN_ATENCION') {
          const temporizadorService = new TemporizadorService();
          const resTiempo = await temporizadorService.getTiempoRestante(atencion.id);
          if (resTiempo) {
            tiempoRestanteSegundos = resTiempo.segundosRestantes;
          } else {
            // Si el timer expiró o no se creó, retornar 0
            tiempoRestanteSegundos = 0;
          }
        }
      }

      // Obtener el turno actual (el docente que está siendo atendido)
      const atencionActual = await prisma.atencionVentana.findFirst({
        where: {
          ventanaId: ventana.id,
          estado: 'EN_ATENCION',
        },
        select: {
          posicion: true,
        },
        orderBy: {
          posicion: 'asc',
        },
      });

      if (atencionActual) {
        turnoActual = atencionActual.posicion;
      } else {
        // Si no hay nadie "EN_ATENCION", buscar el último "ATENDIDO" o el primero "ESPERANDO"
        const ultimoAtendido = await prisma.atencionVentana.findFirst({
          where: {
            ventanaId: ventana.id,
            estado: 'ATENDIDO',
          },
          select: {
            posicion: true,
          },
          orderBy: {
            posicion: 'desc',
          },
        });
        turnoActual = (ultimoAtendido?.posicion ?? 0) + 1;
      }
    }

    return createSuccessResponse({
      ...ventana,
      posicionCola,
      turnoActual,
      tiempoRestanteSegundos,
      atencionEstado,
    });
  } catch (error: any) {
    console.error('Error al obtener ventana activa:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener ventana activa', 500);
  }
}
