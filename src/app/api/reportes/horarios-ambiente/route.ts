import { NextRequest, NextResponse } from 'next/server';
import { ReporteHorariosAmbienteService } from '@/services/reportes/ReporteHorariosAmbienteService';
import { createErrorResponse } from '@/lib/respuestas';

const servicio = new ReporteHorariosAmbienteService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const ambienteId = searchParams.get('ambienteId') ?? undefined;
    const tipo = searchParams.get('tipo') ?? undefined;

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'El parámetro periodoId es requerido', 400);
    }

    const TIPOS_VALIDOS = ['AULA', 'LABORATORIO', 'AUDITORIO', 'SALA_CONFERENCIAS'];
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return createErrorResponse('VALIDATION_ERROR', `Tipo no válido. Use: ${TIPOS_VALIDOS.join(', ')}`, 400);
    }

    const pdfBuffer = await servicio.generar({ periodoId, ambienteId, tipo });

    const partes = ['reporte-horarios-ambiente'];
    if (tipo) partes.push(tipo.toLowerCase());
    if (ambienteId) partes.push(ambienteId);
    const filename = `${partes.join('-')}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error al generar el reporte';
    const esNotFound = error instanceof Error && error.message.includes('no encontrado');
    console.error('Error generando reporte horarios ambiente:', error);
    return createErrorResponse(
      esNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      mensaje,
      esNotFound ? 404 : 500
    );
  }
}
