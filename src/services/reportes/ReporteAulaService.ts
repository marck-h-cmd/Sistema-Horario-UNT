import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import {
  htmlDocumentoHorario,
  htmlResumenConsolidado,
  htmlSeccionAmbiente,
  unirSeccionesPaginadas,
} from './reporte-horario-html';

const horariosInclude = {
  where: { estado: { not: 'CANCELADO' as const } },
  include: {
    curso: { select: { codigo: true, nombre: true } },
    docente: {
      include: { usuario: { select: { nombre: true, apellidos: true } } },
    },
    grupo: { select: { nombre: true } },
  },
  orderBy: [{ diaSemana: 'asc' as const }, { horaInicio: 'asc' as const }],
};

export class ReporteAulaService {
  private generadorPDF = new GeneradorPDF();

  async generar(ambienteId: string, periodoId: string): Promise<Buffer> {
    const ambiente = await prisma.ambiente.findUnique({
      where: { id: ambienteId },
      include: {
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
    });

    if (!ambiente) {
      throw new Error('Ambiente no encontrado');
    }

    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const ambienteFormateado = {
      ...ambiente,
      horarios: (ambiente.horarios || [])
        .filter(h => h.diaSemana !== null && h.horaInicio !== null && h.horaFin !== null)
        .map(h => ({
          ...h,
          diaSemana: h.diaSemana!,
          horaInicio: h.horaInicio!,
          horaFin: h.horaFin!,
        })),
    };

    const html = htmlDocumentoHorario(
      'Reporte de horario por ambiente',
      htmlSeccionAmbiente(ambienteFormateado as any),
      { periodo: periodo?.nombre, subtitulo: ambiente.codigo }
    );

    return this.generadorPDF.generarPDF(html, this.configPdf('Horario por ambiente'));
  }

  async generarTodos(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const ambientes = await prisma.ambiente.findMany({
      where: { activo: true },
      include: {
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
      orderBy: { codigo: 'asc' },
    });

    const ambientesFormateados = ambientes.map(a => ({
      ...a,
      horarios: (a.horarios || [])
        .filter(h => h.diaSemana !== null && h.horaInicio !== null && h.horaFin !== null)
        .map(h => ({
          ...h,
          diaSemana: h.diaSemana!,
          horaInicio: h.horaInicio!,
          horaFin: h.horaFin!,
        })),
    }));

    const conHorario = ambientesFormateados.filter((a) => a.horarios.length > 0);
    const totalSesiones = ambientesFormateados.reduce((s, a) => s + a.horarios.length, 0);

    const cuerpo =
      htmlResumenConsolidado([
        { label: 'Ambientes activos', value: ambientes.length },
        { label: 'Con horario asignado', value: conHorario.length },
        { label: 'Sesiones totales', value: totalSesiones },
      ]) +
      unirSeccionesPaginadas(ambientesFormateados.map((a) => htmlSeccionAmbiente(a as any)));

    const html = htmlDocumentoHorario('Horarios de todos los ambientes', cuerpo, {
      periodo: periodo?.nombre,
      subtitulo: `${ambientes.length} ambientes registrados`,
    });

    return this.generadorPDF.generarPDF(html, this.configPdf('Horarios todos los ambientes'));
  }

  private configPdf(titulo: string): ReporteConfig {
    return { titulo, orientacion: 'landscape', formato: 'A4' };
  }
}
