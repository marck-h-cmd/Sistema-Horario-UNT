import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import { Formateadores } from '@/lib/formateadores';
import { UtilidadesFecha } from '@/lib/utilidadesFecha';
import {
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
} from './reporte-estilos';

export class ReporteConflictosService {
  private generadorPDF = new GeneradorPDF();

  async generar(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const conflictos = await prisma.validacionHorario.findMany({
      where: {
        cumple: false,
        horario: { periodoId },
      },
      include: {
        horario: {
          include: {
            cursoDocenteGrupo: {
              include: {
                grupo: true,
                cursoDocente: {
                  include: {
                    docente: {
                      include: { usuario: { select: { nombre: true, apellidos: true } } }
                    },
                    planEstudioCurso: {
                      include: { curso: { select: { codigo: true, nombre: true } } }
                    }
                  }
                }
              }
            },
            ambiente: { select: { codigo: true, nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conflictosPorTipo: Record<string, typeof conflictos> = {};
    for (const conflicto of conflictos) {
      if (!conflictosPorTipo[conflicto.tipoRegla]) {
        conflictosPorTipo[conflicto.tipoRegla] = [];
      }
      conflictosPorTipo[conflicto.tipoRegla].push(conflicto);
    }

    let contenido = `
      <div class="caja-error">
        <p><strong>Total de conflictos:</strong> ${conflictos.length}</p>
        <p><strong>Tipos distintos:</strong> ${Object.keys(conflictosPorTipo).length}</p>
      </div>
    `;

    contenido += generarKpiGrid([
      { label: 'Conflictos', value: conflictos.length },
      { label: 'Tipos', value: Object.keys(conflictosPorTipo).length },
      {
        label: 'Período',
        value: periodo?.nombre ?? '—',
      },
    ]);

    if (conflictos.length === 0) {
      contenido += '<p class="texto-vacio">No se registran conflictos de validación en este período.</p>';
    }

    for (const [tipo, lista] of Object.entries(conflictosPorTipo)) {
      contenido += generarSeccionTitulo(
        `${this.formatearTipoConflicto(tipo)} (${lista.length})`
      );

      const filas = lista.slice(0, 30).map((c) => {
        const h = c.horario;
        if (!h) return ['-', '-', '-', '-', '-', c.mensaje || ''];
        const dia = h.diaSemana ? UtilidadesFecha.nombreDia(h.diaSemana) : 'Sin día';
        const inicio = h.horaInicio ? h.horaInicio.slice(0, 5) : '--:--';
        const fin = h.horaFin ? h.horaFin.slice(0, 5) : '--:--';
        const ambiente = h.ambiente ? h.ambiente.codigo : 'Sin ambiente';
        const cursoObj = (h as any).cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso || { codigo: '-', nombre: '-' };
        const docenteObj = (h as any).cursoDocenteGrupo?.cursoDocente?.docente || { usuario: { nombre: '-', apellidos: '-' } };
        return [
          cursoObj.codigo,
          cursoObj.nombre,
          Formateadores.nombreUsuario(docenteObj.usuario),
          ambiente,
          `${dia} ${inicio}–${fin}`,
          c.mensaje || 'Sin detalle',
        ];
      });

      contenido += generarTablaHTML(
        ['Código', 'Curso', 'Docente', 'Ambiente', 'Horario', 'Descripción'],
        filas
      );

      if (lista.length > 30) {
        contenido += `<p class="texto-vacio">… y ${lista.length - 30} conflictos adicionales de este tipo.</p>`;
      }
    }

    const html = this.generadorPDF.generarDocumento(
      'Reporte de Conflictos de Horarios',
      contenido,
      { periodo: periodo?.nombre }
    );

    return this.generadorPDF.generarPDF(html, {
      titulo: 'Reporte de Conflictos',
      orientacion: 'landscape',
      formato: 'A4',
    });
  }

  private formatearTipoConflicto(tipo: string): string {
    const mapa: Record<string, string> = {
      CRUCE_DOCENTE: 'Cruce de docente',
      CRUCE_AMBIENTE: 'Cruce de ambiente',
      CRUCE_GRUPO: 'Cruce de grupo',
      DISPONIBILIDAD_DOCENTE: 'Disponibilidad de docente',
      HORAS_EXCEDIDAS: 'Horas excedidas',
      MANTENIMIENTO_AMBIENTE: 'Mantenimiento de ambiente',
      DIA_NO_LABORABLE: 'Día no laborable',
      ORDEN_ATENCION: 'Orden de atención',
      HORAS_REQUERIDAS: 'Horas requeridas',
      FRANJA_HORARIA: 'Franja horaria',
      CARGA_HORARIA: 'Carga horaria docente-curso',
      VALIDACION_COMPLETA: 'Validación completa',
    };
    return mapa[tipo] || tipo;
  }
}
