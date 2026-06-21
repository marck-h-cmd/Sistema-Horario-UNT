import { prisma } from '@/lib/prisma';
import { GeneradorPDF } from './GeneradorPDF';
import { UtilidadesFecha } from '@/lib/utilidadesFecha';
import { Formateadores } from '@/lib/formateadores';
import { calcularHorasEntre } from '@/lib/horario-horas';
import { generarKpiGrid, generarTablaHTML } from './reporte-estilos';

export class ReporteHorariosConfirmadosService {
  private generadorPDF = new GeneradorPDF();

  async generar(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo) {
      throw new Error('Período no encontrado');
    }

    const horariosDb = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { in: ['CONFIRMADO', 'PUBLICADO'] },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: { include: { usuario: { select: { nombre: true, apellidos: true } } } },
                planEstudioCurso: { include: { curso: { select: { codigo: true, nombre: true } } } }
              }
            }
          }
        },
        ambiente: { select: { codigo: true, nombre: true, tipo: true } },
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const horarios = horariosDb.map(h => ({
      ...h,
      curso: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso || { codigo: '-', nombre: '-' },
      docente: h.cursoDocenteGrupo?.cursoDocente?.docente || { usuario: { nombre: '-', apellidos: '-' } },
      grupo: h.cursoDocenteGrupo?.grupo || null
    })) as any[];

    let totalHoras = 0;
    const filas = horarios.map((h) => {
      const horas = calcularHorasEntre(h.horaInicio || '', h.horaFin || '');
      totalHoras += horas;
      return [
        h.diaSemana ? UtilidadesFecha.nombreDia(h.diaSemana) : '',
        h.horaInicio && h.horaFin ? `${h.horaInicio.slice(0, 5)} – ${h.horaFin.slice(0, 5)}` : '',
        h.curso?.codigo,
        h.curso?.nombre,
        Formateadores.nombreUsuario(h.docente?.usuario),
        h.ambiente?.codigo || '',
        h.ambiente ? Formateadores.tipoAmbiente(h.ambiente.tipo) : '',
        h.grupo?.nombre ?? '—',
        h.estado,
        `${horas.toFixed(1)} h`,
      ];
    });

    const contenido =
      generarKpiGrid([
        { label: 'Sesiones', value: horarios.length },
        { label: 'Horas programadas', value: totalHoras.toFixed(1) },
        { label: 'Período', value: periodo.nombre },
      ]) +
      (filas.length === 0
        ? '<p class="texto-vacio">No hay horarios confirmados o publicados en este período.</p>'
        : generarTablaHTML(
            [
              'Día',
              'Horario',
              'Código',
              'Curso',
              'Docente',
              'Ambiente',
              'Tipo',
              'Grupo',
              'Estado',
              'Horas',
            ],
            filas
          ));

    const html = this.generadorPDF.generarDocumento(
      'Horarios confirmados y publicados',
      contenido,
      { periodo: periodo.nombre }
    );

    return this.generadorPDF.generarPDF(html, {
      titulo: 'Horarios confirmados',
      orientacion: 'landscape',
    });
  }
}
