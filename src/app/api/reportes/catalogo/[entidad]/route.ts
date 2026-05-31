import { NextRequest, NextResponse } from 'next/server';
import {
  EntidadCatalogo,
  ReporteCatalogoService,
} from '@/services/reportes/ReporteCatalogoService';
import { createErrorResponse } from '@/lib/respuestas';

const ENTIDADES_VALIDAS: EntidadCatalogo[] = [
  'docentes',
  'cursos',
  'ambientes',
  'periodos',
  'grupos',
  'carga-academica',
];

const servicio = new ReporteCatalogoService();

export async function GET(
  request: NextRequest,
  { params }: { params: { entidad: string } }
) {
  try {
    const entidad = params.entidad as EntidadCatalogo;
    if (!ENTIDADES_VALIDAS.includes(entidad)) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        `Entidad no válida. Use: ${ENTIDADES_VALIDAS.join(', ')}`,
        400
      );
    }

    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId') ?? undefined;
    const registroId = searchParams.get('id') ?? undefined;
    const fechaDesdeStr = searchParams.get('fechaDesde');
    const fechaHastaStr = searchParams.get('fechaHasta');
    // filtros adicionales por entidad
    const categoria = searchParams.get('categoria') ?? undefined;
    const departamento = searchParams.get('departamento') ?? undefined;
    const cicloStr = searchParams.get('ciclo');
    const ciclo = cicloStr ? parseInt(cicloStr, 10) : undefined;
    const cursoId = searchParams.get('cursoId') ?? undefined;
    const docenteId = searchParams.get('docenteId') ?? undefined;

    const parseFecha = (v: string | null): Date | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const fechaDesde = parseFecha(fechaDesdeStr);
    const fechaHasta = parseFecha(fechaHastaStr);

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'La fecha "desde" debe ser anterior o igual a la fecha "hasta"',
        400
      );
    }

    const pdfBuffer = await servicio.generar(entidad, {
      periodoId,
      registroId,
      fechaDesde,
      fechaHasta,
      categoria,
      departamento,
      ciclo: ciclo && !isNaN(ciclo) && ciclo > 0 ? ciclo : undefined,
      cursoId,
      docenteId,
    });

    const sufijo = registroId ? `-${registroId}` : '-todos';
    const filename = `catalogo-${entidad}${sufijo}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error && error.message.includes('no encontrado')
        ? error.message
        : 'Error al generar catálogo PDF';
    const codigo =
      error instanceof Error && error.message.includes('no encontrado')
        ? 'NOT_FOUND'
        : 'INTERNAL_ERROR';
    const status = codigo === 'NOT_FOUND' ? 404 : 500;
    console.error('Error generando catálogo PDF:', error);
    return createErrorResponse(codigo, mensaje, status);
  }
}
