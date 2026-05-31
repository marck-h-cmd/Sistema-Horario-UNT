import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const ciclo = searchParams.get('ciclo');
    const cursoId = searchParams.get('cursoId');
    const docenteId = searchParams.get('docenteId');

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'El periodoId es requerido', 400);
    }

    const where: any = {
      periodoId,
      estado: 'PUBLICADO',
    };

    if (ciclo) {
      where.curso = { ciclo: parseInt(ciclo) };
    }
    if (cursoId) {
      where.cursoId = cursoId;
    }
    if (docenteId) {
      where.docenteId = docenteId;
    }

    const horarios = await prisma.horario.findMany({
      where,
      select: {
        id: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        curso: { select: { codigo: true, nombre: true, ciclo: true, horasTeoria: true, horasPractica: true, horasLaboratorio: true } },
        docente: { select: { usuario: { select: { nombre: true, apellidos: true } }, departamento: true } },
        ambiente: { select: { codigo: true, nombre: true } },
        grupo: { select: { nombre: true } }
      },
    });

    return createSuccessResponse(horarios);
  } catch (error: any) {
    console.error('Error listando horarios publicos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar horarios', 500);
  }
}
