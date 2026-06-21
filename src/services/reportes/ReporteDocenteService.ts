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
    ambiente: { select: { codigo: true, nombre: true, tipo: true } },
  },
  orderBy: [{ diaSemana: 'asc' as const }, { horaInicio: 'asc' as const }],
};

export class ReporteDocenteService {
  private generadorPDF = new GeneradorPDF();

  async generar(docenteId: string, periodoId: string): Promise<Buffer> {
    const docenteDb = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true } },
        cursos: {
          where: { periodoId },
          include: {
            planEstudioCurso: { include: { curso: true } },
            cursoDocenteGrupos: {
              include: {
                grupo: true,
                horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } }
              }
            }
          }
        }
      },
    });

    if (!docenteDb) {
      throw new Error('Docente no encontrado');
    }

    const horariosDelDocente = docenteDb.cursos.flatMap((cd: any) => 
      (cd.cursoDocenteGrupos ?? []).flatMap((cdg: any) => 
        (cdg.horarios ?? []).map((h: any) => ({
          ...h,
          curso: {
            ...cd.planEstudioCurso.curso,
            creditos: cd.planEstudioCurso.creditos
          },
          grupo: cdg.grupo,
          cursoDocenteGrupo: {
            cursoDocente: {
              planEstudioCurso: cd.planEstudioCurso
            }
          }
        }))
      )
    );

    const docente = {
      ...docenteDb,
      horarios: horariosDelDocente
    } as any;

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

    const docentesDb = await prisma.docente.findMany({
      where: { usuario: { activo: true } },
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true } },
        cursos: {
          where: { periodoId },
          include: {
            planEstudioCurso: { include: { curso: true } },
            cursoDocenteGrupos: {
              include: {
                grupo: true,
                horarios: { ...horariosInclude, where: { ...horariosInclude.where, periodoId } }
              }
            }
          }
        }
      },
      orderBy: { codigo: 'asc' },
    });

    const docentes = docentesDb.map(d => ({
      ...d,
      horarios: d.cursos.flatMap((cd: any) => 
        (cd.cursoDocenteGrupos ?? []).flatMap((cdg: any) => 
          (cdg.horarios ?? []).map((h: any) => ({
            ...h,
            curso: {
              ...cd.planEstudioCurso.curso,
              creditos: cd.planEstudioCurso.creditos
            },
            grupo: cdg.grupo,
            cursoDocenteGrupo: {
              cursoDocente: {
                planEstudioCurso: cd.planEstudioCurso
              }
            }
          }))
        )
      )
    })) as any[];

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
