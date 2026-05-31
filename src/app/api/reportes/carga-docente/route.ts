import { NextRequest, NextResponse } from 'next/server';
import { ReporteCargaDocenteService } from '@/services/reportes/ReporteCargaDocenteService';
import { createErrorResponse } from '@/lib/respuestas';

const servicio = new ReporteCargaDocenteService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId') ?? undefined;
    const categoriaFiltro = searchParams.get('categoria') ?? undefined;

    const pdfBuffer = await servicio.generar({ periodoId, categoriaFiltro });

    const sufijo = categoriaFiltro ? `-${categoriaFiltro.toLowerCase()}` : '-todos';
    const filename = `reporte-carga-docente${sufijo}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error generando reporte carga docente:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al generar el reporte', 500);
  }
}
