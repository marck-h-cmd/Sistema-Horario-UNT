import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { CategoriaDocente } from '@prisma/client';
import { z } from 'zod';

const batchSchema = z.object({
  periodoId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  type: z.enum(['NOMBRADOS', 'CONTRATADOS']),
  timezoneOffset: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = batchSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const { periodoId, date, type, timezoneOffset } = validation.data;
    const offsetMinutos = timezoneOffset !== undefined ? timezoneOffset : 300; // Default a Perú (GMT-5 = 300)

    // Verificar que el período exista
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });
    if (!periodo) {
      return createErrorResponse('PERIODO_NOT_FOUND', 'Período no encontrado', 404);
    }

    // Definir las 4 configuraciones de ventanas por tipo
    const configNombrados = [
      { nombre: 'Principal Nombrado', categoria: CategoriaDocente.PRINCIPAL, inicio: '08:00', fin: '09:30' },
      { nombre: 'Asociado Nombrado', categoria: CategoriaDocente.ASOCIADO, inicio: '09:30', fin: '11:00' },
      { nombre: 'Auxiliar Nombrado', categoria: CategoriaDocente.AUXILIAR, inicio: '11:00', fin: '12:30' },
      { nombre: 'JP Nombrado', categoria: CategoriaDocente.INVITADO, inicio: '12:30', fin: '13:00' },
    ];

    const configContratados = [
      { nombre: 'Principal Contratado', categoria: CategoriaDocente.CONTRATADO, inicio: '08:00', fin: '09:30' },
      { nombre: 'Asociado Contratado', categoria: CategoriaDocente.CONTRATADO, inicio: '09:30', fin: '11:00' },
      { nombre: 'Auxiliar Contratado', categoria: CategoriaDocente.CONTRATADO, inicio: '11:00', fin: '12:30' },
      { nombre: 'JP Contratado', categoria: CategoriaDocente.CONTRATADO, inicio: '12:30', fin: '13:00' },
    ];

    const configSeleccionada = type === 'NOMBRADOS' ? configNombrados : configContratados;
    const creadas = [];

    for (const c of configSeleccionada) {
      const utcMsInicio = Date.parse(`${date}T${c.inicio}:00Z`);
      const utcMsFin = Date.parse(`${date}T${c.fin}:00Z`);

      const fechaInicio = new Date(utcMsInicio + offsetMinutos * 60 * 1000);
      const fechaFin = new Date(utcMsFin + offsetMinutos * 60 * 1000);

      const ventana = await prisma.ventanaAtencion.create({
        data: {
          periodoId,
          nombre: c.nombre,
          categorias: [c.categoria] as any,
          fechaInicio,
          fechaFin,
          estado: 'PROGRAMADA',
        },
      });
      creadas.push(ventana);
    }

    return createSuccessResponse({
      mensaje: `Se crearon las 4 ventanas para el día ${date} (${type})`,
      ventanas: creadas,
    }, undefined, 201);

  } catch (error: any) {
    console.error('Error en batch ventanas:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear lote de ventanas', 500);
  }
}
