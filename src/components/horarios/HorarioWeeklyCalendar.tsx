'use client';

import { useMemo } from 'react';

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

interface HorarioWeeklyCalendarProps {
  horarios: HorarioCalendarItem[];
  dias: readonly string[];
  diaLabels: Record<string, string>;
  horas: number[];
  loading?: boolean;
  ciclo?: string | number;
  seccion?: string;
  anio?: string | number;
  semestre?: string | number;
  fechaInicio?: string;
  fechaFin?: string;
}

const COLORES = [
  '#c6efce', '#ffc7ce', '#bdd7ee', '#e2efda',
  '#ffff00', '#92d050', '#dce6f1', '#e4dfec',
  '#fce4d6', '#d9d9d9', '#fff2cc', '#ddebf7', '#f8cbad',
];

type DiaSemanaKey = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';
const DIAS_GRILLA: DiaSemanaKey[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const FRANJAS = [
  { ini: '07:00', label: '7-8' },
  { ini: '08:00', label: '8-9' },
  { ini: '09:00', label: '9-10' },
  { ini: '10:00', label: '10-11' },
  { ini: '11:00', label: '11-12' },
  { ini: '12:00', label: '12-1' },
  { ini: '13:00', label: '1-2' },
  { ini: '14:00', label: '2-3' },
  { ini: '15:00', label: '3-4' },
  { ini: '16:00', label: '4-5' },
  { ini: '17:00', label: '5-6' },
  { ini: '18:00', label: '6-7' },
  { ini: '19:00', label: '7-8' },
];

const normalizeTime = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
};

const calcRowspan = (ini: string, fin: string) => {
  const h1 = parseInt(ini.split(':')[0]);
  const h2 = parseInt(fin.split(':')[0]);
  return Math.max(h2 - h1, 1);
};

// ── Estilos base ──
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
};
const horaCol: React.CSSProperties = {
  ...celda,
  background: '#f2f2f2',
  fontWeight: 'bold',
  width: 38,
};
const th: React.CSSProperties = {
  ...celda,
  background: '#1a365d',
  color: '#fff',
  fontWeight: 'bold',
  padding: '4px 6px',
};
const azul: React.CSSProperties = { color: '#0070c0', fontWeight: 'bold' };
const rojo: React.CSSProperties = { color: '#c00000', fontWeight: 'bold' };

const SEPARATOR_STYLE: React.CSSProperties = {
  borderTop: '3px solid #000',
};

export function HorarioWeeklyCalendar({
  horarios,
  loading,
  ciclo = '',
  seccion = '',
  anio = '',
  semestre = '',
  fechaInicio = '',
  fechaFin = '',
}: HorarioWeeklyCalendarProps) {

  const normalizedHorarios = useMemo(() => {
    return horarios.map(h => ({
      ...h,
      horaInicio: normalizeTime(h.horaInicio),
      horaFin: normalizeTime(h.horaFin)
    }));
  }, [horarios]);

  const docentesUnicos = useMemo(() => {
    const seen = new Map<string, any>();
    for (const h of normalizedHorarios) {
      const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
      const key = `${docId}||${h.curso.codigo}`;
      if (!seen.has(key)) {
        seen.set(key, {
          docenteId: docId,
          nombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`,
          asignatura: h.curso.nombre,
          cursoCodigo: h.curso.codigo || '',
          horasT: h.curso.horasTeoria ?? 0,
          horasP: h.curso.horasPractica ?? 0,
          horasL: h.curso.horasLaboratorio ?? 0,
          grupos: new Set(
            normalizedHorarios.filter(x => {
              const xDocId = x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`;
              return xDocId === docId && x.curso.codigo === h.curso.codigo;
            }).map(x => x.grupo?.nombre ?? 'A')
          ).size,
          totalHoras: (h.curso.horasTeoria ?? 0) + (h.curso.horasPractica ?? 0) + (h.curso.horasLaboratorio ?? 0),
          departamento: h.docente.departamento ?? '',
        });
      }
    }

    const list = Array.from(seen.values());
    list.sort((a, b) => {
      const p = (c: string) => c.startsWith('IS-') ? 1 : c.startsWith('EG-') ? 2 : 3;
      if (p(a.cursoCodigo) !== p(b.cursoCodigo)) return p(a.cursoCodigo) - p(b.cursoCodigo);
      return a.cursoCodigo.localeCompare(b.cursoCodigo);
    });
    list.forEach((doc, idx) => {
      doc.numero = idx + 1;
      doc.color = COLORES[idx % COLORES.length];
    });
    return list;
  }, [normalizedHorarios]);

  const getDocente = (h: HorarioCalendarItem) => {
    const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
    const key = `${docId}||${h.curso.codigo}`;
    return docentesUnicos.find(d => (d.docenteId + '||' + d.cursoCodigo) === key);
  };

  const esCicloI = useMemo(() => {
    const c = String(ciclo).toUpperCase().trim();
    return c === 'I' || c === '1';
  }, [ciclo]);

  const consumed = useMemo(() => {
    const map = new Set<string>();
    for (const h of normalizedHorarios) {
      if (!h.horaInicio || !h.horaFin) continue;
      const span = calcRowspan(h.horaInicio, h.horaFin);
      const startH = parseInt(h.horaInicio);
      for (let o = 1; o < span; o++) {
        const nextIni = `${String(startH + o).padStart(2, '0')}:00`;
        map.add(`${h.diaSemana}-${nextIni}-${h.id}`);
      }
    }
    if (esCicloI) {
      [
        '08:00',
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
        '19:00'
      ].forEach(h => map.add(`MIERCOLES-${h}-ESTUDIOS`));
    }
    return map;
  }, [normalizedHorarios, esCicloI]);

  const formatAmbiente = (name: string) => {
    if (!name) return '';
    if (name.toLowerCase().includes('posgrado')) return `(${name.toLowerCase()})`;
    return name.replace(/\s*-\s*/, '\n');
  };

  const getComponentLabel = (h: HorarioCalendarItem) => {
    if (h.tipoComponente === 'PRACTICA') return ' Práctica';
    if (h.tipoComponente === 'TEORIA' && h.curso.codigo === 'EG-106B') return ' Teoría';
    if (h.tipoComponente === 'LABORATORIO') return ' Lab.';
    return '';
  };

  if (loading) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
        <div style={{ height: 400, background: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Cargando horario…
        </div>
      </div>
    );
  }

  if (normalizedHorarios.length === 0) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 16, textAlign: 'center', color: '#888' }}>
        No hay bloques en el calendario para este período.
      </div>
    );
  }

  const totalFilas = Math.max(13, docentesUnicos.length);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 10 }}>

      {/* ── TABLA SUPERIOR ── */}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 6 }}>
        <thead>
          <tr>
            <th colSpan={2} style={{ ...th, width: '30%', textAlign: 'center' }}>
              DATOS INSTITUCIONALES
            </th>
            <th style={{ ...th, width: 28, textAlign: 'center' }}>N°</th>
            <th style={{ ...th, textAlign: 'left' }}>DOCENTE</th>
            <th style={{ ...th, textAlign: 'left' }}>ASIGNATURA</th>
            <th style={{ ...th, width: 24, textAlign: 'center' }}>T</th>
            <th style={{ ...th, width: 24, textAlign: 'center' }}>P</th>
            <th style={{ ...th, width: 24, textAlign: 'center' }}>L</th>
            <th style={{ ...th, width: 24, textAlign: 'center' }}>G</th>
            <th style={{ ...th, width: 44, textAlign: 'center' }}>T. HORAS</th>
            <th style={{ ...th, textAlign: 'left' }}>DEPARTAMENTO</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: totalFilas }, (_, i) => {
            const doc = docentesUnicos[i];
            const bg = doc?.color ?? 'transparent';

            return (
              <tr key={i}>
                {/* ── Columna izquierda institucional ── */}
                {i === 0 && (
                  <td
                    rowSpan={3}
                    colSpan={2}
                    style={{
                      ...celda,
                      fontWeight: 'bold',
                      fontSize: 11,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    Universidad Nacional de Trujillo<br />
                    Facultad de Ingeniería<br />
                    Trujillo
                  </td>
                )}
                {i === 3 && (
                  <td colSpan={2} style={celdaInst}>
                    ESCUELA: <span style={azul}>INGENIERÍA DE SISTEMAS</span>
                  </td>
                )}
                {i === 4 && <td colSpan={2} style={{ border: 'none' }} />}
                {i === 5 && (
                  <td colSpan={2} style={celdaInst}>
                    CICLO: <span style={azul}>{ciclo}</span>
                    &nbsp;&nbsp;&nbsp;
                    SECCIÓN: <span style={azul}>{seccion}</span>
                  </td>
                )}
                {i === 6 && <td colSpan={2} style={{ border: 'none' }} />}
                {i === 7 && (
                  <td colSpan={2} style={celdaInst}>
                    AÑO ACADÉMICO: <span style={azul}>{anio}</span>
                    &nbsp;&nbsp;
                    SEMESTRE: <span style={{ fontWeight: 'bold' }}>{semestre}</span>
                  </td>
                )}
                {i === 8 && <td colSpan={2} style={{ border: 'none' }} />}
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

                {/* ── Columna N° ── */}
                <td style={{ ...celda, textAlign: 'center', fontWeight: 'bold' }}>
                  {doc ? doc.numero : ''}
                </td>

                {/* ── DOCENTE ── */}
                <td style={{ ...celda, textAlign: 'left', backgroundColor: bg }}>
                  {doc?.nombre ?? ''}
                </td>

                {/* ── ASIGNATURA ── */}
                <td style={{ ...celda, textAlign: 'left', backgroundColor: bg }}>
                  {doc?.asignatura ?? ''}
                </td>

                {/* ── T P L G T.HORAS ── */}
                <td style={{ ...celda, textAlign: 'center', backgroundColor: bg }}>
                  {doc ? (doc.horasT || '') : ''}
                </td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: bg }}>
                  {doc ? (doc.horasP || '') : ''}
                </td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: bg }}>
                  {doc ? (doc.horasL || '') : ''}
                </td>
                <td style={{ ...celda, textAlign: 'center', backgroundColor: bg }}>
                  {doc ? (doc.grupos || '') : ''}
                </td>
                <td style={{ ...celda, textAlign: 'center', fontWeight: 'bold', backgroundColor: bg }}>
                  {doc ? (doc.totalHoras || '') : ''}
                </td>

                {/* ── DEPARTAMENTO ── */}
                <td style={{ ...celda, textAlign: 'left', backgroundColor: bg }}>
                  {doc?.departamento ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── TABLA GRILLA SEMANAL ── */}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'HORA'].map(
              (d, idx) => <th key={idx} style={th}>{d}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {FRANJAS.map(({ ini, label }, franjaIdx) => {
            // Separador entre mañana y tarde
            const esPrimeroTarde = ini === '13:00';
            const trStyle: React.CSSProperties = esPrimeroTarde ? SEPARATOR_STYLE : {};

            return (
              <tr key={ini} style={trStyle}>
                {/* ── Columna hora izquierda ── */}
                <td style={{
                  ...horaCol,
                  borderTop: esPrimeroTarde ? '3px solid #000' : '1px solid #000',
                }}>
                  {label}
                </td>

                {DIAS_GRILLA.map(dia => {
                  // ── Miércoles Ciclo I ──
                  if (dia === 'MIERCOLES' && esCicloI) {
                    if (consumed.has(`MIERCOLES-${ini}-ESTUDIOS`)) return null;
                    if (ini === '07:00') {
                      return (
                        <td
                          key={dia}
                          rowSpan={6}
                          style={{
                            ...celda,
                            background: '#bdd7ee',
                            fontWeight: 'bold',
                            fontSize: 11,
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          ESTUDIOS<br />
                          GENERALES
                        </td>
                      );
                    }
                    if (ini === '13:00') {
                      return (
                        <td
                          key={dia}
                          rowSpan={7}
                          style={{
                            ...celda,
                            background: '#bdd7ee',
                            fontWeight: 'bold',
                            fontSize: 11,
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          ESTUDIOS<br />
                          GENERALES
                        </td>
                      );
                    }
                  }

                  // ── Verificar rowspan ──
                  const cubiertoPorRowspan = normalizedHorarios.some(x => {
                    if (x.diaSemana !== dia || x.horaInicio === ini) return false;
                    const startH = parseInt(x.horaInicio);
                    const endH = parseInt(x.horaFin ?? x.horaInicio);
                    const iniH = parseInt(ini);
                    return iniH > startH && iniH < endH;
                  });
                  if (cubiertoPorRowspan) return null;

                  // ── Buscar bloques ──
                  const bloques = normalizedHorarios.filter(x =>
                    x.diaSemana === dia &&
                    x.horaInicio === ini &&
                    !consumed.has(`${dia}-${ini}-${x.id}`)
                  );

                  // ── Celda vacía ──
                  if (bloques.length === 0) {
                    return (
                      <td
                        key={dia}
                        style={{
                          ...celda,
                          borderTop: esPrimeroTarde ? '3px solid #000' : '1px solid #000',
                        }}
                      />
                    );
                  }

                  // ── Un solo bloque ──
                  if (bloques.length === 1) {
                    const h = bloques[0];
                    const doc = getDocente(h);
                    const span = calcRowspan(h.horaInicio, h.horaFin);
                    const labelComp = getComponentLabel(h);
                    const ambNombre = h.ambiente?.nombre ?? h.ambiente?.codigo ?? '';
                    const ambLines = formatAmbiente(ambNombre).split('\n');
                    const nombreCorto = doc?.asignatura
                      ? doc.asignatura.split(' ').slice(0, 4).join(' ')
                      : '';

                    return (
                      <td
                        key={dia}
                        rowSpan={span}
                        style={{
                          ...celda,
                          backgroundColor: doc?.color ?? '#fff',
                          verticalAlign: 'middle',
                          padding: '3px 2px',
                          borderTop: esPrimeroTarde ? '3px solid #000' : '1px solid #000',
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 'bold', lineHeight: 1 }}>
                          {doc?.numero ?? ''}
                        </div>
                        {labelComp && (
                          <div style={{ fontSize: 8, fontWeight: 'normal', marginTop: 1 }}>
                            {labelComp}
                          </div>
                        )}
                        <div style={{ fontSize: 8, marginTop: 2, fontStyle: 'italic', lineHeight: 1.2 }}>
                          {nombreCorto}
                        </div>
                        <div style={{ fontSize: 8, marginTop: 2, lineHeight: 1.2 }}>
                          {ambLines.map((line, li) => (
                            <span key={li}>
                              {line}
                              {li < ambLines.length - 1 && <br />}
                            </span>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // ── Múltiples bloques ──
                  const minSpan = Math.min(...bloques.map(h => calcRowspan(h.horaInicio, h.horaFin)));

                  return (
                    <td
                      key={dia}
                      rowSpan={minSpan}
                      style={{
                        ...celda,
                        padding: 0,
                        verticalAlign: 'middle',
                        borderTop: esPrimeroTarde ? '3px solid #000' : '1px solid #000',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%' }}>
                        {bloques.map((h, idx) => {
                          const doc = getDocente(h);
                          const labelComp = getComponentLabel(h);
                          const ambNombre = h.ambiente?.nombre ?? h.ambiente?.codigo ?? '';
                          const ambLines = formatAmbiente(ambNombre).split('\n');
                          const nombreCorto = doc?.asignatura
                            ? doc.asignatura.split(' ').slice(0, 3).join(' ')
                            : '';

                          return (
                            <div
                              key={h.id}
                              style={{
                                flex: 1,
                                backgroundColor: doc?.color ?? '#fff',
                                borderLeft: idx > 0 ? '1px solid #000' : 'none',
                                textAlign: 'center',
                                padding: '2px 1px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 'bold', lineHeight: 1 }}>
                                {doc?.numero ?? ''}
                              </span>
                              {labelComp && (
                                <span style={{ fontSize: 7, fontWeight: 'normal' }}>
                                  {labelComp}
                                </span>
                              )}
                              <div style={{ fontSize: 7, marginTop: 1, fontStyle: 'italic', lineHeight: 1.2 }}>
                                {nombreCorto}
                              </div>
                              <div style={{ fontSize: 7, marginTop: 1, lineHeight: 1.2 }}>
                                {ambLines.map((line, li) => (
                                  <span key={li}>
                                    {line}
                                    {li < ambLines.length - 1 && <br />}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}

                {/* ── Columna hora derecha ── */}
                <td style={{
                  ...horaCol,
                  borderTop: esPrimeroTarde ? '3px solid #000' : '1px solid #000',
                }}>
                  {label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}