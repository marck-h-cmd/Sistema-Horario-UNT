import { prisma } from '@/lib/prisma';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import { ServicioEstadisticas } from '@/services/estadisticas/ServicioEstadisticas';
import { Formateadores } from '@/lib/formateadores';
import {
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
  generarCajaInfo,
} from './reporte-estilos';

export class ReporteGestionService {
  private generadorPDF = new GeneradorPDF();
  private servicioEstadisticas = new ServicioEstadisticas();

  async generar(periodoId: string): Promise<Buffer> {
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
      include: { configuraciones: true },
    });

    if (!periodo) {
      throw new Error('Período no encontrado');
    }

    const resumen = await this.servicioEstadisticas.obtenerResumen(periodoId);
    const avanceCategoria = await this.servicioEstadisticas.obtenerAvanceCategoria(periodoId);
    const ocupacion = await this.servicioEstadisticas.obtenerOcupacionAmbientes(periodoId);

    const docentesConHorarios = await prisma.cursoDocente.findMany({
      where: { 
        periodoId,
        cursoDocenteGrupos: {
          some: {
            horarios: { some: { estado: { not: 'CANCELADO' } } }
          }
        }
      },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    let contenido = generarKpiGrid([
      { label: 'Docentes', value: resumen.totalDocentes },
      { label: 'Cursos', value: resumen.totalCursos },
      { label: 'Ambientes', value: resumen.totalAmbientes },
      { label: 'Horarios', value: resumen.totalHorarios },
      { label: 'Doc. con horario', value: docentesConHorarios.length },
      {
        label: 'Vigencia período',
        value: `${new Date(periodo.fechaInicio).toLocaleDateString('es-PE')} – ${new Date(periodo.fechaFin).toLocaleDateString('es-PE')}`,
      },
    ]);

    contenido += generarSeccionTitulo('Avance por categoría docente');

    const filasCategoria = Object.entries(avanceCategoria).map(([categoria, datos]) => {
      const d = datos as {
        totalDocentes: number;
        totalCursosAsignados: number;
        horasRequeridas: number;
        horasAsignadas: number;
        porcentajeAvance: number;
      };
      return [
        Formateadores.categoriaDocente(categoria),
        d.totalDocentes.toString(),
        d.totalCursosAsignados.toString(),
        d.horasRequeridas.toFixed(1),
        d.horasAsignadas.toFixed(1),
        `${d.porcentajeAvance}%`,
      ];
    });

    contenido += generarTablaHTML(
      ['Categoría', 'Docentes', 'Cursos', 'Horas req.', 'Horas asig.', 'Avance'],
      filasCategoria
    );

    contenido += generarSeccionTitulo('Ocupación de ambientes (top 15)');

    const filasOcupacion = ocupacion.slice(0, 15).map((a) => [
      a.codigo,
      a.nombre,
      Formateadores.tipoAmbiente(a.tipo),
      a.horariosOcupados.toString(),
      `${a.porcentajeOcupacion}%`,
    ]);

    contenido += generarTablaHTML(
      ['Código', 'Nombre', 'Tipo', 'Horarios', '% Ocupación'],
      filasOcupacion
    );

    if (periodo.configuraciones) {
      const cfg = periodo.configuraciones;
      contenido += generarSeccionTitulo('Configuración del período');
      contenido += generarCajaInfo('Parámetros operativos', [
        `<strong>Horas máx. diarias por docente:</strong> ${cfg.horasMaxDiariasDocente}`,
        `<strong>Horas máx. continuas:</strong> ${cfg.horasMaxContinuas}`,
        `<strong>Descanso mínimo entre sesiones:</strong> ${cfg.descansoMinEntreHoras} h`,
        `<strong>Orden de atención:</strong> ${(cfg.ordenCategorias as string[])
          .map((c) => Formateadores.categoriaDocente(c))
          .join(' → ')}`,
      ]);
    }

    const html = this.generadorPDF.generarDocumento(
      'Reporte de Gestión de Horarios',
      contenido,
      { periodo: periodo.nombre }
    );

    const config: ReporteConfig = {
      titulo: 'Reporte de Gestión',
      orientacion: 'portrait',
      formato: 'A4',
    };

    return this.generadorPDF.generarPDF(html, config);
  }
}
