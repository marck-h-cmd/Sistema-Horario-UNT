import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import { UtilidadesFecha } from '@/lib/utilidadesFecha';
import { Formateadores } from '@/lib/formateadores';
import {
  generarCajaInfo,
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
} from './reporte-estilos';

export class ReporteLaboratorioService {
  private generadorPDF = new GeneradorPDF();

  async generar(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    const laboratorios = await prisma.ambiente.findMany({
      where: { tipo: 'LABORATORIO', activo: true },
      include: {
        horarios: {
          where: { periodoId, estado: { not: 'CANCELADO' } },
          include: {
            curso: { select: { codigo: true, nombre: true } },
            docente: {
              include: { usuario: { select: { nombre: true, apellidos: true } } },
            },
            grupo: { select: { nombre: true } },
          },
          orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        },
      },
      orderBy: { codigo: 'asc' },
    }) as any[];

    const totalHorarios = laboratorios.reduce((sum, l) => sum + l.horarios.length, 0);

    let contenido = generarKpiGrid([
      { label: 'Laboratorios', value: laboratorios.length },
      { label: 'Sesiones asignadas', value: totalHorarios },
      {
        label: 'Promedio / lab.',
        value:
          laboratorios.length > 0
            ? (totalHorarios / laboratorios.length).toFixed(1)
            : '0',
      },
    ]);

    for (const laboratorio of laboratorios) {
      contenido += `<div class="page-break"></div>`;
      contenido += generarSeccionTitulo(`${laboratorio.codigo} — ${laboratorio.nombre}`);
      contenido += generarCajaInfo('Datos del ambiente', [
        `<strong>Capacidad:</strong> ${Formateadores.capacidad(laboratorio.capacidad)}`,
        `<strong>Ubicación:</strong> ${laboratorio.ubicacion || 'No especificada'}`,
        `<strong>Sesiones:</strong> ${laboratorio.horarios.length}`,
      ]);

      if (laboratorio.horarios.length === 0) {
        contenido += '<p class="texto-vacio">Sin horarios asignados.</p>';
        continue;
      }

      const horariosPorDia: Record<string, typeof laboratorio.horarios> = {};
      for (const h of laboratorio.horarios) {
        const dia = h.diaSemana ? UtilidadesFecha.nombreDia(h.diaSemana) : '';
        if (dia) {
          if (!horariosPorDia[dia]) horariosPorDia[dia] = [];
          horariosPorDia[dia].push(h);
        }
      }

      const diasOrdenados = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      for (const dia of diasOrdenados) {
        const horariosDia = horariosPorDia[dia] || [];
        if (horariosDia.length === 0) continue;

        const filas = horariosDia.map((h: any) => [
          h.horaInicio && h.horaFin ? `${h.horaInicio.slice(0, 5)} – ${h.horaFin.slice(0, 5)}` : '',
          h.curso.codigo,
          h.curso.nombre,
          Formateadores.nombreUsuario(h.docente.usuario),
          h.grupo?.nombre ?? '—',
        ]);

        contenido += `<h3 style="color:#64748b;font-size:10pt;margin:12px 0 6px;">${dia}</h3>`;
        contenido += generarTablaHTML(
          ['Horario', 'Código', 'Curso', 'Docente', 'Grupo'],
          filas
        );
      }

      const maxFranjas = 12 * 5;
      const porcentajeOcupacion =
        maxFranjas > 0
          ? Math.round((laboratorio.horarios.length / maxFranjas) * 100)
          : 0;
      const colorBarra =
        porcentajeOcupacion > 80 ? '#dc2626' : porcentajeOcupacion > 50 ? '#d97706' : '#059669';

      contenido += `
        <div class="caja-info" style="margin-top:8px;">
          <p><strong>Ocupación:</strong> ${laboratorio.horarios.length}/${maxFranjas} franjas (${porcentajeOcupacion}%)</p>
          <div style="background:#e2e8f0;height:8px;border-radius:4px;margin-top:6px;">
            <div style="background:${colorBarra};width:${porcentajeOcupacion}%;height:100%;border-radius:4px;"></div>
          </div>
        </div>
      `;
    }

    const html = this.generadorPDF.generarDocumento(
      'Reporte de Horarios por Laboratorio',
      contenido,
      { periodo: periodo?.nombre }
    );

    return this.generadorPDF.generarPDF(html, {
      titulo: 'Reporte de Horarios por Laboratorio',
      orientacion: 'landscape',
      formato: 'A4',
    });
  }
}
