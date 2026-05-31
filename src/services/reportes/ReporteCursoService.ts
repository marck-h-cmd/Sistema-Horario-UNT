import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import {
  htmlDocumentoHorario,
  htmlResumenConsolidado,
  htmlSeccionCurso,
  unirSeccionesPaginadas,
} from './reporte-horario-html';

const horariosInclude = {
  where: { estado: { not: 'CANCELADO' as const } },
  include: {
    ambiente: { select: { codigo: true, tipo: true } },
    docente: {
      include: { usuario: { select: { nombre: true, apellidos: true } } },
    },
    grupo: { select: { nombre: true } },
  },
  orderBy: [{ diaSemana: 'asc' as const }, { horaInicio: 'asc' as const }],
};

export class ReporteCursoService {
  private generadorPDF = new GeneradorPDF();

  async generar(cursoId: string, periodoId: string): Promise<Buffer> {
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: {
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
    }) as any;

    if (!curso) {
      throw new Error('Curso no encontrado');
    }

    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const html = htmlDocumentoHorario(
      'Reporte de horario por curso',
      htmlSeccionCurso(curso),
      { periodo: periodo?.nombre, subtitulo: curso.codigo }
    );

    return this.generadorPDF.generarPDF(html, this.configPdf('Horario por curso'));
  }

  async generarTodos(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const cursos = await prisma.curso.findMany({
      where: { activo: true },
      include: {
        horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } },
      },
      orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
    }) as any[];

    const conHorario = cursos.filter((c) => c.horarios.length > 0);
    const totalSesiones = cursos.reduce((s, c) => s + c.horarios.length, 0);

    const cuerpo =
      htmlResumenConsolidado([
        { label: 'Cursos activos', value: cursos.length },
        { label: 'Con horario asignado', value: conHorario.length },
        { label: 'Sesiones totales', value: totalSesiones },
      ]) +
      unirSeccionesPaginadas(cursos.map((c) => htmlSeccionCurso(c)));

    const html = htmlDocumentoHorario('Horarios de todos los cursos', cuerpo, {
      periodo: periodo?.nombre,
      subtitulo: `${cursos.length} cursos registrados`,
    });

    return this.generadorPDF.generarPDF(html, this.configPdf('Horarios todos los cursos'));
  }

  private configPdf(titulo: string): ReporteConfig {
    return { titulo, orientacion: 'landscape', formato: 'A4' };
  }
}
