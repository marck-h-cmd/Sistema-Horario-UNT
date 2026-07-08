import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CargaLectivaService } from '@/services/cargaLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const service = new CargaLectivaService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE', 'SECRETARIA', 'OPERADOR', 'ADMINISTRADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    let periodoId = searchParams.get('periodoId');
    const qDocenteId = searchParams.get('docenteId');

    // 1. Encontrar docente
    const docente = await prisma.docente.findUnique({
      where: qDocenteId && user.rol !== 'DOCENTE' ? { id: qDocenteId } : { usuarioId: user.userId },
      include: {
        usuario: { select: { nombre: true, apellidos: true } },
        cargos: {
          where: { activo: true },
          select: { tipoCargo: true, activo: true, fechaInicio: true, fechaFin: true, resolucion: true },
        },
        departamento: {
          include: {
            facultad: true,
          },
        },
      },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    // 2. Encontrar período
    let periodo = null;
    if (periodoId) {
      periodo = await prisma.periodoAcademico.findUnique({
        where: { id: periodoId },
      });
    } else {
      periodo = await prisma.periodoAcademico.findFirst({
        where: { activo: true },
      });
    }

    if (!periodo) {
      return createErrorResponse('PERIOD_NOT_FOUND', 'No se encontró un período académico activo', 404);
    }

    periodoId = periodo.id;

    // 3. Obtener asignaciones lectivas desde horarios no cancelados
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
        cursoDocenteGrupo: {
          cursoDocente: {
            docenteId: docente.id
          }
        }
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                planEstudioCurso: {
                  include: {
                    curso: true
                  }
                }
              }
            }
          }
        },
        ambiente: true,
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    const parseTime = (t: string) => {
      const parts = t.split(':');
      return parseInt(parts[0]) + (parseInt(parts[1] || '0') / 60);
    };

    // 4. Mapear horarios y calcular horas por componente
    const asignaciones = horarios.map((h) => {
      const planCurso = h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso;
      if (!planCurso) return null;
      
      const horas = h.horaInicio && h.horaFin 
        ? parseTime(h.horaFin) - parseTime(h.horaInicio)
        : service.obtenerHorasComponente(planCurso as any, h.tipoComponente);

      return {
        id: h.id,
        cursoId: planCurso.cursoId,
        planEstudioId: planCurso.planEstudioId,
        cursoCodigo: planCurso.curso.codigo,
        cursoNombre: planCurso.curso.nombre,
        ciclo: planCurso.ciclo,
        grupoId: h.cursoDocenteGrupo?.grupoId,
        grupoNombre: h.cursoDocenteGrupo?.grupo?.nombre,
        ambienteId: h.ambienteId,
        ambienteNombre: h.ambiente?.nombre || null,
        tipoComponente: h.tipoComponente,
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        horas,
        estado: h.estado,
        confirmadoPor: h.confirmadoPor,
        fechaConfirmacion: h.fechaConfirmacion,
      };
    }).filter(Boolean);

    const horasDedicacion = service.obtenerHorasDedicacion(docente.dedicacion);
    const totalHorasLectivas = asignaciones.reduce((sum, a) => sum + (a ? a.horas : 0), 0);

    return createSuccessResponse({
      docente: {
        id: docente.id,
        codigo: docente.codigo,
        nombreCompleto: `${docente.usuario.nombre} ${docente.usuario.apellidos}`,
        categoria: docente.categoria,
        dedicacion: docente.dedicacion,
        horasDedicacion,
        cargosActivos: docente.cargos ?? [],
        departamento: docente.departamento ? {
          nombre: docente.departamento.nombre,
          facultad: docente.departamento.facultad ? {
            nombre: docente.departamento.facultad.nombre
          } : undefined
        } : undefined,
      },
      periodo: {
        id: periodo.id,
        nombre: periodo.nombre,
        estado: periodo.estado,
      },
      asignaciones,
      totalHorasLectivas,
      horasNoLectivasDisponibles: Math.max(0, horasDedicacion - totalHorasLectivas),
    });
  } catch (error: any) {
    console.error('Error en GET /api/declaracion/lectiva:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
