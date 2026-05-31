'use client';

import { useMemo } from 'react';

// ────────────────────────────────────────────
// Interfaz pública (exportada para otros archivos)
// ────────────────────────────────────────────
export interface HorarioCalendarItem {
  id: string;
  horaInicio: string;
  horaFin: string;
  diaSemana: string;
  curso: {
    codigo: string;
    fontColor?: string;
    nombre: string;
    ciclo: number;
    horasTeoria?: number;
    horasPractica?: number;
    horasLaboratorio?: number;
  };
  docente: {
    usuario: { nombre: string; apellidos: string };
    departamento?: string;
  };
  docenteId?: string;
  ambiente: { codigo: string; nombre?: string; tipo?: string };
  grupo?: { nombre: string } | null;
  estado?: string;
  tipoComponente?: string;
}

// ────────────────────────────────────────────
// Props del componente
// ────────────────────────────────────────────
interface HorarioWeeklyCalendarProps {
  horarios: HorarioCalendarItem[];
  dias: readonly string[];
  diaLabels: Record<string, string>;
  horas: number[];
  loading?: boolean;
  /** Datos institucionales para la cabecera */
  ciclo?: string | number;
  seccion?: string;
  anio?: string | number;
  semestre?: string | number;
  fechaInicio?: string;
  fechaFin?: string;
}

// ────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────
const COLORES = [
  '#c6efce', '#ffc7ce', '#bdd7ee', '#e2efda',
  '#ffff00', '#92d050', '#dce6f1', '#e4dfec',
  '#fce4d6', '#d9d9d9', '#fff2cc', '#ddebf7', '#f8cbad',
];

type DiaSemanaKey = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';

const DIAS_GRILLA: DiaSemanaKey[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const FRANJAS = [
  { ini: '07:00', fin: '08:00', label: '7-8' },
  { ini: '08:00', fin: '09:00', label: '8-9' },
  { ini: '09:00', fin: '10:00', label: '9-10' },
  { ini: '10:00', fin: '11:00', label: '10-11' },
  { ini: '11:00', fin: '12:00', label: '11-12' },
  { ini: '12:00', fin: '13:00', label: '12-1' },
  { ini: '13:00', fin: '14:00', label: '1-2' },
  { ini: '14:00', fin: '15:00', label: '2-3' },
  { ini: '15:00', fin: '16:00', label: '3-4' },
  { ini: '16:00', fin: '17:00', label: '4-5' },
  { ini: '17:00', fin: '18:00', label: '5-6' },
  { ini: '18:00', fin: '19:00', label: '6-7' },
  { ini: '19:00', fin: '20:00', label: '7-8p' },
];

const calcRowspan = (ini: string, fin: string) => {
  const [h1] = ini.split(':').map(Number);
  const [h2] = fin.split(':').map(Number);
  return Math.max(h2 - h1, 1);
};

// ────────────────────────────────────────────
// Estilos inline (formato oficial UNT)
// ────────────────────────────────────────────
const celda: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2px 4px',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: 10,
};

const celdaInst: React.CSSProperties = {
  ...celda,
  textAlign: 'left',
  fontSize: 10,
};

const horaCol: React.CSSProperties = {
  ...celda,
  background: '#f2f2f2',
  fontWeight: 'bold',
  width: 38,
};

const th: React.CSSProperties = {
  ...celda,
  background: '#000',
  color: '#fff',
  fontWeight: 'bold',
};

const azul: React.CSSProperties = { color: '#0070c0', fontWeight: 'bold' };
const rojo: React.CSSProperties = { color: '#c00000', fontWeight: 'bold' };

// ────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────
export function HorarioWeeklyCalendar({
  horarios,
  dias: _dias,
  diaLabels: _diaLabels,
  horas: _horas,
  loading,
  ciclo = '',
  seccion = '',
  anio = '',
  semestre = '',
  fechaInicio = '',
  fechaFin = '',
}: HorarioWeeklyCalendarProps) {

  // ── Paso 1 — Deduplicar docentes por docenteId ──
  const docentesUnicos = useMemo(() => {
    const seen = new Map<string, any>();
    for (const h of horarios) {
      const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
      if (!seen.has(docId)) {
        // Calcular total de horas reales programadas (sesiones semanales)
        const totalHorasSemana = horarios
          .filter(x => (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId)
          .reduce((sum, x) => {
            if (!x.horaInicio || !x.horaFin) return sum;
            const h1 = parseInt(x.horaInicio.split(':')[0]);
            const h2 = parseInt(x.horaFin.split(':')[0]);
            return sum + Math.max(h2 - h1, 0);
          }, 0);

        seen.set(docId, {
          docenteId: docId,
          nombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`, // Formato: Nombre Apellidos
          asignatura: h.curso.nombre,
          cursoCodigo: h.curso.codigo || '',
          horasT: h.curso.horasTeoria ?? 0,
          horasP: h.curso.horasPractica ?? 0,
          horasL: h.curso.horasLaboratorio ?? 0,
          grupos: horarios.filter(x => (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId).length,
          totalHoras: totalHorasSemana,
          departamento: h.docente.departamento ?? '',
        });
      }
    }

    // Convertir a array y ordenar por prioridad de código de curso
    const list = Array.from(seen.values());
    list.sort((a, b) => {
      const getPrefixPriority = (code: string) => {
        if (code.startsWith('IS-')) return 1;
        if (code.startsWith('EG-')) return 2;
        return 3;
      };
      const prioA = getPrefixPriority(a.cursoCodigo);
      const prioB = getPrefixPriority(b.cursoCodigo);
      if (prioA !== prioB) return prioA - prioB;
      return a.cursoCodigo.localeCompare(b.cursoCodigo);
    });

    // Asignar número y color en base al orden prioritario
    list.forEach((doc, idx) => {
      doc.numero = idx + 1;
      doc.color = COLORES[idx % COLORES.length];
    });

    return list;
  }, [horarios]);

  const getDocente = (h: HorarioCalendarItem) => {
    const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
    return docentesUnicos.find(d => d.docenteId === docId);
  };

  // ── Extraer ciclo para verificar ──
  const esCicloI = useMemo(() => {
    const cStr = String(ciclo).toUpperCase().trim();
    return cStr === 'I' || cStr === '1';
  }, [ciclo]);

  // ── Mapa de celdas "consumidas" por rowspan ──
  const consumed = useMemo(() => {
    const map = new Set<string>();
    for (const h of horarios) {
      if (!h.horaInicio || !h.horaFin || !h.diaSemana) continue;
      const span = calcRowspan(h.horaInicio, h.horaFin);
      const startHour = parseInt(h.horaInicio);
      for (let offset = 1; offset < span; offset++) {
        const nextHour = startHour + offset;
        const nextIni = `${String(nextHour).padStart(2, '0')}:00`;
        map.add(`${h.diaSemana}-${nextIni}`);
      }
    }

    if (esCicloI) {
      const horasMiercoles = [
        '08:00', '09:00', '10:00', '11:00', '12:00',
        '15:00', '16:00', '17:00'
      ];
      horasMiercoles.forEach(h => map.add(`MIERCOLES-${h}`));
    }

    return map;
  }, [horarios, esCicloI]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
        <div style={{ height: 400, background: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Cargando horario…
        </div>
      </div>
    );
  }

  // ── Sin horarios ──
  if (horarios.length === 0) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 16, textAlign: 'center', color: '#888' }}>
        No hay bloques en el calendario para este período.
      </div>
    );
  }

  // ── Helpers para el render de la grilla ──
  const formatAmbiente = (name: string) => {
    if (!name) return '';
    if (name.toLowerCase().includes('posgrado')) {
      return `(${name.toLowerCase()})`;
    }
    // Dividir en dos líneas en el guión
    return name.replace(/\s*-\s*/, '\n');
  };

  const getComponentLabel = (h: HorarioCalendarItem) => {
    if (h.tipoComponente === 'PRACTICA') return ' Práctica';
    if (h.tipoComponente === 'TEORIA' && h.curso.codigo === 'EG-106B') return ' Teoría';
    return '';
  };

  // ── RENDER ──
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10 }}>

      {/* ── TABLA SUPERIOR — Información institucional + leyenda docentes ── */}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 6 }}>
        <thead>
          <tr>
            <th colSpan={2} style={{ ...th, width: '30%' }}>DATOS INSTITUCIONALES</th>
            <th style={{ ...th, width: 30 }}>N°</th>
            <th style={{ ...th, textAlign: 'left' }}>PROFESOR</th>
            <th style={{ ...th, textAlign: 'left' }}>ASIGNATURA</th>
            <th style={{ ...th, width: 28 }}>T</th>
            <th style={{ ...th, width: 28 }}>P</th>
            <th style={{ ...th, width: 28 }}>L</th>
            <th style={{ ...th, width: 28 }}>G</th>
            <th style={{ ...th, width: 40 }}>T.HORAS</th>
            <th style={{ ...th, textAlign: 'left' }}>DEPARTAMENTO</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(13, docentesUnicos.length) }, (_, i) => {
            const doc = docentesUnicos[i];
            return (
              <tr key={i}>
                {/* Columna izquierda institucional */}
                {i === 0 && (
                  <td rowSpan={3} colSpan={2} style={{ ...celdaInst, fontWeight: 'bold', fontSize: 11, verticalAlign: 'top' }}>
                    Universidad Nacional de Trujillo<br />
                    Facultad de Ingeniería<br />
                    Trujillo
                  </td>
                )}
                {i === 3 && (
                  <td colSpan={2} style={celdaInst}>
                    ESCUELA:{' '}
                    <span style={{ color: '#0070c0', fontWeight: 'bold' }}>
                      INGENIERÍA DE SISTEMAS
                    </span>
                  </td>
                )}
                {i === 4 && (
                  <td colSpan={2} style={{ border: 'none' }} />
                )}
                {i === 5 && (
                  <td colSpan={2} style={celdaInst}>
                    CICLO: <span style={azul}>{ciclo}</span>&nbsp;&nbsp;
                    SECCIÓN: <span style={azul}>{seccion}</span>
                  </td>
                )}
                {i === 6 && (
                  <td colSpan={2} style={{ border: 'none' }} />
                )}
                {i === 7 && (
                  <td colSpan={2} style={celdaInst}>
                    AÑO ACADÉMICO: <span style={azul}>{anio}</span>&nbsp;
                    SEMESTRE: <span style={{ fontWeight: 'bold' }}>{semestre}</span>
                  </td>
                )}
                {i === 8 && (
                  <td colSpan={2} style={{ border: 'none' }} />
                )}
                {i === 9 && (
                  <td colSpan={2} style={celdaInst}>
                    Inicio del Ciclo: <span style={rojo}>{fechaInicio}</span>
                  </td>
                )}
                {i === 10 && (
                  <td colSpan={2} style={celdaInst}>
                    Término del Ciclo: <span style={rojo}>{fechaFin}</span>
                  </td>
                )}
                {![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(i) && (
                  <td colSpan={2} style={{ border: 'none' }} />
                )}

                {/* Columna derecha — datos del docente */}
                <td style={{ ...celda, textAlign: 'center' }}>{doc ? doc.numero : ''}</td>
                <td style={{ ...celda, textAlign: 'left', backgroundColor: doc?.color ?? 'transparent' }}>
                  {doc?.nombre ?? ''}
                </td>
                <td style={{ ...celda, textAlign: 'left', backgroundColor: doc?.color ?? 'transparent' }}>
                  {doc?.asignatura ?? ''}
                </td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: doc?.color ?? 'transparent' }}>{doc ? (doc.horasT || '') : ''}</td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: doc?.color ?? 'transparent' }}>{doc ? (doc.horasP || '') : ''}</td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: doc?.color ?? 'transparent' }}>{doc ? (doc.horasL || '') : ''}</td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: doc?.color ?? 'transparent' }}>{doc ? (doc.grupos || '') : ''}</td>
                <td style={{ ...celda, textAlign: 'center', fontWeight: 'bold', backgroundColor: doc?.color ?? 'transparent' }}>
                  {doc ? (doc.totalHoras || '') : ''}
                </td>
                <td style={{ ...celda, textAlign: 'left', backgroundColor: doc?.color ?? 'transparent' }}>
                  {doc?.departamento ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── TABLA INFERIOR — GRILLA SEMANAL ── */}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'HORA']
              .map((d, idx) => <th key={`${d}-${idx}`} style={th}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {FRANJAS.map(({ ini, label }) => (
            <tr key={ini}>
              {/* Celda hora izquierda */}
              <td style={horaCol}>{label}</td>

              {/* Celdas por día */}
              {DIAS_GRILLA.map(dia => {
                // Celda ya consumida por un rowspan anterior → omitir
                if (consumed.has(`${dia}-${ini}`)) return null;

                // Bloque especial Miércoles Ciclo I
                if (dia === 'MIERCOLES' && esCicloI) {
                  if (ini === '07:00') {
                    return (
                      <td key={dia} rowSpan={6}
                        style={{
                          ...celda,
                          background: '#bdd7ee',
                          fontWeight: 'bold',
                          fontSize: 11,
                          verticalAlign: 'middle',
                        }}>
                        ESTUDIOS<br />GENERALES
                      </td>
                    );
                  }
                  if (ini === '14:00') {
                    return (
                      <td key={dia} rowSpan={4}
                        style={{
                          ...celda,
                          background: '#bdd7ee',
                          fontWeight: 'bold',
                          fontSize: 11,
                          verticalAlign: 'middle',
                        }}>
                        ESTUDIOS<br />GENERALES
                      </td>
                    );
                  }
                }

                // Buscar si hay sesión que empieza en esta franja/día
                const sesion = horarios.find(x => x.diaSemana === dia && x.horaInicio === ini);
                if (!sesion) {
                  return <td key={dia} style={celda} />;
                }

                const docente = getDocente(sesion);
                const span = calcRowspan(sesion.horaInicio, sesion.horaFin);
                const labelComp = getComponentLabel(sesion);
                const ambNombre = sesion.ambiente?.nombre ?? sesion.ambiente?.codigo ?? '';
                const ambLines = formatAmbiente(ambNombre).split('\n');

                return (
                  <td
                    key={dia}
                    rowSpan={span}
                    style={{
                      ...celda,
                      backgroundColor: docente?.color ?? '#fff',
                      verticalAlign: 'middle',
                      padding: '4px 2px',
                    }}
                  >
                    {/* Número grande del docente */}
                    <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                      {docente?.numero ?? ''}
                    </span>
                    {/* Etiqueta de componente (Práctica / Teoría) */}
                    {labelComp && (
                      <span style={{ fontSize: 10, fontWeight: 'normal' }}>{labelComp}</span>
                    )}
                    {/* Nombre del ambiente en línea(s) más pequeña */}
                    <div style={{ fontSize: 9, marginTop: 2 }}>
                      {ambLines.map((line, li) => (
                        <span key={li}>{line}{li < ambLines.length - 1 && <br />}</span>
                      ))}
                    </div>
                  </td>
                );
              })}

              {/* Celda hora derecha */}
              <td style={horaCol}>{label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
