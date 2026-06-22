import { Formateadores } from '@/lib/formateadores';
import { calcularHorasEntre } from '@/lib/horario-horas';
import { UtilidadesFecha } from '@/lib/utilidadesFecha';
import {
  escapeHtml,
  estilosBasePDF,
  generarCajaInfo,
  generarEncabezadoHTML,
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
} from './reporte-estilos';

const DAY_COLORS: Record<string, string> = {
  LUNES: '#eff6ff',
  MARTES: '#f0fdf4',
  MIERCOLES: '#faf5ff',
  JUEVES: '#fffbeb',
  VIERNES: '#fff1f2',
  SABADO: '#f0f9ff',
};

const DAY_BORDER: Record<string, string> = {
  LUNES: '#bfdbfe',
  MARTES: '#bbf7d0',
  MIERCOLES: '#e9d5ff',
  JUEVES: '#fef3c7',
  VIERNES: '#fecdd3',
  SABADO: '#bae6fd',
};

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
const DIAS_LABEL: Record<string, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function estilosHorarioExtendidos(): string {
  return `
    ${estilosBasePDF()}
    .entity-card {
      display: flex; justify-content: space-between; align-items: center;
      background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0f2d55;
      border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;
    }
    .entity-card h2 { margin: 0; color: #0f2d55; font-size: 13pt; }
    .entity-card p { margin: 4px 0 0; color: #64748b; font-size: 9pt; }
    .stat { text-align: right; }
    .stat-label { font-size: 7pt; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .stat-value { font-size: 14pt; font-weight: 800; color: #0f2d55; }
    .day-title { font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin: 16px 0 8px; }
    .table-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    table.horario-tabla { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.horario-tabla th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 7.5pt; color: #475569; }
    table.horario-tabla td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .col-horario { font-weight: 700; color: #0f2d55; }
    .col-codigo { font-family: monospace; color: #64748b; }
    .col-curso { font-weight: 600; }
    .page-break { page-break-before: always; }
  `;
}

type HorarioDocente = {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  curso: { codigo: string; nombre: string; creditos: number };
  ambiente: { codigo: string; tipo: string };
  grupo: { nombre: string } | null;
  cursoDocenteGrupo?: any;
};

type DocenteHorarioInput = {
  codigo: string;
  categoria: string;
  usuario: { nombre: string; apellidos: string; email: string };
  horarios: HorarioDocente[];
};

export function htmlSeccionDocente(docente: DocenteHorarioInput): string {
  const cursosUnicos = new Set(docente.horarios.map((h) => h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.codigo));
  const totalHoras = docente.horarios.reduce(
    (acc, h) => acc + (h.horaInicio && h.horaFin ? calcularHorasEntre(h.horaInicio, h.horaFin) : 0),
    0
  );

  const bloquesDia = DIAS.map((dia) => {
    const horariosDia = docente.horarios
      .filter((h) => h.diaSemana === dia)
      .sort((a, b) => {
        const timeA = a.horaInicio || '';
        const timeB = b.horaInicio || '';
        return timeA.localeCompare(timeB);
      });
    if (horariosDia.length === 0) return '';

    const filas = horariosDia
      .map(
        (h) => `
        <tr style="background:${DAY_COLORS[dia]}">
          <td class="col-horario">${h.horaInicio && h.horaFin ? `${escapeHtml(h.horaInicio.slice(0, 5))} – ${escapeHtml(h.horaFin.slice(0, 5))}` : 'Sin programar'}</td>
          <td class="col-codigo">${escapeHtml(h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.codigo)}</td>
          <td class="col-curso">${escapeHtml(h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre)}</td>
          <td>${escapeHtml(h.ambiente?.codigo ?? '—')}</td>
          <td>${escapeHtml(h.ambiente?.tipo === 'LABORATORIO' ? 'Lab.' : (h.ambiente?.tipo === 'AULA' ? 'Aula' : '—'))}</td>
          <td>${escapeHtml(h.grupo?.nombre ?? '—')}</td>
          <td>${escapeHtml(h.curso.creditos)}</td>
        </tr>`
      )
      .join('');

    return `
      <section>
        <h3 class="day-title" style="color:${DAY_BORDER[dia]}">${DIAS_LABEL[dia]}</h3>
        <div class="table-wrap" style="border-top:3px solid ${DAY_BORDER[dia]}">
          <table class="horario-tabla">
            <thead>
              <tr>
                <th>Horario</th><th>Código</th><th>Asignatura</th>
                <th>Aula</th><th>Tipo</th><th>Grupo</th><th>Créd.</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');

  return `
    <div class="entity-card">
      <div>
        <h2>${escapeHtml(Formateadores.nombreUsuario(docente.usuario))}</h2>
        <p>${escapeHtml(docente.codigo)} · ${escapeHtml(Formateadores.categoriaDocente(docente.categoria))} · ${escapeHtml(docente.usuario.email)}</p>
      </div>
      <div style="display:flex;gap:24px;">
        <div class="stat">
          <div class="stat-label">Carga lectiva</div>
          <div class="stat-value">${totalHoras.toFixed(1)} h</div>
        </div>
        <div class="stat">
          <div class="stat-label">Cursos</div>
          <div class="stat-value">${cursosUnicos.size}</div>
        </div>
      </div>
    </div>
    ${bloquesDia || '<p class="texto-vacio">Sin sesiones asignadas en este período.</p>'}
  `;
}

type HorarioAmbiente = {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  curso: { codigo: string; nombre: string };
  docente: { usuario: { nombre: string; apellidos: string } };
  grupo: { nombre: string } | null;
  cursoDocenteGrupo?: any;
};

type AmbienteHorarioInput = {
  codigo: string;
  nombre: string;
  tipo: string;
  capacidad: number;
  ubicacion: string | null;
  horarios: HorarioAmbiente[];
};

export function htmlSeccionAmbiente(ambiente: AmbienteHorarioInput): string {
  const horariosPorDia: Record<string, HorarioAmbiente[]> = {};
  for (const h of ambiente.horarios) {
    const dia = UtilidadesFecha.nombreDia(h.diaSemana);
    if (!horariosPorDia[dia]) horariosPorDia[dia] = [];
    horariosPorDia[dia].push(h);
  }

  let contenido = generarCajaInfo(`${ambiente.codigo} — ${ambiente.nombre}`, [
    `<strong>Tipo:</strong> ${Formateadores.tipoAmbiente(ambiente.tipo)}`,
    `<strong>Capacidad:</strong> ${Formateadores.capacidad(ambiente.capacidad)}`,
    `<strong>Ubicación:</strong> ${ambiente.ubicacion || 'No especificada'}`,
    `<strong>Sesiones asignadas:</strong> ${ambiente.horarios.length}`,
  ]);

  if (ambiente.horarios.length === 0) {
    contenido += '<p class="texto-vacio">Sin horarios asignados en este período.</p>';
    return contenido;
  }

  for (const dia of DIAS_NOMBRE) {
    const horariosDia = horariosPorDia[dia] || [];
    if (horariosDia.length === 0) continue;
    const filas = horariosDia.map((h) => [
      h.horaInicio && h.horaFin ? `${h.horaInicio.slice(0, 5)} – ${h.horaFin.slice(0, 5)}` : 'Sin programar',
      h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.codigo,
      h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre,
      Formateadores.nombreUsuario(h.docente.usuario),
      h.grupo?.nombre ?? '—',
    ]);
    contenido += generarSeccionTitulo(dia);
    contenido += generarTablaHTML(
      ['Horario', 'Código', 'Curso', 'Docente', 'Grupo'],
      filas
    );
  }

  const maxFranjas = 12 * 5;
  const porcentaje =
    maxFranjas > 0 ? Math.round((ambiente.horarios.length / maxFranjas) * 100) : 0;
  contenido += generarCajaInfo('Ocupación estimada', [
    `<strong>Franjas ocupadas:</strong> ${ambiente.horarios.length} / ${maxFranjas} (${porcentaje}%)`,
  ]);

  return contenido;
}

type HorarioCurso = {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  ambiente: { codigo: string; tipo: string };
  docente: { usuario: { nombre: string; apellidos: string } };
  grupo: { nombre: string } | null;
};

type CursoHorarioInput = {
  codigo: string;
  nombre: string;
  creditos: number;
  ciclo: number;
  horasTeoria: number;
  horasPractica: number;
  horarios: HorarioCurso[];
};

export function htmlSeccionCurso(curso: CursoHorarioInput): string {
  const totalHoras = curso.horarios.reduce(
    (acc, h) => acc + calcularHorasEntre(h.horaInicio, h.horaFin),
    0
  );
  const gruposUnicos = new Set(
    curso.horarios.map((h) => h.grupo?.nombre).filter(Boolean)
  );

  let contenido = `
    <div class="entity-card">
      <div>
        <h2>${escapeHtml(curso.codigo)} — ${escapeHtml(curso.nombre)}</h2>
        <p>Ciclo ${escapeHtml(curso.ciclo)} · ${escapeHtml(curso.creditos)} créditos · ${escapeHtml(curso.horasTeoria)}T / ${escapeHtml(curso.horasPractica)}P</p>
      </div>
      <div style="display:flex;gap:24px;">
        <div class="stat">
          <div class="stat-label">Horas programadas</div>
          <div class="stat-value">${totalHoras.toFixed(1)} h</div>
        </div>
        <div class="stat">
          <div class="stat-label">Sesiones</div>
          <div class="stat-value">${curso.horarios.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Grupos</div>
          <div class="stat-value">${gruposUnicos.size}</div>
        </div>
      </div>
    </div>
  `;

  if (curso.horarios.length === 0) {
    contenido += '<p class="texto-vacio">Sin sesiones programadas en este período.</p>';
    return contenido;
  }

  const horariosPorDia: Record<string, HorarioCurso[]> = {};
  for (const h of curso.horarios) {
    const dia = UtilidadesFecha.nombreDia(h.diaSemana);
    if (!horariosPorDia[dia]) horariosPorDia[dia] = [];
    horariosPorDia[dia].push(h);
  }

  for (const dia of DIAS_NOMBRE) {
    const horariosDia = horariosPorDia[dia] || [];
    if (horariosDia.length === 0) continue;
    const filas = horariosDia.map((h) => [
      h.horaInicio && h.horaFin ? `${h.horaInicio.slice(0, 5)} – ${h.horaFin.slice(0, 5)}` : 'Sin programar',
      Formateadores.nombreUsuario(h.docente?.usuario),
      h.ambiente?.codigo ?? '—',
      h.ambiente?.tipo === 'LABORATORIO' ? 'Laboratorio' : (h.ambiente?.tipo === 'AULA' ? 'Aula' : '—'),
      h.grupo?.nombre ?? '—',
      h.horaInicio && h.horaFin ? `${calcularHorasEntre(h.horaInicio, h.horaFin).toFixed(1)} h` : '0.0 h',
    ]);
    contenido += generarSeccionTitulo(dia);
    contenido += generarTablaHTML(
      ['Horario', 'Docente', 'Ambiente', 'Tipo', 'Grupo', 'Horas'],
      filas
    );
  }

  return contenido;
}

export function htmlDocumentoHorario(
  titulo: string,
  cuerpo: string,
  opciones: { periodo?: string; subtitulo?: string; landscape?: boolean }
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>${estilosHorarioExtendidos()}</style>
</head>
<body>
  ${generarEncabezadoHTML(titulo, opciones.periodo, opciones.subtitulo)}
  <main>${cuerpo}</main>
</body>
</html>`;
}

export function htmlResumenConsolidado(
  items: { label: string; value: string | number }[]
): string {
  return generarKpiGrid(items);
}

/** Une bloques HTML con salto de página entre cada uno */
export function unirSeccionesPaginadas(secciones: string[]): string {
  return secciones
    .filter(Boolean)
    .map((seccion, i) => `${i > 0 ? '<div class="page-break"></div>' : ''}${seccion}`)
    .join('');
}
