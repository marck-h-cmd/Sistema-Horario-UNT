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
    cursoDocenteGrupo: {
      include: {
        grupo: { select: { nombre: true } },
        cursoDocente: {
          include: {
            docente: {
              include: { usuario: { select: { nombre: true, apellidos: true } } },
            }
          }
        }
      }
    }
  },
  orderBy: [{ diaSemana: 'asc' as const }, { horaInicio: 'asc' as const }],
};

export class ReporteCursoService {
  private generadorPDF = new GeneradorPDF();

  async generar(cursoId: string, periodoId: string): Promise<Buffer> {
    const planCurso = await prisma.planEstudioCurso.findFirst({
      where: { cursoId },
      include: {
        curso: true,
        cursosDocentes: {
          where: { periodoId },
          include: {
            cursoDocenteGrupos: {
              include: {
                horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } }
              }
            }
          }
        }
      },
    });

    if (!planCurso) {
      throw new Error('Curso no encontrado en el plan de estudios');
    }

    const horariosDelCurso = (planCurso.cursosDocentes ?? []).flatMap((cd) =>
      (cd.cursoDocenteGrupos ?? []).flatMap((cdg) =>
        (cdg.horarios ?? []).map((h) => ({
          ...h,
          grupo: h.cursoDocenteGrupo?.grupo ?? null,
          docente: h.cursoDocenteGrupo?.cursoDocente?.docente ?? null,
        }))
      )
    );

    const curso = {
      ...planCurso.curso,
      ciclo: planCurso.ciclo,
      horarios: horariosDelCurso
    } as any;

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

    const planesCursos = await prisma.planEstudioCurso.findMany({
      include: {
        curso: true,
        cursosDocentes: {
          where: { periodoId },
          include: {
            cursoDocenteGrupos: {
              include: {
                horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } }
              }
            }
          }
        }
      },
      orderBy: [{ ciclo: 'asc' }, { curso: { codigo: 'asc' } }],
    });

    const cursos = (planesCursos ?? []).map((planCurso) => ({
      ...planCurso.curso,
      ciclo: planCurso.ciclo,
      horarios: (planCurso.cursosDocentes ?? []).flatMap((cd) =>
        (cd.cursoDocenteGrupos ?? []).flatMap((cdg) =>
          (cdg.horarios ?? []).map((h) => ({
            ...h,
            grupo: h.cursoDocenteGrupo?.grupo ?? null,
            docente: h.cursoDocenteGrupo?.cursoDocente?.docente ?? null,
          }))
        )
      ),
    })) as any[];

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
