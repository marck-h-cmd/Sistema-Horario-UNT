const COLORES = [
  '#c6efce', '#ffc7ce', '#bdd7ee', '#e2efda',
  '#ffff00', '#92d050', '#dce6f1', '#e4dfec',
  '#fce4d6', '#d9d9d9', '#fff2cc', '#ddebf7', '#f8cbad',
];

const DIAS_GRILLA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

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

const calcSpan = (ini: string, fin: string) => {
  const h1 = parseInt(ini);
  const h2 = parseInt(fin);
  return Math.max(h2 - h1, 1);
};

const formatAmbiente = (name: string): string => {
  if (!name) return '';
  if (name.toLowerCase().includes('posgrado')) return `(${name.toLowerCase()})`;
  return name.replace(/\s*-\s*/, '<br/>');
};

const getComponentLabel = (h: any): string => {
  if (h.tipoComponente === 'PRACTICA') return ' Práctica';
  if (h.tipoComponente === 'TEORIA' && h.curso?.codigo === 'EG-106B') return ' Teoría';
  if (h.tipoComponente === 'LABORATORIO') return ' Lab.';
  return '';
};

export async function exportarHorarioPDF(
  horarios: any[],
  titulo: string,
  subtitulo: string
): Promise<void> {

  const normalizedHorarios = horarios.map(h => ({
    ...h,
    horaInicio: normalizeTime(h.horaInicio),
    horaFin: normalizeTime(h.horaFin)
  }));

  // ── 1. Deduplicar docentes ──
  const seenDocs = new Map<string, any>();
  for (const h of normalizedHorarios) {
    const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
    if (!seenDocs.has(docId)) {
      const totalHoras = normalizedHorarios
        .filter(x => (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId)
        .reduce((sum, x) => {
          if (!x.horaInicio || !x.horaFin) return sum;
          return sum + Math.max(parseInt(x.horaFin) - parseInt(x.horaInicio), 0);
        }, 0);

      seenDocs.set(docId, {
        nombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`,
        asignatura: h.curso.nombre,
        cursoCodigo: h.curso.codigo || '',
        horasT: h.curso.horasTeoria ?? 0,
        horasP: h.curso.horasPractica ?? 0,
        horasL: h.curso.horasLaboratorio ?? 0,
        grupos: normalizedHorarios.filter(x =>
          (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId
        ).length,
        totalHoras,
        departamento: h.docente.departamento ?? '',
        docId,
      });
    }
  }

  const docentesUnicos = Array.from(seenDocs.values());
  docentesUnicos.sort((a, b) => {
    const p = (c: string) => c.startsWith('IS-') ? 1 : c.startsWith('EG-') ? 2 : 3;
    if (p(a.cursoCodigo) !== p(b.cursoCodigo)) return p(a.cursoCodigo) - p(b.cursoCodigo);
    return a.cursoCodigo.localeCompare(b.cursoCodigo);
  });
  docentesUnicos.forEach((doc, idx) => {
    doc.numero = idx + 1;
    doc.color = COLORES[idx % COLORES.length];
    seenDocs.set(doc.docId, doc);
  });

  // ── 2. Mapa consumed ──
  const consumed = new Set<string>();
  for (const h of normalizedHorarios) {
    if (!h.horaInicio || !h.horaFin) continue;
    const span = calcSpan(h.horaInicio, h.horaFin);
    const startH = parseInt(h.horaInicio);
    for (let o = 1; o < span; o++) {
      const nextIni = `${String(startH + o).padStart(2, '0')}:00`;
      consumed.add(`${h.diaSemana}-${nextIni}-${h.id}`);
    }
  }

  // ── 3. Detectar ciclo ──
  const cicloMatch = subtitulo.match(/Ciclo\s+([IVX]+|\d+)/i);
  const ciclo = cicloMatch?.[1] ?? '';
  const esCicloI = ciclo === 'I' || ciclo === '1';

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
    ].forEach(h => consumed.add(`MIERCOLES-${h}-ESTUDIOS`));
  }

  // ── 4. Estilos base ──
  const thStyle = `
    border:1px solid #000;
    padding:4px 6px;
    font-size:10px;
    background:#1a1a2e;
    color:#fff;
    font-weight:bold;
    text-align:center;
  `;
  const horaStyle = `
    border:1px solid #000;
    padding:2px 4px;
    font-size:10px;
    background:#f2f2f2;
    font-weight:bold;
    text-align:center;
    width:38px;
  `;
  const celdaBase = `border:1px solid #000;padding:2px 4px;font-size:10px;`;

  // ── 5. Tabla superior ──
  const totalFilas = Math.max(13, docentesUnicos.length);

  const filas = Array.from({ length: totalFilas }, (_, i) => {
    const doc = docentesUnicos[i];
    const bg = doc?.color ?? 'transparent';

    const tdDoc = (v: any, extra = '') =>
      `<td style="${celdaBase}text-align:left;background:${bg};${extra}">${v ?? ''}</td>`;
    const tdCenter = (v: any) =>
      `<td style="${celdaBase}text-align:center;background:${bg}">${v ?? ''}</td>`;

    let leftCell = '';
    if (i === 0) {
      leftCell = `
        <td rowspan="3" colspan="2" style="${celdaBase}font-size:11px;font-weight:bold;text-align:center;vertical-align:middle">
          Universidad Nacional de Trujillo<br/>
          Facultad de Ingeniería<br/>
          Trujillo
        </td>`;
    } else if (i === 3) {
      leftCell = `<td colspan="2" style="${celdaBase}text-align:left">ESCUELA: <span style="color:#0070c0;font-weight:bold">INGENIERÍA DE SISTEMAS</span></td>`;
    } else if (i === 4) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 5) {
      leftCell = `<td colspan="2" style="${celdaBase}text-align:left">CICLO: <span style="color:#0070c0;font-weight:bold">${ciclo}</span>&nbsp;&nbsp;&nbsp;SECCIÓN: <span style="color:#0070c0;font-weight:bold">A</span></td>`;
    } else if (i === 6) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 7) {
      leftCell = `<td colspan="2" style="${celdaBase}text-align:left">AÑO ACADÉMICO: <span style="color:#0070c0;font-weight:bold">${new Date().getFullYear()}</span>&nbsp;&nbsp;SEMESTRE: <span style="font-weight:bold">I</span></td>`;
    } else if (i === 8) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 9) {
      leftCell = `<td colspan="2" style="${celdaBase}text-align:left">Inicio del Ciclo: <span style="color:#c00000;font-weight:bold">13-04-2026</span></td>`;
    } else if (i === 10) {
      leftCell = `<td colspan="2" style="${celdaBase}text-align:left">Término del Ciclo: <span style="color:#c00000;font-weight:bold">08-08-2026</span></td>`;
    } else if (![1, 2].includes(i)) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    }

    return `<tr>
      ${leftCell}
      <td style="${celdaBase}text-align:center;font-weight:bold">${doc ? doc.numero : ''}</td>
      ${tdDoc(doc?.nombre)}
      ${tdDoc(doc?.asignatura)}
      ${tdCenter(doc?.horasT ?? '')}
      ${tdCenter(doc?.horasP ?? '')}
      ${tdCenter(doc?.horasL ?? '')}
      ${tdCenter(doc?.grupos ?? '')}
      <td style="${celdaBase}text-align:center;font-weight:bold;background:${bg}">${doc?.totalHoras ?? ''}</td>
      ${tdDoc(doc?.departamento)}
    </tr>`;
  }).join('');

  // ── 6. Grilla semanal ──
  const grillaFilas = FRANJAS.map(({ ini, label }) => {
    const esPrimeroTarde = ini === '13:00';
    const borderTopExtra = esPrimeroTarde ? 'border-top:3px solid #000;' : '';
    const horaStyleExtra = `${horaStyle}${borderTopExtra}`;

    const celdas = DIAS_GRILLA.map(dia => {

      // ── Miércoles Ciclo I ──
      if (dia === 'MIERCOLES' && esCicloI) {
        if (consumed.has(`MIERCOLES-${ini}-ESTUDIOS`)) return '';

        // 07:00 - 13:00
        if (ini === '07:00') {
          return `
      <td rowspan="6"
          style="${celdaBase}background:#bdd7ee;
          text-align:center;
          vertical-align:middle;
          font-size:11px;
          font-weight:bold">
        ESTUDIOS<br/>GENERALES
      </td>`;
        }

        // 13:00 - 20:00
        if (ini === '13:00') {
          return `
      <td rowspan="7"
          style="${celdaBase}background:#bdd7ee;
          text-align:center;
          vertical-align:middle;
          font-size:11px;
          font-weight:bold">
        ESTUDIOS<br/>GENERALES
      </td>`;
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
      if (cubiertoPorRowspan) return '';

      // ── Buscar bloques ──
      const bloques = normalizedHorarios.filter(x =>
        x.diaSemana === dia &&
        x.horaInicio === ini &&
        !consumed.has(`${dia}-${ini}-${x.id}`)
      );

      // ── Celda vacía ──
      if (bloques.length === 0) {
        return `<td style="${celdaBase}${borderTopExtra}"></td>`;
      }

      // ── Un solo bloque ──
      if (bloques.length === 1) {
        const h = bloques[0];
        const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
        const doc = seenDocs.get(docId);
        const span = calcSpan(h.horaInicio, h.horaFin);
        const labelComp = getComponentLabel(h);
        const ambText = formatAmbiente(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '');
        const nombreCorto = doc?.asignatura
          ? doc.asignatura.split(' ').slice(0, 4).join(' ')
          : '';

        return `
          <td rowspan="${span}" style="${celdaBase}${borderTopExtra}background:${doc?.color ?? '#fff'};text-align:center;vertical-align:middle;padding:3px 2px;">
            <strong style="font-size:15px;line-height:1">${doc?.numero ?? ''}</strong>
            ${labelComp ? `<span style="font-size:9px;font-weight:normal;display:block">${labelComp}</span>` : ''}
            <div style="font-size:8px;margin-top:2px;font-style:italic;line-height:1.2">${nombreCorto}</div>
            <div style="font-size:8px;margin-top:2px;line-height:1.2">${ambText}</div>
          </td>`;
      }

      // ── Múltiples bloques ──
      const minSpan = Math.min(...bloques.map(h => calcSpan(h.horaInicio, h.horaFin)));
      const innerCols = bloques.map((h, idx) => {
        const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`;
        const doc = seenDocs.get(docId);
        const labelComp = getComponentLabel(h);
        const ambText = formatAmbiente(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '');
        const nombreCorto = doc?.asignatura
          ? doc.asignatura.split(' ').slice(0, 3).join(' ')
          : '';

        return `
          <div style="
            flex:1;
            background:${doc?.color ?? '#fff'};
            ${idx > 0 ? 'border-left:1px solid #000;' : ''}
            text-align:center;
            padding:2px 1px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
          ">
            <strong style="font-size:13px;line-height:1">${doc?.numero ?? ''}</strong>
            ${labelComp ? `<span style="font-size:7px;font-weight:normal">${labelComp}</span>` : ''}
            <div style="font-size:7px;margin-top:1px;font-style:italic;line-height:1.2">${nombreCorto}</div>
            <div style="font-size:7px;margin-top:1px;line-height:1.2">${ambText}</div>
          </div>`;
      }).join('');

      return `
        <td rowspan="${minSpan}" style="${celdaBase}${borderTopExtra}padding:0;vertical-align:middle;">
          <div style="display:flex;flex-direction:row;width:100%;height:100%">
            ${innerCols}
          </div>
        </td>`;

    }).join('');

    return `<tr>
      <td style="${horaStyleExtra}">${label}</td>
      ${celdas}
      <td style="${horaStyleExtra}">${label}</td>
    </tr>`;
  }).join('');

  // ── 7. HTML completo ──
  const htmlCompleto = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${titulo}</title>
  <style>
    body {
      margin: 8mm;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
  </style>
</head>
<body>
  <table style="border-collapse:collapse;width:100%;margin-bottom:6px">
    <thead>
      <tr>
        <th colspan="2" style="${thStyle}width:30%;text-align:center">DATOS INSTITUCIONALES</th>
        <th style="${thStyle}width:28px">N°</th>
        <th style="${thStyle}text-align:left">DOCENTE</th>
        <th style="${thStyle}text-align:left">ASIGNATURA</th>
        <th style="${thStyle}width:24px">T</th>
        <th style="${thStyle}width:24px">P</th>
        <th style="${thStyle}width:24px">L</th>
        <th style="${thStyle}width:24px">G</th>
        <th style="${thStyle}width:44px">T. HORAS</th>
        <th style="${thStyle}text-align:left">DEPARTAMENTO</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <table style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th style="${thStyle}width:38px">HORA</th>
        <th style="${thStyle}">LUNES</th>
        <th style="${thStyle}">MARTES</th>
        <th style="${thStyle}">MIÉRCOLES</th>
        <th style="${thStyle}">JUEVES</th>
        <th style="${thStyle}">VIERNES</th>
        <th style="${thStyle}">SÁBADO</th>
        <th style="${thStyle}width:38px">HORA</th>
      </tr>
    </thead>
    <tbody>${grillaFilas}</tbody>
  </table>
</body>
</html>`;

  // ── 8. Abrir ventana e imprimir ──
  const win = window.open('', '_blank');
  if (!win) {
    alert('Permite ventanas emergentes para exportar PDF');
    return;
  }
  win.document.write(htmlCompleto);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}