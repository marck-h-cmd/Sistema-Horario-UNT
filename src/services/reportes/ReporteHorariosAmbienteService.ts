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

export interface OpcionesHorariosAmbiente {
  periodoId: string;
  ambienteId?: string;
  tipo?: string; // 'AULA' | 'LABORATORIO' | ...
}

const ORDEN_DIAS: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4,
  VIERNES: 5, SABADO: 6, DOMINGO: 7,
};

const NOMBRE_DIA: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
};

export class ReporteHorariosAmbienteService {
  private generadorPDF = new GeneradorPDF();

  async generar(opciones: OpcionesHorariosAmbiente): Promise<Buffer> {
    const { periodoId, ambienteId, tipo } = opciones;

    const periodo = await prisma.periodoAcademico.findUnique({ where: { id: periodoId } });
    if (!periodo) throw new Error('Período no encontrado');

    const whereAmbiente: Record<string, unknown> = { activo: true };
    if (ambienteId) whereAmbiente.id = ambienteId;
    if (tipo) whereAmbiente.tipo = tipo;

    const ambientes = await prisma.ambiente.findMany({
      where: whereAmbiente,
      include: {
        horarios: {
          where: { periodoId, estado: { not: 'CANCELADO' } },
          include: {
            curso: { select: { codigo: true, nombre: true } },
            docente: { select: { codigo: true, usuario: { select: { nombre: true, apellidos: true } } } },
            grupo: { select: { nombre: true } },
          },
          orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        },
      },
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    }) as any[];

    const ambientesConHorario = ambientes.filter((a) => a.horarios.length > 0);
    const totalSlots = ambientes.reduce((s, a) => s + a.horarios.length, 0);
    const horasOcupadas = ambientes.reduce((s, a) => {
      return s + a.horarios.reduce((h: number, hor: any) => {
        const [hi, hm] = (hor.horaInicio || '').split(':').map(Number);
        const [fi, fm] = (hor.horaFin || '').split(':').map(Number);
        return h + ((fi * 60 + fm) - (hi * 60 + hm)) / 60;
      }, 0);
    }, 0);

    const kpis = generarKpiGrid([
      { label: 'Ambientes con horario', value: `${ambientesConHorario.length} / ${ambientes.length}` },
      { label: 'Sesiones programadas', value: totalSlots },
      { label: 'Horas asignadas (suma)', value: `${horasOcupadas.toFixed(1)}h` },
    ]);

    const bloques = ambientes.map((a) => this.bloqueAmbiente(a as any)).join('');

    const subtituloPartes: string[] = [];
    if (tipo) subtituloPartes.push(`Tipo: ${Formateadores.tipoAmbiente(tipo)}`);
    if (!ambienteId) subtituloPartes.push(`${ambientes.length} ambientes`);

    const html = this.generadorPDF.generarDocumento(
      'Reporte de Horarios por Ambiente',
      kpis + generarSeccionTitulo('Uso de ambientes por día y hora') + bloques,
      {
        periodo: periodo.nombre,
        subtitulo: subtituloPartes.join(' · ') || 'Todos los ambientes activos',
      }
    );

    const config: ReporteConfig = {
      titulo: 'Reporte de Horarios por Ambiente',
      orientacion: 'landscape',
      formato: 'A4',
    };

    return this.generadorPDF.generarPDF(html, config);
  }

  private bloqueAmbiente(ambiente: {
    codigo: string;
    nombre: string;
    tipo: string;
    capacidad: number;
    ubicacion: string | null;
    horarios: {
      diaSemana: string;
      horaInicio: string;
      horaFin: string;
      estado: string;
      curso: { codigo: string; nombre: string };
      docente: { codigo: string; usuario: { nombre: string; apellidos: string } };
      grupo: { nombre: string } | null;
    }[];
  }): string {
    const tipoLabel = Formateadores.tipoAmbiente(ambiente.tipo);

    if (ambiente.horarios.length === 0) {
      return `
        <div style="margin-bottom:14px;padding:10px 14px;border:1px solid ${REPORTE_COLORES.borde};border-left:4px solid #94a3b8;border-radius:8px;opacity:0.75;">
          <strong style="color:${REPORTE_COLORES.textoSuave};">${escapeHtml(ambiente.codigo)} — ${escapeHtml(ambiente.nombre)}</strong>
          <span style="font-size:8pt;color:#94a3b8;margin-left:10px;">Sin horarios en este período</span>
        </div>`;
    }

    const sortedHorarios = [...ambiente.horarios].sort((a, b) => {
      const dif = (ORDEN_DIAS[a.diaSemana] ?? 9) - (ORDEN_DIAS[b.diaSemana] ?? 9);
      return dif !== 0 ? dif : a.horaInicio.localeCompare(b.horaInicio);
    });

    const filas = sortedHorarios.map((h) => [
      NOMBRE_DIA[h.diaSemana] ?? h.diaSemana,
      `${h.horaInicio} – ${h.horaFin}`,
      `${h.curso.codigo}`,
      h.curso.nombre,
      h.grupo ? `Grupo ${h.grupo.nombre}` : '—',
      Formateadores.nombreUsuario(h.docente.usuario),
      Formateadores.estadoHorario(h.estado),
    ]);

    const ocupacionColor =
      ambiente.horarios.length >= 10
        ? REPORTE_COLORES.exito
        : ambiente.horarios.length >= 5
          ? REPORTE_COLORES.alerta
          : REPORTE_COLORES.textoSuave;

    return `
      <div style="margin-bottom:20px;padding:14px 16px;border:1px solid ${REPORTE_COLORES.borde};border-left:4px solid ${REPORTE_COLORES.dorado};border-radius:8px;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <strong style="font-size:10.5pt;color:${REPORTE_COLORES.azul};">${escapeHtml(ambiente.codigo)} — ${escapeHtml(ambiente.nombre)}</strong>
            <span style="font-size:8.5pt;color:${REPORTE_COLORES.textoSuave};margin-left:10px;">
              ${escapeHtml(tipoLabel)} · Cap. ${escapeHtml(String(ambiente.capacidad))} personas
              ${ambiente.ubicacion ? ` · ${escapeHtml(ambiente.ubicacion)}` : ''}
            </span>
          </div>
          <span style="font-size:8.5pt;font-weight:700;color:${ocupacionColor};">
            ${ambiente.horarios.length} sesiones
          </span>
        </div>
        ${generarTablaHTML(
          ['Día', 'Horario', 'Código', 'Asignatura', 'Grupo', 'Docente', 'Estado'],
          filas
        )}
      </div>`;
  }
}
