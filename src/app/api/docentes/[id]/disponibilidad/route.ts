import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { DiaSemana } from '@prisma/client';
import { z } from 'zod';

const slotsSchema = z.array(z.object({
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: z.string(),
  horaFin: z.string(),
}));

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const disponibilidad = await prisma.disponibilidadDocente.findMany({
      where: { docenteId: params.id },
      select: {
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
      },
    });

    return createSuccessResponse(disponibilidad);
  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener disponibilidad', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docenteId = params.id;
    
    // Verificar si puede modificar (no tiene horarios confirmados en el periodo activo)
    const periodoActivo = await prisma.periodoAcademico.findFirst({
      where: { activo: true },
    });

    if (periodoActivo) {
      const horariosConfirmados = await prisma.horario.findFirst({
        where: {
          docenteId,
          periodoId: periodoActivo.id,
          estado: { in: ['CONFIRMADO', 'PUBLICADO'] }
        },
      });

      if (horariosConfirmados) {
        return createErrorResponse(
          'LOCKED_ERROR',
          'No puedes modificar tu disponibilidad porque ya tienes horarios confirmados para este periodo.',
          403
        );
      }
    }

    const body = await request.json();
    const validation = slotsSchema.safeParse(body.slots);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de disponibilidad inválidos', 400);
    }

    const slots = validation.data;

    // Actualizar en transacción: borrar existentes y crear nuevos
    await prisma.$transaction(async (tx) => {
      await tx.disponibilidadDocente.deleteMany({
        where: { docenteId },
      });

      if (slots.length > 0) {
        await tx.disponibilidadDocente.createMany({
          data: slots.map(slot => ({
            docenteId,
            diaSemana: slot.diaSemana,
            horaInicio: slot.horaInicio,
            horaFin: slot.horaFin,
            prioridad: 1, // Por defecto
          })),
        });
      }
    });

    return createSuccessResponse({ message: 'Disponibilidad actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar disponibilidad', 500);
  }
}
