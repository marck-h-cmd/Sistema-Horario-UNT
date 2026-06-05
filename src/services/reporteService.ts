import { prisma } from '@/lib/prisma';
import { AppError } from '@/services/auth/AuthService';
import { GeneradorPDF } from './reportes/GeneradorPDF';
import { Formateadores } from '@/lib/formateadores';
import { TipoActividadNoLectiva, DiaSemana } from '@prisma/client';
import { UtilidadesFecha } from '@/lib/utilidadesFecha';
import { redis } from '@/lib/redis';

// Actividades no lectivas en orden requerido
const ACTIVIDADES_NO_LECTIVAS_ORDENADAS = [
  TipoActividadNoLectiva.PREPARACION_Y_EVALUACION,
  TipoActividadNoLectiva.CONSEJERIA,
  TipoActividadNoLectiva.INVESTIGACION,
  TipoActividadNoLectiva.CAPACITACION,
  TipoActividadNoLectiva.ACTIVIDADES_DE_GOBIERNO,
  TipoActividadNoLectiva.ACTIVIDADES_DE_ADMINISTRACION,
  TipoActividadNoLectiva.ASESORIA_DE_TESIS,
  TipoActividadNoLectiva.RESPONSABILIDAD_SOCIAL_UNIVERSITARIA,
  TipoActividadNoLectiva.COMITES_TECNICOS_Y_COMISIONES,
];

const NOMBRES_ACTIVIDADES: Record<TipoActividadNoLectiva, string> = {
  [TipoActividadNoLectiva.PREPARACION_Y_EVALUACION]: 'PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)',
  [TipoActividadNoLectiva.CONSEJERIA]: 'CONSEJERÍA',
  [TipoActividadNoLectiva.INVESTIGACION]: 'INVESTIGACIÓN',
  [TipoActividadNoLectiva.CAPACITACION]: 'CAPACITACIÓN',
  [TipoActividadNoLectiva.ACTIVIDADES_DE_GOBIERNO]: 'ACTIVIDADES DE GOBIERNO',
  [TipoActividadNoLectiva.ACTIVIDADES_DE_ADMINISTRACION]: 'ACTIVIDADES DE ADMINISTRACIÓN',
  [TipoActividadNoLectiva.ASESORIA_DE_TESIS]: 'ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL',
  [TipoActividadNoLectiva.RESPONSABILIDAD_SOCIAL_UNIVERSITARIA]: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA',
  [TipoActividadNoLectiva.COMITES_TECNICOS_Y_COMISIONES]: 'COMITÉS TÉCNICOS Y COMISIONES',
};

export class ReporteService {
  private generadorPDF = new GeneradorPDF();

  /**
   * Genera el FORMATO 1: Carga Horaria Asignada (Sede Central)
   */
  async generarFormato1Central(periodoId: string, docenteId: string): Promise<Buffer> {
    const data = await this.obtenerDatosCompletosDocente(docenteId, periodoId);
    const html = this.construirHtmlFormato1(data, 'SEDE_CENTRAL');
    return this.generadorPDF.generarPDF(html, {
      titulo: 'Formato 1 - Carga Horaria (Sede Central)',
      orientacion: 'portrait',
      formato: 'A4',
    });
  }

  /**
   * Genera el FORMATO 2: Declaración Jurada (Sede Central)
   */
  async generarFormato2Central(periodoId: string, docenteId: string): Promise<Buffer> {
    const data = await this.obtenerDatosCompletosDocente(docenteId, periodoId);
    const html = this.construirHtmlFormato2(data, 'SEDE_CENTRAL');
    return this.generadorPDF.generarPDF(html, {
      titulo: 'Formato 2 - Declaración Jurada (Sede Central)',
      orientacion: 'portrait',
      formato: 'A4',
    });
  }

  /**
   * Genera el FORMATO 1: Carga Horaria Asignada (Sedes Desconcentradas)
   */
  async generarFormato1Descentralizada(periodoId: string, docenteId: string): Promise<Buffer> {
    const data = await this.obtenerDatosCompletosDocente(docenteId, periodoId);
    const html = this.construirHtmlFormato1(data, 'SEDE_DESCENTRALIZADA');
    return this.generadorPDF.generarPDF(html, {
      titulo: 'Formato 1 - Carga Horaria (Sedes Desconcentradas)',
      orientacion: 'portrait',
      formato: 'A4',
    });
  }

  /**
   * Genera el FORMATO 2: Declaración Jurada (Sedes Desconcentradas)
   */
  async generarFormato2Descentralizada(periodoId: string, docenteId: string): Promise<Buffer> {
    const data = await this.obtenerDatosCompletosDocente(docenteId, periodoId);
    const html = this.construirHtmlFormato2(data, 'SEDE_DESCENTRALIZADA');
    return this.generadorPDF.generarPDF(html, {
      titulo: 'Formato 2 - Declaración Jurada (Sedes Desconcentradas)',
      orientacion: 'portrait',
      formato: 'A4',
    });
  }

  /**
   * Genera el FORMATO 3: Horario Semanal del Personal Docente
   */
  async generarFormato3Horario(periodoId: string, docenteId: string): Promise<Buffer> {
    const data = await this.obtenerDatosCompletosDocente(docenteId, periodoId);
    const html = this.construirHtmlFormato3(data);
    return this.generadorPDF.generarPDF(html, {
      titulo: 'Formato 3 - Horario Semanal',
      orientacion: 'landscape',
      formato: 'A4',
    });
  }

  /**
   * Auxiliar para recopilar toda la información estructurada del docente, sus cursos, actividades y horarios
   */
  private async obtenerDatosCompletosDocente(docenteId: string, periodoId: string) {
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true } },
        comisiones: { where: { activo: true } },
        cargos: { where: { activo: true } },
      },
    });

    if (!docente) throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');

    const periodo = await prisma.periodoAcademico.findUnique({ where: { id: periodoId } });
    if (!periodo) throw new AppError('Período académico no encontrado', 404, 'PERIODO_NOT_FOUND');

    // Cursos asignados
    const cursosAsignados = await prisma.cursoDocente.findMany({
      where: { docenteId, activo: true },
      include: {
        curso: {
          include: {
            grupos: { where: { activo: true } },
          },
        },
      },
    });

    // Horarios académicos (Lectivos)
    const horariosLectivos = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        curso: true,
        grupo: true,
        ambiente: true,
      },
    });

    // Declaración no lectiva
    const declaracion = await prisma.declaracionNoLectiva.findUnique({
      where: {
        docenteId_periodoId: { docenteId, periodoId },
      },
      include: {
        items: true,
      },
    });

    // Distribución no lectiva
    const distribucionesNoLectivas = await prisma.distribucionNoLectiva.findMany({
      where: { docenteId, periodoId },
      include: {
        declaracionItem: true,
      },
    });

    return {
      docente,
      periodo,
      cursosAsignados,
      horariosLectivos,
      declaracion,
      distribucionesNoLectivas,
    };
  }

  /**
   * Construye el HTML para el Formato 1 (Carga Horaria Asignada)
   */
  private construirHtmlFormato1(data: any, tipoSede: 'SEDE_CENTRAL' | 'SEDE_DESCENTRALIZADA'): string {
    const { docente, periodo, cursosAsignados, declaracion } = data;
    const nombreDocente = `${docente.usuario.nombre} ${docente.usuario.apellidos}`;

    // Cursos
    const filasCursos = cursosAsignados.map((ca: any) => {
      const c = ca.curso;
      // Obtener qué grupos específicos de este curso tiene asignados este docente en el periodo
      const horariosCursoDocente = data.horariosLectivos.filter((h: any) => h.cursoId === c.id);
      const gruposIds = Array.from(new Set(horariosCursoDocente.map((h: any) => h.grupoId).filter(Boolean)));
      const gruposNombres = c.grupos
        .filter((g: any) => gruposIds.includes(g.id))
        .map((g: any) => g.nombre)
        .join(', ') || 'A';

      const totalHoras = c.horasTeoria + c.horasPractica + c.horasLaboratorio;

      return `
        <tr>
          <td>${escapeHtml(c.codigo)}</td>
          <td>${escapeHtml(c.nombre)}</td>
          <td>OB</td>
          <td>Ingeniería de Sistemas</td>
          <td>${escapeHtml(c.ciclo.toString())}°</td>
          <td>${escapeHtml(gruposNombres)}</td>
          <td>30</td>
          <td>${c.horasTeoria}</td>
          <td>${c.horasPractica}</td>
          <td>${c.horasLaboratorio}</td>
          <td class="font-bold">${totalHoras}</td>
        </tr>`;
    }).join('');

    const totalLectivas = cursosAsignados.reduce((sum: number, ca: any) => {
      const c = ca.curso;
      return sum + c.horasTeoria + c.horasPractica + c.horasLaboratorio;
    }, 0);

    // Carga No Lectiva
    const itemsNoLectivas = declaracion?.items || [];
    
    const filasNoLectivas = ACTIVIDADES_NO_LECTIVAS_ORDENADAS.map((actividad, index) => {
      const declarado = itemsNoLectivas.find((i: any) => i.tipoActividad === actividad);
      const horas = declarado ? declarado.horasSemanales : 0;
      const descripcion = declarado?.descripcion || '';

      return `
        <tr>
          <td class="text-center">${index + 2}</td>
          <td>
            <strong>${NOMBRES_ACTIVIDADES[actividad]}</strong>
            ${descripcion ? `<br/><span style="font-size: 8pt;">${escapeHtml(descripcion)}</span>` : ''}
          </td>
          <td class="text-center">${horas}</td>
        </tr>`;
    }).join('');

    const totalNoLectivas = itemsNoLectivas.reduce((sum: number, item: any) => sum + (item.horasSemanales || 0), 0);
    const totalGeneral = totalLectivas + totalNoLectivas;

    const fechaActual = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.2; color: #000000; margin: 25mm; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 12pt; margin: 0 0 3px; font-weight: bold; text-transform: uppercase; }
          .header h2 { font-size: 11pt; margin: 0; font-weight: bold; text-transform: uppercase; }
          .seccion-titulo { font-size: 10pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; text-transform: uppercase; }
          .tabla-oficial { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; }
          .tabla-oficial th { background: #f0f0f0; border: 1px solid #000; padding: 6px 4px; text-align: center; text-transform: uppercase; font-weight: bold; }
          .tabla-oficial td { border: 1px solid #000; padding: 6px 4px; vertical-align: middle; }
          .tabla-oficial tr:nth-child(even) { background: #ffffff; }
          .total-caja { background: #f0f0f0; font-weight: bold; text-align: right; }
          .firmas { width: 100%; margin-top: 60px; border-collapse: collapse; }
          .firmas td { width: 33.33%; text-align: center; vertical-align: bottom; height: 80px; font-size: 9.5pt; }
          .firmas-linea { border-top: 1px solid #000; width: 80%; margin: 0 auto 8px; }
          .fecha { text-align: right; margin-top: 30px; font-size: 10pt; }
          .datos-generales { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
          .datos-generales td { border: 1px solid #000; padding: 5px; }
          .datos-generales .label { font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>UNIVERSIDAD NACIONAL DE TRUJILLO</h1>
          <h2>FORMATO N° 1</h2>
          <h2>DECLARACIÓN DE CARGA HORARIA ASIGNADA</h2>
        </div>

        <div class="seccion-titulo">I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</div>
        
        <table class="datos-generales">
          <tr>
            <td class="label">FACULTAD:</td>
            <td>Facultad de Ingeniería</td>
            <td class="label">DPTO. ACADÉMICO:</td>
            <td>${escapeHtml(docente.departamento || 'Ingeniería de Sistemas')}</td>
          </tr>
        </table>

        <table class="tabla-oficial">
          <thead>
            <tr>
              <th>NOMBRE COMPLETO</th>
              <th>CONDICIÓN</th>
              <th>CATEGORÍA</th>
              <th>MODALIDAD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(nombreDocente)}</td>
              <td class="text-center">NOMBRADO</td>
              <td class="text-center">${escapeHtml(Formateadores.categoriaDocente(docente.categoria))}</td>
              <td class="text-center">${escapeHtml(docente.dedicacion.replace(/_/g, ' '))}</td>
            </tr>
          </tbody>
        </table>

        <table class="datos-generales">
          <tr>
            <td class="label">AÑO ACADÉMICO:</td>
            <td>${new Date().getFullYear()}</td>
            <td class="label">CICLO(SEM):</td>
            <td>${escapeHtml(periodo.nombre)}</td>
            <td class="label">INICIO:</td>
            <td></td>
            <td class="label">FINAL:</td>
            <td></td>
          </tr>
        </table>

        <div class="seccion-titulo">1. TRABAJO LECTIVO.- Datos completos y con claridad</div>
        
        <table class="tabla-oficial">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>NOMBRE DEL CURSO</th>
              <th>CUR.</th>
              <th>ESCUELA PROF.</th>
              <th>CIC.</th>
              <th>SEC.</th>
              <th>N° AL.</th>
              <th>H.T.</th>
              <th>H.P.</th>
              <th>H.L.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${filasCursos || '<tr><td colspan="11" class="text-center">Ningún curso asignado</td></tr>'}
            <tr class="total-caja">
              <td colspan="10">TOTAL HORAS LECTIVAS:</td>
              <td class="text-center">${totalLectivas}</td>
            </tr>
          </tbody>
        </table>

        <table class="tabla-oficial">
          <thead>
            <tr>
              <th>N°</th>
              <th>ACTIVIDAD NO LECTIVA</th>
              <th>HORAS</th>
            </tr>
          </thead>
          <tbody>
            ${filasNoLectivas}
            <tr class="total-caja">
              <td colspan="2">TOTAL HORAS NO LECTIVAS:</td>
              <td class="text-center">${totalNoLectivas}</td>
            </tr>
          </tbody>
        </table>

        <table class="tabla-oficial">
          <tbody>
            <tr>
              <td style="width: 75%; text-align: right; font-weight: bold;">TOTAL</td>
              <td style="width: 25%; text-align: center; font-weight: bold;">${totalGeneral}</td>
            </tr>
          </tbody>
        </table>

        <div class="fecha">
          Trujillo, ${fechaActual}
        </div>

        <table class="firmas">
          <tr>
            <td>
              <div class="firmas-linea"></div>
              Firma del Profesor
            </td>
            <td>
              <div class="firmas-linea"></div>
              Firma del Director de Dpto.
            </td>
            <td>
              <div class="firmas-linea"></div>
              V° B° DECANO FAC.
            </td>
          </tr>
        </table>
      </body>
      </html>`;
  }

  /**
   * Construye el HTML para el Formato 2 (Declaración Jurada de Incompatibilidad)
   */
  private construirHtmlFormato2(data: any, tipoSede: 'SEDE_CENTRAL' | 'SEDE_DESCENTRALIZADA'): string {
    const { docente, periodo } = data;
    const nombreDocente = `${docente.usuario.nombre} ${docente.usuario.apellidos}`;

    const reglasCentral = `
      <ol>
        <li>No desempeñar otro cargo público remunerado, con excepción de la función docente universitaria, siempre que no exista cruce u superposición de horarios.</li>
        <li>No incurrir en cruce o superposición horaria alguna entre las horas declaradas en esta universidad y otras actividades externas.</li>
        <li>Respetar estrictamente la dedicación asignada por contrato o nombramiento (20h Semanales para Tiempo Parcial, 40h para Tiempo Completo o Dedicación Exclusiva).</li>
        <li>La preparación de clases y evaluación no puede superar el límite del 50% de la carga lectiva dictada.</li>
        <li>Cumplir debidamente con el registro de asistencia en el sistema oficial y la permanencia exigida según su dedicación.</li>
      </ol>`;

    const reglasDesconcentrada = `
      <ol>
        <li>No desempeñar otro cargo remunerado fuera de la sede de comisionamiento sin la debida resolución rectoral de destaque u destaque temporal.</li>
        <li>El traslado físico a las sedes de Tayabamba, Huamachuco y Cascas imposibilita dictar clases en la sede central el mismo día natural.</li>
        <li>Contar con Resolución de Comisión de Servicio vigente y activa firmada por el Decano de la Facultad para el período académico actual.</li>
        <li>No dictar más de las horas máximas asignadas para su categoría y dedicación específicas en comisiones especiales.</li>
        <li>Asegurar el reemplazo de su carga horaria en la sede central por un docente alternativo debidamente calificado y registrado en el sistema.</li>
        <li>Acatar los cronogramas oficiales de inicio y término establecidos específicamente para los módulos descentralizados.</li>
        <li>Presentar el informe mensual de actividades firmado por el coordinador de la sede descentralizada respectiva.</li>
      </ol>`;

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.6; color: #1e293b; margin: 30px; }
          .header { text-align: center; border-bottom: 2px solid #0f2d55; padding-bottom: 12px; margin-bottom: 25px; }
          .header h1 { color: #0f2d55; font-size: 15pt; margin: 0 0 4px; font-weight: 800; text-transform: uppercase; }
          .header h2 { color: #64748b; font-size: 11pt; margin: 0; font-weight: 550; text-transform: uppercase; }
          .cuerpo-dj { text-align: justify; margin-top: 30px; }
          .datos-consolidado { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .datos-consolidado table { width: 100%; border-collapse: collapse; }
          .datos-consolidado td { padding: 4px 8px; }
          ol { padding-left: 20px; }
          li { margin-bottom: 10px; }
          .fecha { text-align: right; margin-top: 40px; }
          .firma-caja { text-align: center; margin-top: 80px; }
          .firma-linea { border-top: 1.5px solid #1e293b; width: 40%; margin: 0 auto 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>UNIVERSIDAD NACIONAL DE TRUJILLO</h1>
          <h2>FORMATO N° 2: DECLARACIÓN JURADA DE INCOMPATIBILIDAD HORARIA Y DE CARGO</h2>
          <div>Período Académico: <strong>${escapeHtml(periodo.nombre)}</strong></div>
        </div>

        <div class="cuerpo-dj">
          <p>Yo, <strong>${escapeHtml(nombreDocente)}</strong>, identificado con el código docente/DNI N° <strong>${escapeHtml(docente.codigo)}</strong>, de la categoría docente <strong>${escapeHtml(Formateadores.categoriaDocente(docente.categoria))}</strong> y dedicación <strong>${escapeHtml(docente.dedicacion.replace(/_/g, ' '))}</strong>, adscrito al Departamento de <strong>${escapeHtml(docente.departamento || 'Ingeniería de Sistemas')}</strong> de la Facultad de Ingeniería de la Universidad Nacional de Trujillo.</p>

          <p><strong>DECLARO BAJO JURAMENTO:</strong></p>
          
          <p>Que me comprometo a cumplir estrictamente el reglamento y las disposiciones vigentes en materia de control horario, compatibilidad de cargo e incompatibilidades de la Universidad Nacional de Trujillo, declarando conocer las siguientes normas reguladoras:</p>

          ${tipoSede === 'SEDE_CENTRAL' ? reglasCentral : reglasDesconcentrada}

          <p>Asimismo, declaro que la información contenida en mi Formato N° 1 adjunto es absolutamente verdadera, exacta y no genera incompatibilidad alguna con mis actividades personales o de otra índole fuera de la universidad.</p>

          <p>En caso de incurrir en alguna superposición, cruce de horarios o falsa declaración, me someto a las sanciones y medidas administrativas, civiles y penales que la Universidad y las leyes del Estado determinen pertinentes.</p>

          <div class="datos-consolidado">
            <table>
              <tr>
                <td><strong>DNI / IBM:</strong></td>
                <td>${escapeHtml(docente.codigo)}</td>
                <td><strong>Correo:</strong></td>
                <td>${escapeHtml(docente.usuario.email)}</td>
              </tr>
              <tr>
                <td><strong>Facultad:</strong></td>
                <td>Facultad de Ingeniería</td>
                <td><strong>Dedicación:</strong></td>
                <td>${escapeHtml(docente.dedicacion.replace(/_/g, ' '))}</td>
              </tr>
            </table>
          </div>

          <div class="fecha">
            Trujillo, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          <div class="firma-caja">
            <div class="firma-linea"></div>
            <strong>${escapeHtml(nombreDocente)}</strong><br/>
            DNI N° ____________________<br/>
            Docente Declarante
          </div>
        </div>
      </body>
      </html>`;
  }

  /**
   * Construye el HTML para el Formato 3 (Horario Semanal con Carga Lectiva + No Lectiva)
   */
  private construirHtmlFormato3(data: any): string {
    const { docente, periodo, horariosLectivos, distribucionesNoLectivas } = data;
    const nombreDocente = `${docente.usuario.nombre} ${docente.usuario.apellidos}`;

    // Armar la grilla de horas
    const HORAS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 a 21:00
    const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    const DIAS_LABEL: Record<string, string> = {
      LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
      JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
    };

    // Mapear horarios en una matriz para facilitar su renderizado en HTML
    // matriz[dia][hora] = { tipo: 'LECTIVO' | 'NO_LECTIVO', label, rowSpan, color }
    const matriz: Record<string, Record<number, any>> = {};
    const celdasOcupadas: Record<string, Set<number>> = {};

    for (const dia of DIAS) {
      matriz[dia] = {};
      celdasOcupadas[dia] = new Set<number>();
    }

    // 1. Cargar lectivos
    for (const hl of horariosLectivos) {
      if (!hl.diaSemana || !hl.horaInicio || !hl.horaFin) continue;
      const dia = hl.diaSemana;
      const hIni = parseInt(hl.horaInicio.split(':')[0], 10);
      const hFin = parseInt(hl.horaFin.split(':')[0], 10);
      const rowSpan = Math.max(1, hFin - hIni);

      matriz[dia][hIni] = {
        tipo: 'LECTIVO',
        label: `<strong>${escapeHtml(hl.curso.codigo)}</strong><br/>${escapeHtml(hl.curso.nombre)}<br/>Gpo ${escapeHtml(hl.grupo?.nombre || 'A')}<br/>${escapeHtml(hl.ambiente?.codigo || 'AULA')}`,
        rowSpan,
        bg: '#eff6ff',
        border: '#3b82f6',
        text: '#1e3a8a',
      };

      for (let h = hIni; h < hFin; h++) {
        celdasOcupadas[dia].add(h);
      }
    }

    // 2. Cargar no lectivos
    for (const dnl of distribucionesNoLectivas) {
      const dia = dnl.diaSemana;
      const hIni = parseInt(dnl.horaInicio.split(':')[0], 10);
      const hFin = parseInt(dnl.horaFin.split(':')[0], 10);
      const rowSpan = Math.max(1, hFin - hIni);

      const colorInfo = this.obtenerColorActividadNoLectiva(dnl.declaracionItem.tipoActividad);

      matriz[dia][hIni] = {
        tipo: 'NO_LECTIVO',
        label: `<strong>NO LECTIVA</strong><br/>${escapeHtml(this.formatearTipoActividad(dnl.declaracionItem.tipoActividad))}`,
        rowSpan,
        bg: colorInfo.bg,
        border: colorInfo.border,
        text: colorInfo.text,
      };

      for (let h = hIni; h < hFin; h++) {
        celdasOcupadas[dia].add(h);
      }
    }

    // Construir filas de la tabla
    const filasTabla = HORAS.map((h) => {
      const celdas = DIAS.map((dia) => {
        const item = matriz[dia][h];
        if (item) {
          return `
            <td rowspan="${item.rowSpan}" style="background: ${item.bg}; border-left: 4px solid ${item.border}; color: ${item.text}; padding: 6px; font-size: 8pt; vertical-align: top; text-align: center;">
              ${item.label}
            </td>`;
        }
        if (celdasOcupadas[dia].has(h)) {
          return ''; // Celda consumida por un rowSpan
        }
        return `<td style="border: 1px solid #e2e8f0; background: white;"></td>`;
      }).join('');

      return `
        <tr>
          <td style="font-weight: 700; background: #f1f5f9; text-align: center; border: 1px solid #cbd5e1; font-size: 8.5pt;">
            ${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00
          </td>
          ${celdas}
        </tr>`;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; margin: 15px; }
          .header { text-align: center; border-bottom: 2px solid #0f2d55; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { color: #0f2d55; font-size: 14pt; margin: 0 0 2px; font-weight: 800; text-transform: uppercase; }
          .header h2 { color: #64748b; font-size: 10pt; margin: 0; font-weight: 550; text-transform: uppercase; }
          .info-docente { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt; }
          .info-docente td { padding: 2px 6px; }
          table.horario-grilla { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; table-layout: fixed; }
          table.horario-grilla th { background: #0f2d55; color: white; border: 1px solid #0f2d55; padding: 6px; text-transform: uppercase; font-size: 8pt; text-align: center; }
          table.horario-grilla td { border: 1px solid #cbd5e1; height: 42px; }
          .leyenda { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; font-size: 8pt; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          .leyenda-item { display: flex; items-center: center; gap: 4px; }
          .leyenda-color { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>UNIVERSIDAD NACIONAL DE TRUJILLO</h1>
          <h2>FORMATO N° 3: DISTRIBUCIÓN DE HORAS SEMANALES DEL PERSONAL DOCENTE</h2>
          <div>Período Académico: <strong>${escapeHtml(periodo.nombre)}</strong></div>
        </div>

        <table class="info-docente">
          <tr>
            <td><strong>Docente:</strong></td>
            <td>${escapeHtml(nombreDocente)}</td>
            <td><strong>Código/DNI:</strong></td>
            <td>${escapeHtml(docente.codigo)}</td>
            <td><strong>Dedicación:</strong></td>
            <td>${escapeHtml(docente.dedicacion.replace(/_/g, ' '))}</td>
          </tr>
        </table>

        <table class="horario-grilla">
          <thead>
            <tr>
              <th style="width: 10%;">Hora</th>
              ${DIAS.map((d) => `<th style="width: 12.8%;">${DIAS_LABEL[d]}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>

        <div class="leyenda">
          <strong>Leyenda:</strong>
          <div class="leyenda-item">
            <span class="leyenda-color" style="background: #eff6ff; border-left: 3px solid #3b82f6;"></span>
            <span>Clases Lectivas</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color" style="background: #f0fdf4; border-left: 3px solid #22c55e;"></span>
            <span>Prep. y Eval.</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color" style="background: #fffbeb; border-left: 3px solid #eab308;"></span>
            <span>Consejería</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color" style="background: #faf5ff; border-left: 3px solid #a855f7;"></span>
            <span>Investigación</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color" style="background: #fff1f2; border-left: 3px solid #f43f5e;"></span>
            <span>Otros No Lectivos</span>
          </div>
        </div>
      </body>
      </html>`;
  }

  private formatearTipoActividad(tipo: TipoActividadNoLectiva): string {
    return NOMBRES_ACTIVIDADES[tipo] || tipo.replace(/_/g, ' ');
  }

  private obtenerColorActividadNoLectiva(tipo: TipoActividadNoLectiva) {
    switch (tipo) {
      case TipoActividadNoLectiva.PREPARACION_Y_EVALUACION:
        return { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' };
      case TipoActividadNoLectiva.CONSEJERIA:
        return { bg: '#fffbeb', border: '#eab308', text: '#713f12' };
      case TipoActividadNoLectiva.INVESTIGACION:
        return { bg: '#faf5ff', border: '#a855f7', text: '#581c87' };
      default:
        return { bg: '#fff1f2', border: '#f43f5e', text: '#4c0519' };
    }
  }

  /**
   * Generación de lotes masivos de PDFs
   * Se ejecuta de forma asíncrona informando su progreso en Redis/WebSocket.
   */
  async procesarLoteGeneracion(periodoId: string, docenteIds: string[], jobId: string) {
    const total = docenteIds.length;
    let procesados = 0;
    
    // Guardar estado inicial en Redis
    await redis.set(`job:${jobId}`, JSON.stringify({ estado: 'PROCESANDO', total, procesados, porcentaje: 0 }));

    // Publicar evento inicial en WebSocket
    await redis.publish(`ws:general`, JSON.stringify({
      channel: 'general',
      data: { type: 'lote_pdf_progreso', jobId, estado: 'PROCESANDO', total, procesados, porcentaje: 0 },
      timestamp: new Date().toISOString(),
    }));

    for (const dId of docenteIds) {
      try {
        // Generar los 3 formatos representativos por docente
        await Promise.all([
          this.generarFormato1Central(periodoId, dId),
          this.generarFormato2Central(periodoId, dId),
          this.generarFormato3Horario(periodoId, dId),
        ]);

        procesados++;
        const porcentaje = Math.round((procesados / total) * 100);

        // Guardar progreso
        await redis.set(`job:${jobId}`, JSON.stringify({ estado: 'PROCESANDO', total, procesados, porcentaje }));

        // Publicar progreso
        await redis.publish(`ws:general`, JSON.stringify({
          channel: 'general',
          data: { type: 'lote_pdf_progreso', jobId, estado: 'PROCESANDO', total, procesados, porcentaje },
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        console.error(`Error procesando lote para docente ${dId}:`, err);
      }
    }

    // Finalizar job
    await redis.set(`job:${jobId}`, JSON.stringify({ estado: 'COMPLETADO', total, procesados, porcentaje: 100 }));
    
    await redis.publish(`ws:general`, JSON.stringify({
      channel: 'general',
      data: { type: 'lote_pdf_progreso', jobId, estado: 'COMPLETADO', total, procesados, porcentaje: 100 },
      timestamp: new Date().toISOString(),
    }));
  }
}

function escapeHtml(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
