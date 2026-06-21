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

    if (ciclo || cursoId || docenteId) {
      where.cursoDocenteGrupo = {
        cursoDocente: {
          ...(docenteId && { docenteId }),
          planEstudioCurso: {
            ...(ciclo && { ciclo: parseInt(ciclo) }),
            ...(cursoId && { cursoId })
          }
        }
      };
    }

    const horarios = await prisma.horario.findMany({
      where,
      select: {
        id: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        tipoComponente: true,
        ambiente: { select: { codigo: true, nombre: true } },
        cursoDocenteGrupo: {
          select: {
            grupo: {
              select: { nombre: true }
            },
            cursoDocente: {
              select: {
                docenteId: true,
                docente: { select: { usuario: { select: { nombre: true, apellidos: true } }, departamento: { select: { nombre: true } } } },
                planEstudioCurso: {
                  select: {
                    curso: { select: { codigo: true, nombre: true } },
                    ciclo: true,
                    horasTeoria: true,
                    horasPractica: true,
                    horasLaboratorio: true
                  }
                }
              }
            }
          }
        }
      },
    });

    const horariosFormateados = (horarios as any[]).map(h => {
      const cdg = h.cursoDocenteGrupo;
      return {
        ...h,
        docenteId: cdg?.cursoDocente?.docenteId,
        grupo: cdg?.grupo,
        curso: {
          ...cdg?.cursoDocente?.planEstudioCurso?.curso,
          ciclo: cdg?.cursoDocente?.planEstudioCurso?.ciclo,
          horasTeoria: cdg?.cursoDocente?.planEstudioCurso?.horasTeoria,
          horasPractica: cdg?.cursoDocente?.planEstudioCurso?.horasPractica,
          horasLaboratorio: cdg?.cursoDocente?.planEstudioCurso?.horasLaboratorio,
        },
        docente: {
          ...cdg?.cursoDocente?.docente,
          departamento: cdg?.cursoDocente?.docente?.departamento?.nombre ?? ''
        }
      };
    });

    return createSuccessResponse(horariosFormateados);
  } catch (error: any) {
    console.error('Error listando horarios publicos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar horarios', 500);
  }
}
