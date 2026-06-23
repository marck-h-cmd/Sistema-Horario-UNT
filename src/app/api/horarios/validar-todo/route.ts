import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ValidadorHorario } from '@/services/horarios/ValidadorHorario';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

const validador = new ValidadorHorario();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodoId } = body;

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere el ID del período', 400);
    }

    // Obtener todos los horarios del período
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { notIn: ['CANCELADO'] },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: { planEstudioCurso: true }
            }
          }
        }
      }
    });

    // Validar cada horario
    const resultados = [];
    for (const horario of horarios) {
      const cdg = (horario as any).cursoDocenteGrupo;
      const resultado = await validador.validarHorario(
        periodoId,
        cdg?.cursoDocente?.docenteId || '',
        cdg?.cursoDocente?.planEstudioCurso?.cursoId || '',
        horario.ambienteId || '',
        cdg?.grupoId || undefined,
        horario.diaSemana || 'LUNES',
        horario.horaInicio || '',
        horario.horaFin || '',
        horario.id
      );

      // Guardar validación en base de datos
      await prisma.validacionHorario.create({
        data: {
          horarioId: horario.id,
          tipoRegla: 'CRUCE_DOCENTE' as any,
          cumple: resultado.valido,
          mensaje: resultado.conflictos.map(c => c.mensaje).join('; '),
          metadata: resultado as any,
        },
      });

      resultados.push({
        horarioId: horario.id,
        ...resultado,
      });
    }

    const resumen = {
      totalHorarios: horarios.length,
      horariosValidos: resultados.filter(r => r.valido).length,
      horariosConConflictos: resultados.filter(r => !r.valido).length,
      detalles: resultados,
    };

    return createSuccessResponse(resumen);
  } catch (error: any) {
    console.error('Error validando todos los horarios:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al validar horarios', 500);
  }
}