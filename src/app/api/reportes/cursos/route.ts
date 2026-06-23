import { NextRequest, NextResponse } from 'next/server';
import { ReporteCursoService } from '@/services/reportes/ReporteCursoService';
import { createErrorResponse } from '@/lib/respuestas';

const reporteCursoService = new ReporteCursoService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const cursoId = searchParams.get('cursoId') ?? searchParams.get('id');
    const todos =
      searchParams.get('todos') === 'true' ||
      cursoId === 'todos' ||
      cursoId === '__todos__';

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere periodoId', 400);
    }

    if (!todos && !cursoId) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Indique cursoId o todos=true',
        400
      );
    }

    const pdfBuffer = todos
      ? await reporteCursoService.generarTodos(periodoId)
      : await reporteCursoService.generar(cursoId!, periodoId);

    const filename = todos
      ? `reporte-cursos-todos-${periodoId}.pdf`
      : `reporte-curso-${cursoId}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error generando reporte de cursos:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al generar reporte de cursos', 500);
  }
}
