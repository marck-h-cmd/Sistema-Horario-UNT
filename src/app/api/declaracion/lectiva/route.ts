import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CargaLectivaService } from '@/services/cargaLectivaService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const service = new CargaLectivaService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    let periodoId = searchParams.get('periodoId');

    // 1. Encontrar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
      include: {
        usuario: { select: { nombre: true, apellidos: true } },
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
        docenteId: docente.id,
        estado: { not: 'CANCELADO' },
      },
      include: {
        curso: true,
        grupo: true,
        ambiente: true,
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    // 4. Mapear horarios y calcular horas por componente
    const asignaciones = horarios.map((h) => {
      const horas = service.obtenerHorasComponente(h.curso, h.tipoComponente);
      return {
        id: h.id,
        cursoId: h.cursoId,
        cursoCodigo: h.curso.codigo,
        cursoNombre: h.curso.nombre,
        ciclo: h.curso.ciclo,
        grupoId: h.grupoId,
        grupoNombre: h.grupo?.nombre || null,
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
    });

    const horasDedicacion = service.obtenerHorasDedicacion(docente.dedicacion);
    const totalHorasLectivas = asignaciones.reduce((sum, a) => sum + a.horas, 0);

    return createSuccessResponse({
      docente: {
        id: docente.id,
        codigo: docente.codigo,
        nombreCompleto: `${docente.usuario.nombre} ${docente.usuario.apellidos}`,
        categoria: docente.categoria,
        dedicacion: docente.dedicacion,
        horasDedicacion,
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
