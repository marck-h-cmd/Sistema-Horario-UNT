import { prisma } from '@/lib/prisma';
import { Formateadores } from '@/lib/formateadores';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import {
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
  escapeHtml,
  REPORTE_COLORES,
} from './reporte-estilos';

export interface OpcionesCargaDocente {
  periodoId?: string;
  categoriaFiltro?: string;
}

export class ReporteCargaDocenteService {
  private generadorPDF = new GeneradorPDF();

  async generar(opciones?: OpcionesCargaDocente): Promise<Buffer> {
    const { periodoId, categoriaFiltro } = opciones ?? {};

    const periodo = periodoId
      ? await prisma.periodoAcademico.findUnique({ where: { id: periodoId } })
      : null;

    const whereDocente: Record<string, unknown> = {};
    if (categoriaFiltro) whereDocente.categoria = categoriaFiltro;

    const docentes = await prisma.docente.findMany({
      where: Object.keys(whereDocente).length > 0 ? whereDocente : undefined,
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true, activo: true } },
        cursos: {
          where: { activo: true },
          include: {
            curso: {
              select: {
                codigo: true,
                nombre: true,
                ciclo: true,
                creditos: true,
                horasTeoria: true,
                horasPractica: true,
                horasLaboratorio: true,
              },
            },
          },
        },
        // Si no hay período, devuelve [] (where con id inexistente).
        // Si lo hay, sólo trae los horarios de ese período no cancelados.
        horarios: {
          where: periodoId
            ? { periodoId, estado: { not: 'CANCELADO' } }
            : { id: '__never__' },
          include: {
            grupo: { select: { nombre: true } },
            curso: { select: { codigo: true } },
            ambiente: { select: { codigo: true } },
          },
          orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        },
      },
      orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }],
    });

    const docentesFormateados = docentes.map(d => ({
      ...d,
      horarios: (d.horarios || [])
        .filter(h => h.diaSemana !== null && h.horaInicio !== null && h.horaFin !== null)
        .map(h => ({
          ...h,
          diaSemana: h.diaSemana!,
          horaInicio: h.horaInicio!,
          horaFin: h.horaFin!,
          ambiente: h.ambiente || { codigo: 'Sin ambiente' },
        })),
    }));

    const totalDocentes = docentesFormateados.length;
    const totalAsignaciones = docentesFormateados.reduce((s, d) => s + d.cursos.length, 0);
    const totalHoras = docentesFormateados.reduce(
      (s, d) => s + d.cursos.reduce((h, c) => h + c.horasAsignadas, 0),
      0
    );

    const kpis = generarKpiGrid([
      { label: 'Docentes', value: totalDocentes },
      { label: 'Asignaciones activas', value: totalAsignaciones },
      { label: 'Horas asignadas (total)', value: totalHoras },
    ]);

    const bloques = docentesFormateados.map((d) => this.bloqueDocente(d as any, periodoId)).join('');

    const subtitulo = [
      categoriaFiltro
        ? `Categoría: ${Formateadores.categoriaDocente(categoriaFiltro)}`
        : 'Todos los docentes',
      periodo ? `Período: ${periodo.nombre}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const contenido = kpis + generarSeccionTitulo('Detalle por docente') + bloques;

    const html = this.generadorPDF.generarDocumento(
      'Reporte de Carga Académica por Docente',
      contenido,
      { periodo: periodo?.nombre, subtitulo }
    );

    const config: ReporteConfig = {
      titulo: 'Reporte de Carga Académica por Docente',
      orientacion: 'landscape',
      formato: 'A4',
    };

    return this.generadorPDF.generarPDF(html, config);
  }

  private bloqueDocente(
    d: {
      codigo: string;
      categoria: string;
      departamento: string | null;
      usuario: { nombre: string; apellidos: string; email: string; activo: boolean };
      cursos: {
        horasAsignadas: number;
        curso: {
          codigo: string;
          nombre: string;
          ciclo: number;
          creditos: number;
          horasTeoria: number;
          horasPractica: number;
          horasLaboratorio: number;
        };
      }[];
      horarios: {
        diaSemana: string;
        horaInicio: string;
        horaFin: string;
        grupo: { nombre: string } | null;
        curso: { codigo: string };
        ambiente: { codigo: string };
      }[];
    },
    periodoId?: string
  ): string {
    const nombre = Formateadores.nombreUsuario(d.usuario);
    const horasTotales = d.cursos.reduce((s, c) => s + c.horasAsignadas, 0);

    const filasCursos = d.cursos.map((c) => [
      c.curso.codigo,
      c.curso.nombre,
      `${c.curso.ciclo}°`,
      `${c.curso.creditos}`,
      `${c.curso.horasTeoria}T / ${c.curso.horasPractica}P / ${c.curso.horasLaboratorio}L`,
      `${c.horasAsignadas}h`,
    ]);

    const tablaCursos = generarTablaHTML(
      ['Código', 'Asignatura', 'Ciclo', 'Créd.', 'Horas (T/P/L)', 'H. asig.'],
      filasCursos
    );

    let tablaHorarios = '';
    if (periodoId && d.horarios.length > 0) {
      const DIAS: Record<string, string> = {
        LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
        JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
      };
      const filasHorario = d.horarios.map((h) => [
        DIAS[h.diaSemana] ?? h.diaSemana,
        `${h.horaInicio} – ${h.horaFin}`,
        h.curso.codigo,
        h.grupo?.nombre ? `Grupo ${h.grupo.nombre}` : '—',
        h.ambiente.codigo,
      ]);
      tablaHorarios =
        `<p style="font-size:8pt;font-weight:600;color:${REPORTE_COLORES.textoSuave};margin:8px 0 4px;">Horarios en el período</p>` +
        generarTablaHTML(['Día', 'Horario', 'Curso', 'Grupo', 'Ambiente'], filasHorario);
    }

    const estadoBadge = d.usuario.activo
      ? `<span style="color:${REPORTE_COLORES.exito};font-weight:700;">● Activo</span>`
      : `<span style="color:${REPORTE_COLORES.error};font-weight:700;">● Inactivo</span>`;

    return `
      <div style="margin-bottom:20px;padding:14px 16px;border:1px solid ${REPORTE_COLORES.borde};border-left:4px solid ${REPORTE_COLORES.azul};border-radius:8px;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <strong style="font-size:10.5pt;color:${REPORTE_COLORES.azul};">${escapeHtml(d.codigo)} — ${escapeHtml(nombre)}</strong>
            <span style="margin-left:12px;font-size:8.5pt;color:${REPORTE_COLORES.textoSuave};">
              ${escapeHtml(Formateadores.categoriaDocente(d.categoria))}
              ${d.departamento ? ` · ${escapeHtml(d.departamento)}` : ''}
            </span>
          </div>
          <div style="font-size:8pt;text-align:right;">
            ${estadoBadge}
            <span style="margin-left:10px;background:${REPORTE_COLORES.dorado};color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;">${escapeHtml(horasTotales.toString())}h asig.</span>
          </div>
        </div>
        ${tablaCursos}
        ${tablaHorarios}
      </div>`;
  }
}
