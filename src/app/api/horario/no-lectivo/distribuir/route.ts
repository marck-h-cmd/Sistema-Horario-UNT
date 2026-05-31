import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';
import { DiaSemana } from '@prisma/client';

const distribucionItemSchema = z.object({
  declaracionItemId: z.string().uuid(),
  diaSemana: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']),
  horaInicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato HH:MM requerido'),
  horaFin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato HH:MM requerido'),
});

const distributeSchema = z.object({
  periodoId: z.string().uuid(),
  distribuciones: z.array(distribucionItemSchema),
});

function parseTimeToDecimal(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = distributeSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de distribución inválidos', 400, validation.error.errors);
    }

    const { periodoId, distribuciones } = validation.data;

    // 1. Buscar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    // 2. Obtener declaración e items
    const declaracion = await prisma.declaracionNoLectiva.findUnique({
      where: {
        docenteId_periodoId: {
          docenteId: docente.id,
          periodoId,
        },
      },
      include: {
        items: true,
      },
    });

    if (!declaracion) {
      return createErrorResponse('DECLARATION_NOT_FOUND', 'Debe registrar su declaración no lectiva antes de distribuir las horas.', 400);
    }

    const itemsMap = new Map(declaracion.items.map(i => [i.id, i]));

    // 3. Validar horas distribuidas por item
    const itemHorasDistribuidas = new Map<string, number>();
    
    for (const dist of distribuciones) {
      if (!itemsMap.has(dist.declaracionItemId)) {
        return createErrorResponse('INVALID_ITEM', `El item de declaración ${dist.declaracionItemId} no pertenece a este docente o período`, 400);
      }

      const inicio = parseTimeToDecimal(dist.horaInicio);
      const fin = parseTimeToDecimal(dist.horaFin);

      if (inicio >= fin) {
        return createErrorResponse('INVALID_TIME_RANGE', `La hora de inicio (${dist.horaInicio}) debe ser menor que la hora de fin (${dist.horaFin})`, 400);
      }

      const duracion = fin - inicio;
      const actual = itemHorasDistribuidas.get(dist.declaracionItemId) || 0;
      itemHorasDistribuidas.set(dist.declaracionItemId, actual + duracion);
    }

    // Verificar que no se excedan las horas declaradas para cada actividad
    for (const [itemId, horas] of itemHorasDistribuidas.entries()) {
      const item = itemsMap.get(itemId)!;
      if (horas > item.horasSemanales) {
        return createErrorResponse(
          'EXCEDE_HORAS_DECLARADAS',
          `Las horas distribuidas para ${item.tipoActividad} (${horas}h) superan las horas declaradas (${item.horasSemanales}h).`,
          400
        );
      }
    }

    // 4. Guardar distribuciones en una transacción
    await prisma.$transaction(async (tx) => {
      // Limpiar distribuciones anteriores de este docente en este período
      await tx.distribucionNoLectiva.deleteMany({
        where: {
          docenteId: docente.id,
          periodoId,
        },
      });

      // Crear las nuevas
      if (distribuciones.length > 0) {
        await tx.distribucionNoLectiva.createMany({
          data: distribuciones.map(d => ({
            docenteId: docente.id,
            periodoId,
            declaracionItemId: d.declaracionItemId,
            diaSemana: d.diaSemana as DiaSemana,
            horaInicio: d.horaInicio,
            horaFin: d.horaFin,
          })),
        });
      }

      // Registrar auditoría
      await tx.registroAuditoria.create({
        data: {
          usuarioId: user.userId,
          accion: 'DISTRIBUIR_HORAS_NO_LECTIVAS',
          entidad: 'DeclaracionNoLectiva',
          entidadId: declaracion.id,
          datos: {
            periodoId,
            cantidadBloques: distribuciones.length,
          },
        },
      });
    });

    return createSuccessResponse(null, 'Distribución de horas no lectivas guardada exitosamente');
  } catch (error: any) {
    console.error('Error en POST /api/horario/no-lectivo/distribuir:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
