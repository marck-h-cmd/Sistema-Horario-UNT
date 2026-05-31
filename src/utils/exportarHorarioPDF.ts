const COLORES = [
  '#c6efce','#ffc7ce','#bdd7ee','#e2efda',
  '#ffff00','#92d050','#dce6f1','#e4dfec',
  '#fce4d6','#d9d9d9','#fff2cc','#ddebf7','#f8cbad'
]

const DIAS_GRILLA = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO']

const FRANJAS = [
  {ini:'07:00',label:'7-8'},{ini:'08:00',label:'8-9'},
  {ini:'09:00',label:'9-10'},{ini:'10:00',label:'10-11'},
  {ini:'11:00',label:'11-12'},{ini:'12:00',label:'12-1'},
  {ini:'13:00',label:'1-2'},{ini:'14:00',label:'2-3'},
  {ini:'15:00',label:'3-4'},{ini:'16:00',label:'4-5'},
  {ini:'17:00',label:'5-6'},{ini:'18:00',label:'6-7'},
  {ini:'19:00',label:'7-8p'},
]

export async function exportarHorarioPDF(
  horarios: any[],
  titulo: string,
  subtitulo: string
) {
  // 1. Deduplicar docentes por docenteId
  const seenDocs = new Map<string, any>()
  for (const h of horarios) {
    const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`
    if (!seenDocs.has(docId)) {
      // Calcular total de horas reales programadas (sesiones semanales)
      const totalHorasSemana = horarios
        .filter(x => (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId)
        .reduce((sum, x) => {
          if (!x.horaInicio || !x.horaFin) return sum
          const h1 = parseInt(x.horaInicio.split(':')[0])
          const h2 = parseInt(x.horaFin.split(':')[0])
          return sum + Math.max(h2 - h1, 0)
        }, 0)

      seenDocs.set(docId, {
        nombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`, // Formato: Nombre Apellidos
        asignatura: h.curso.nombre,
        cursoCodigo: h.curso.codigo || '',
        horasT: h.curso.horasTeoria ?? 0,
        horasP: h.curso.horasPractica ?? 0,
        horasL: h.curso.horasLaboratorio ?? 0,
        grupos: horarios.filter(x => (x.docenteId ?? `${x.docente.usuario.apellidos}-${x.docente.usuario.nombre}`) === docId).length,
        totalHoras: totalHorasSemana,
        departamento: h.docente.departamento ?? '',
        docId,
      })
    }
  }

  // Convertir a array y ordenar por prioridad de código de curso
  const docentesUnicos = Array.from(seenDocs.values())
  docentesUnicos.sort((a, b) => {
    const getPrefixPriority = (code: string) => {
      if (code.startsWith('IS-')) return 1
      if (code.startsWith('EG-')) return 2
      return 3
    }
    const prioA = getPrefixPriority(a.cursoCodigo)
    const prioB = getPrefixPriority(b.cursoCodigo)
    if (prioA !== prioB) return prioA - prioB
    return a.cursoCodigo.localeCompare(b.cursoCodigo)
  })

  // Asignar número y color en base al orden prioritario
  docentesUnicos.forEach((doc, idx) => {
    doc.numero = idx + 1
    doc.color = COLORES[idx % COLORES.length]
    seenDocs.set(doc.docId, doc)
  })

  // 2. Calcular rowspan y celdas consumidas
  const calcSpan = (ini: string, fin: string) => {
    const h1 = parseInt(ini); const h2 = parseInt(fin)
    return Math.max(h2 - h1, 1)
  }
  const consumed = new Set<string>()
  for (const h of horarios) {
    if (!h.horaInicio || !h.horaFin) continue
    const span = calcSpan(h.horaInicio, h.horaFin)
    const startH = parseInt(h.horaInicio)
    for (let o = 1; o < span; o++) {
      consumed.add(`${h.diaSemana}-${String(startH + o).padStart(2,'0')}:00`)
    }
  }

  // 3. Extraer ciclo del subtitulo
  const cicloMatch = subtitulo.match(/Ciclo\s+([IVX]+|\d+)/i)
  const ciclo = cicloMatch?.[1] ?? ''
  const esCicloI = ciclo === 'I' || ciclo === '1' || /Ciclo\s+(I\b|1\b)/i.test(subtitulo)

  // Si es Ciclo I, marcar las horas del Miércoles como consumidas excepto las de inicio (07:00 y 14:00) y almuerzo (13:00)
  if (esCicloI) {
    const horasMiercoles = [
      '08:00', '09:00', '10:00', '11:00', '12:00',
      '15:00', '16:00', '17:00'
    ]
    horasMiercoles.forEach(h => consumed.add(`MIERCOLES-${h}`))
  }

  // Helper para formatear nombre de ambiente
  const formatAmbiente = (name: string) => {
    if (!name) return ''
    if (name.toLowerCase().includes('posgrado')) {
      return `(${name.toLowerCase()})`
    }
    return name.replace(/\s*-\s*/, '<br/>')
  }

  // Helper para etiqueta de componente
  const getComponentLabel = (h: any) => {
    if (h.tipoComponente === 'PRACTICA') return ' Práctica'
    if (h.tipoComponente === 'TEORIA' && h.curso.codigo === 'EG-106B') return ' Teoría'
    return ''
  }

  // 4. Construir HTML de tabla superior
  const filas = Array.from({ length: Math.max(13, docentesUnicos.length) }, (_, i) => {
    const doc = docentesUnicos[i]
    const bg = doc?.color ?? 'transparent'
    const tdDoc = (v: any, extra = '') =>
      `<td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left;background:${bg};${extra}">${v ?? ''}</td>`

    let leftCell = ''
    if (i === 0) leftCell = `<td rowspan="3" colspan="2" style="border:1px solid #000;padding:4px;font-size:11px;font-weight:bold;text-align:left;vertical-align:top">Universidad Nacional de Trujillo<br/>Facultad de Ingeniería<br/>Trujillo</td>`
    else if (i === 3) leftCell = `<td colspan="2" style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left">ESCUELA: <span style="color:#0070c0;font-weight:bold">INGENIERÍA DE SISTEMAS</span></td>`
    else if (i === 5) leftCell = `<td colspan="2" style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left">CICLO: <span style="color:#0070c0;font-weight:bold">${ciclo}</span>&nbsp;&nbsp;SECCIÓN: <span style="color:#0070c0;font-weight:bold">A</span></td>`
    else if (i === 7) leftCell = `<td colspan="2" style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left">AÑO ACADÉMICO: <span style="color:#0070c0;font-weight:bold">${new Date().getFullYear()}</span>&nbsp;SEMESTRE: <span style="font-weight:bold">I</span></td>`
    else if (i === 9) leftCell = `<td colspan="2" style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left">Inicio del Ciclo: <span style="color:#c00000;font-weight:bold">13-04-2026</span></td>`
    else if (i === 10) leftCell = `<td colspan="2" style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:left">Término del Ciclo: <span style="color:#c00000;font-weight:bold">08-08-2026</span></td>`
    else if (![1,2].includes(i)) leftCell = `<td colspan="2" style="border:none"></td>`

    return `<tr>
      ${leftCell}
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center">${doc ? doc.numero : ''}</td>
      ${tdDoc(doc?.nombre)}
      ${tdDoc(doc?.asignatura)}
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center;background:${bg}">${doc?.horasT ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center;background:${bg}">${doc?.horasP ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center;background:${bg}">${doc?.horasL ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center;background:${bg}">${doc?.grupos ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:10px;text-align:center;font-weight:bold;background:${bg}">${doc?.totalHoras ?? ''}</td>
      ${tdDoc(doc?.departamento)}
    </tr>`
  }).join('')

  // 5. Construir HTML de grilla
  const thStyle = 'border:1px solid #000;padding:2px 4px;font-size:10px;background:#000;color:#fff;font-weight:bold;text-align:center'
  const horaStyle = 'border:1px solid #000;padding:2px 4px;font-size:10px;background:#f2f2f2;font-weight:bold;text-align:center;width:38px'

  const grillaFilas = FRANJAS.map(({ ini, label }) => {
    const celdas = DIAS_GRILLA.map(dia => {
      if (consumed.has(`${dia}-${ini}`)) return ''
      
      // Renderizar bloque unificado para Miércoles si es Ciclo I
      if (dia === 'MIERCOLES' && esCicloI) {
        if (ini === '07:00') {
          return `<td rowspan="6" style="border:1px solid #000;background:#bdd7ee;text-align:center;vertical-align:middle;font-size:11px;font-weight:bold">
            ESTUDIOS<br/>GENERALES
          </td>`
        }
        if (ini === '14:00') {
          return `<td rowspan="4" style="border:1px solid #000;background:#bdd7ee;text-align:center;vertical-align:middle;font-size:11px;font-weight:bold">
            ESTUDIOS<br/>GENERALES
          </td>`
        }
      }

      const h = horarios.find(x => x.diaSemana === dia && x.horaInicio === ini)
      if (!h) return `<td style="border:1px solid #000;padding:2px;font-size:10px"></td>`
      
      const docId = h.docenteId ?? `${h.docente.usuario.apellidos}-${h.docente.usuario.nombre}`
      const doc = seenDocs.get(docId)
      const span = calcSpan(h.horaInicio, h.horaFin)
      const labelComp = getComponentLabel(h)
      const ambText = formatAmbiente(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '')
      const amb = `<div style="font-size:9px">${ambText}</div>`
      
      return `<td rowspan="${span}" style="border:1px solid #000;padding:4px 2px;font-size:10px;background:${doc?.color ?? '#fff'};text-align:center;vertical-align:middle">
        <strong style="font-size:16px">${doc?.numero ?? ''}</strong><span style="font-size:10px;font-weight:normal">${labelComp}</span>${amb}
      </td>`
    }).join('')
    return `<tr><td style="${horaStyle}">${label}</td>${celdas}<td style="${horaStyle}">${label}</td></tr>`
  }).join('')

  // 6. HTML completo
  const htmlCompleto = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${titulo}</title>
    <style>
      body{margin:8mm;font-family:Arial,sans-serif;font-size:10px}
      @page{size:A4 landscape;margin:8mm}
      table{border-collapse:collapse;width:100%}
    </style></head><body>
    <table style="border-collapse:collapse;width:100%;margin-bottom:6px">
      <thead><tr>
        <th colspan="2" style="${thStyle};width:30%">DATOS INSTITUCIONALES</th>
        <th style="${thStyle};width:28px">N°</th>
        <th style="${thStyle};text-align:left">PROFESOR</th>
        <th style="${thStyle};text-align:left">ASIGNATURA</th>
        <th style="${thStyle};width:28px">T</th>
        <th style="${thStyle};width:28px">P</th>
        <th style="${thStyle};width:28px">L</th>
        <th style="${thStyle};width:28px">G</th>
        <th style="${thStyle};width:38px">T.HORAS</th>
        <th style="${thStyle};text-align:left">DEPARTAMENTO</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th style="${thStyle};width:38px">HORA</th>
        <th style="${thStyle}">LUNES</th><th style="${thStyle}">MARTES</th>
        <th style="${thStyle}">MIÉRCOLES</th><th style="${thStyle}">JUEVES</th>
        <th style="${thStyle}">VIERNES</th><th style="${thStyle}">SÁBADO</th>
        <th style="${thStyle};width:38px">HORA</th>
      </tr></thead>
      <tbody>${grillaFilas}</tbody>
    </table>
  </body></html>`

  // 7. Abrir ventana e imprimir
  const win = window.open('', '_blank')
  if (!win) { alert('Permite ventanas emergentes para exportar PDF'); return }
  win.document.write(htmlCompleto)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 600)
}
