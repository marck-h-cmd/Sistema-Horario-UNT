import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import { Formateadores } from '@/lib/formateadores';
import {
  htmlDocumentoHorario,
  htmlResumenConsolidado,
  htmlSeccionDocente,
  unirSeccionesPaginadas,
} from './reporte-horario-html';

const horariosInclude = {
  where: { estado: { not: 'CANCELADO' as const } },
  include: {
    curso: { select: { codigo: true, nombre: true, creditos: true } },
    ambiente: { select: { codigo: true, nombre: true, tipo: true } },
    grupo: { select: { nombre: true } },
  },
  orderBy: [{ diaSemana: 'asc' as const }, { horaInicio: 'asc' as const }],
};

export class ReporteDocenteService {
  private generadorPDF = new GeneradorPDF();

  async generar(docenteId: string, periodoId: string): Promise<Buffer> {
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true } },
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
    }) as any;

    if (!docente) {
      throw new Error('Docente no encontrado');
    }

    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const html = htmlDocumentoHorario(
      'Horario académico del docente',
      htmlSeccionDocente(docente),
      {
        periodo: periodo?.nombre,
        subtitulo: `${docente.codigo} — ${Formateadores.nombreUsuario(docente.usuario)}`,
      }
    );

    return this.generadorPDF.generarPDF(html, this.configPdf('Horario docente'));
  }

  async generarTodos(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const docentes = await prisma.docente.findMany({
      where: { usuario: { activo: true } },
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true } },
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
      orderBy: { codigo: 'asc' },
    }) as any[];

    const conHorario = docentes.filter((d) => d.horarios.length > 0);
    const totalSesiones = docentes.reduce((s, d) => s + d.horarios.length, 0);

    const cuerpo =
      htmlResumenConsolidado([
        { label: 'Docentes activos', value: docentes.length },
        { label: 'Con horario asignado', value: conHorario.length },
        { label: 'Sesiones totales', value: totalSesiones },
      ]) +
      unirSeccionesPaginadas(docentes.map((d) => htmlSeccionDocente(d)));

    const html = htmlDocumentoHorario('Horarios de todos los docentes', cuerpo, {
      periodo: periodo?.nombre,
      subtitulo: `${docentes.length} docentes registrados`,
    });

    return this.generadorPDF.generarPDF(html, this.configPdf('Horarios todos los docentes'));
  }

  private configPdf(titulo: string): ReporteConfig {
    return { titulo, orientacion: 'landscape', formato: 'A4' };
  }
}
