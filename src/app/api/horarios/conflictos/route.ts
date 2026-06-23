import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere el ID del período', 400);
    }

    // Obtener validaciones que no cumplen
    const conflictos = await prisma.validacionHorario.findMany({
      where: {
        cumple: false,
        horario: {
          periodoId,
        },
      },
      include: {
        horario: {
          include: {
            cursoDocenteGrupo: {
              include: {
                grupo: true,
                cursoDocente: {
                  include: {
                    docente: {
                      include: {
                        usuario: { select: { nombre: true, apellidos: true } },
                      },
                    },
                    planEstudioCurso: {
                      include: {
                        curso: { select: { codigo: true, nombre: true } },
                      },
                    },
                  },
                },
              },
            },
            ambiente: { select: { codigo: true, nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Agrupar por tipo de conflicto
    const conflictosAgrupados = conflictos.reduce((acc: any, conflicto) => {
      const tipo = conflicto.tipoRegla;
      if (!acc[tipo]) {
        acc[tipo] = {
          tipo,
          cantidad: 0,
          conflictos: [],
        };
      }
      acc[tipo].cantidad++;
      const cMod = {
        ...conflicto,
        horario: {
          ...conflicto.horario,
          curso: conflicto.horario.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso,
          docente: conflicto.horario.cursoDocenteGrupo?.cursoDocente?.docente,
          grupo: conflicto.horario.cursoDocenteGrupo?.grupo,
        }
      };
      acc[tipo].conflictos.push(cMod);
      return acc;
    }, {});

    return createSuccessResponse({
      totalConflictos: conflictos.length,
      conflictosAgrupados: Object.values(conflictosAgrupados),
      conflictos,
    });
  } catch (error: any) {
    console.error('Error obteniendo conflictos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener conflictos', 500);
  }
}