import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { ReporteService } from '@/services/reporteService';

const reporteService = new ReporteService();

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE', 'SECRETARIA', 'ADMINISTRADOR']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const docenteIdParam = searchParams.get('docenteId');

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere periodoId', 400);
    }

    let docenteId: string;
    if (user.rol === 'DOCENTE') {
      const docente = await prisma.docente.findUnique({
        where: { usuarioId: user.userId },
        select: { id: true },
      });
      if (!docente) {
        return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
      }
      docenteId = docente.id;
    } else {
      if (!docenteIdParam) {
        return createErrorResponse('VALIDATION_ERROR', 'Se requiere docenteId', 400);
      }
      docenteId = docenteIdParam;
    }

    const pdfBuffer = await reporteService.generarFormato3Horario(periodoId, docenteId);
    const filename = `horario-personal-${docenteId}-${periodoId}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generando reporte de horario personal:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al generar el reporte', 500);
  }
}
