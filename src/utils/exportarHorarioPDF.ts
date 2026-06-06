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
  { ini: '20:00', label: '8-9' },
];

const normalizeTime = (time: string): string => {
  if (!time) return '00:00';

  const [h, m] = time.split(':').map(Number);

  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
};

const timeToMinutes = (time: string): number => {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  return h * 60 + m;
};

const calcSpan = (ini: string, fin: string): number => {
  const diff = timeToMinutes(fin) - timeToMinutes(ini);
  return Math.max(Math.ceil(diff / 60), 1);
};

const formatAmbiente = (name: string): string => {
  if (!name) return '';

  if (name.toLowerCase().includes('posgrado')) {
    return `(${name.toLowerCase()})`;
  }

  return name.replace(/\s*-\s*/, '<br/>');
};

const normalizarTexto = (texto: string): string => {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

const normalizarDia = (dia: string): string => {
  return (dia ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
};

const getNombreDocente = (h: any): string => {
  const nombre = h.docente?.usuario?.nombre ?? h.docente?.nombre ?? '';
  const apellidos = h.docente?.usuario?.apellidos ?? h.docente?.apellidos ?? '';

  return `${nombre} ${apellidos}`.trim();
};

const DEPARTAMENTOS_DOCENTE: Record<string, string> = {
  [normalizarTexto('Marcelino Torres Villanueva')]: 'Ing. de Sistemas',
  [normalizarTexto('Alberto Mendoza de los Santos')]: 'Ing. de Sistemas',
  [normalizarTexto('Paul Cotrina Castellanos')]: 'Ing. de Sistemas',
  [normalizarTexto('Bertha Urtecho Zavaleta')]: 'CC. Psicológicas',
  [normalizarTexto('José Luis Ponte Bejarano')]: 'Matemáticas',
  [normalizarTexto('Jose Luis Ponte Bejarano')]: 'Matemáticas',
  [normalizarTexto('Jorge Luis Ríos Gonzales')]: 'Lengua Nacional y Literatura',
  [normalizarTexto('Jorge Luis Rios Gonzales')]: 'Lengua Nacional y Literatura',
  [normalizarTexto('Segundo Guíbar Obeso')]: 'Matemáticas',
  [normalizarTexto('Segundo Guibar Obeso')]: 'Matemáticas',
  [normalizarTexto('Miguel Ipanaque Zapata')]: 'Estadística',
  [normalizarTexto('Martha Cardoso')]: 'Estadística',

  [normalizarTexto('Zoraida Vidal Melgarejo')]: 'Ing. de Sistemas',
  [normalizarTexto('Everson David Agreda Gamboa')]: 'Ing. de Sistemas',
  [normalizarTexto('Juan Carlos Obando Roldán')]: 'Ing. de Sistemas',
  [normalizarTexto('Juan Carlos Obando Roldan')]: 'Ing. de Sistemas',
  [normalizarTexto('Marcos Ferrer Reyna')]: 'Matemáticas',
  [normalizarTexto('Teresita Rojas García')]: 'Estadística',
  [normalizarTexto('Teresita Rojas Garcia')]: 'Estadística',
  [normalizarTexto('Juan Carrascal Cabanillas')]: 'Administración',
  [normalizarTexto('Vilma Méndez Gil')]: 'Física',
  [normalizarTexto('Vilma Mendez Gil')]: 'Física',
  [normalizarTexto('Sheyla Laura Escobedo Rodríguez')]: 'CC. Psicológicas',
  [normalizarTexto('Sheyla Laura Escobedo Rodriguez')]: 'CC. Psicológicas',

  [normalizarTexto('Luis Boy Chavil')]: 'Ing. de Sistemas',
  [normalizarTexto('Robert Jerry Sánchez Ticona')]: 'Ing. de Sistemas',
  [normalizarTexto('Robert Jerry Sanchez Ticona')]: 'Ing. de Sistemas',
  [normalizarTexto('César Arellano Salazar')]: 'Ing. de Sistemas',
  [normalizarTexto('Cesar Arellano Salazar')]: 'Ing. de Sistemas',
  [normalizarTexto('Camilo Suárez Rebaza')]: 'Ing. de Sistemas',
  [normalizarTexto('Camilo Suarez Rebaza')]: 'Ing. de Sistemas',
  [normalizarTexto('Marcos Baca López')]: 'Ing. Industrial',
  [normalizarTexto('Marcos Baca Lopez')]: 'Ing. Industrial',
  [normalizarTexto('Ana Cuadra Mitzugaray')]: 'Contabilidad y Finanzas',

  [normalizarTexto('Juan Pedro Santos Fernández')]: 'Ing. de Sistemas',
  [normalizarTexto('Juan Pedro Santos Fernandez')]: 'Ing. de Sistemas',
  [normalizarTexto('Ricardo Mendoza Rivera')]: 'Ing. de Sistemas',
  [normalizarTexto('Óscar Romel Alcántara Moreno')]: 'Ing. de Sistemas',
  [normalizarTexto('Oscar Romel Alcantara Moreno')]: 'Ing. de Sistemas',
  [normalizarTexto('Jhoe Gonzalez Vasquez')]: 'Ing. Industrial',
  [normalizarTexto('José Gómez Ávila')]: 'Ing. de Sistemas',
  [normalizarTexto('Jose Gomez Avila')]: 'Ing. de Sistemas',
};

const getDepartamentoDocente = (h: any): string => {
  const desdeObjeto =
    h.docente?.departamento ??
    h.docente?.departamentoAcademico?.nombre ??
    h.docente?.departamentoAcademico?.nombreDepartamento ??
    h.docente?.departamento?.nombre ??
    h.departamentoAcademico?.nombre ??
    h.departamento?.nombre ??
    '';

  if (desdeObjeto) return desdeObjeto;

  const nombreDocente = getNombreDocente(h);
  return DEPARTAMENTOS_DOCENTE[normalizarTexto(nombreDocente)] ?? '';
};

const getTipoBloque = (h: any): 'TEORIA' | 'PRACTICA' | 'LABORATORIO' => {
  const tipo = String(h.tipoComponente ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (tipo.includes('LAB')) return 'LABORATORIO';
  if (tipo.includes('PRACTICA')) return 'PRACTICA';
  if (tipo.includes('TEORIA')) return 'TEORIA';

  const ambiente = String(
    h.ambiente?.nombre ??
    h.ambiente?.codigo ??
    h.ambiente ??
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (ambiente.includes('LAB')) return 'LABORATORIO';

  const nombreCurso = String(h.curso?.nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (nombreCurso.includes('PRACTICA')) return 'PRACTICA';

  return 'TEORIA';
};

const getComponentLabel = (h: any): string => {
  const tipo = getTipoBloque(h);

  if (tipo === 'PRACTICA') return 'Práctica';
  if (tipo === 'LABORATORIO') return 'Lab.';

  if (tipo === 'TEORIA' && h.curso?.codigo === 'EG-106B') {
    return 'Teoría';
  }

  return '';
};

const formatearNumero = (valor: number): number | string => {
  if (Number.isInteger(valor)) return valor;
  return Number(valor.toFixed(2));
};


type MetadatosCursoPDF = {
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
};

// Metadatos usados SOLO para la tabla superior del PDF.
// Se trabaja por CÓDIGO de curso porque algunos cursos tienen nombres parecidos,
// por ejemplo IS-101 y EG-101, pero no tienen la misma distribución T/P/L.
const METADATOS_CURSO_PDF: Record<string, MetadatosCursoPDF> = {
  // Ciclo I
  'IS-101': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-102': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 0 },
  'EG-101': { horasTeoria: 0, horasPractica: 0, horasLaboratorio: 2 },
  'EG-102': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'EG-103': { horasTeoria: 1, horasPractica: 4, horasLaboratorio: 0 },
  'EG-104': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'EG-105': { horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0 },
  'EG-106': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'EG-106B': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },

  // Ciclo III
  'IS-301': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4 },
  'IS-302': { horasTeoria: 2, horasPractica: 1, horasLaboratorio: 2 },
  'IS-303': { horasTeoria: 1, horasPractica: 1, horasLaboratorio: 2 },
  'MAT-301': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 },
  'EST-301': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 },
  'ADM-301': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'FIS-301': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 },
  'PSI-301': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },

  // Ciclo V
  'IS-501': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-502': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-503': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'IS-504': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4 },
  'IS-505': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-506': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'IND-501': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'CF-501': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },

  // Ciclo VII
  'IS-701': { horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3 },
  'IS-701B': { horasTeoria: 0, horasPractica: 0, horasLaboratorio: 3 },
  'IS-702': { horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3 },
  'IS-704': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 0 },
  'IS-704B': { horasTeoria: 0, horasPractica: 0, horasLaboratorio: 2 },
  'IS-705': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 },
  'IS-706': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'IS-707': { horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3 },
  'IS-708': { horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 },
  'EP-701': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },

  // Ciclo IX
  'IS-901': { horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0 },
  'IS-901B': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-902B': { horasTeoria: 0, horasPractica: 0, horasLaboratorio: 2 },
  'IS-904': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'IS-905': { horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 },
  'IS-906': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
  'IS-907': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4 },
  'IS-908': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4 },
  'IS-909': { horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 },
};

const getMetadatosCursoPDF = (h: any): MetadatosCursoPDF => {
  const codigo = String(h.curso?.codigo ?? '').toUpperCase().trim();
  const override = METADATOS_CURSO_PDF[codigo];

  if (override) return override;

  return {
    horasTeoria: Number(h.curso?.horasTeoria ?? 0),
    horasPractica: Number(h.curso?.horasPractica ?? 0),
    horasLaboratorio: Number(h.curso?.horasLaboratorio ?? 0),
  };
};

export async function exportarHorarioPDF(
  horarios: any[],
  titulo: string,
  subtitulo: string
): Promise<void> {

  const normalizedHorarios = horarios.map((h, index) => ({
    ...h,
    __ordenOriginal: index,
    diaSemana: normalizarDia(h.diaSemana),
    horaInicio: normalizeTime(h.horaInicio),
    horaFin: normalizeTime(h.horaFin),
  }));

  const seenDocs = new Map<string, any>();

  const getDocId = (h: any): string => {
    return (
      h.docenteId ??
      h.docente?.id ??
      `${h.docente?.usuario?.apellidos ?? h.docente?.apellidos ?? ''}-${h.docente?.usuario?.nombre ?? h.docente?.nombre ?? ''}`
    );
  };

  for (const h of normalizedHorarios) {
    const docId = getDocId(h);
    const key = `${docId}||${h.curso.codigo}`;

    if (!seenDocs.has(key)) {
      const bloquesDocenteCurso = normalizedHorarios.filter(x => {
        const xDocId = getDocId(x);
        return xDocId === docId && x.curso.codigo === h.curso.codigo;
      });

      const metadatosPDF = getMetadatosCursoPDF(h);

      const horasT = Number(metadatosPDF.horasTeoria ?? 0);
      const horasP = Number(metadatosPDF.horasPractica ?? 0);
      const horasL = Number(metadatosPDF.horasLaboratorio ?? 0);

      // Cuenta TODOS los grupos reales del curso: A, B, C, etc.
      // Esto corrige el error del ciclo I, donde los cursos teóricos quedaban con G = 0.
      const gruposTodos = new Set(
        bloquesDocenteCurso
          .map(bloque => String(bloque.grupo?.nombre ?? 'A').trim())
          .filter(Boolean)
      );

      const cantidadGruposGeneral = Math.max(gruposTodos.size, 1);

      // Cuenta solo los grupos de laboratorio para calcular correctamente las horas de laboratorio.
      const gruposLaboratorio = new Set(
        bloquesDocenteCurso
          .filter(bloque => getTipoBloque(bloque) === 'LABORATORIO')
          .map(bloque => String(bloque.grupo?.nombre ?? 'A').trim())
          .filter(Boolean)
      );

      const cantidadGruposLab = horasL > 0 ? Math.max(gruposLaboratorio.size, 1) : 0;

      // Total de horas:
      // Las horas de teoría y práctica se cuentan una vez.
      // Las horas de laboratorio se multiplican por los grupos de laboratorio cuando corresponde.
      // Ejemplo ciclo I: IS-101 = 2 teoría + 2 laboratorio * 2 grupos = 6 horas.
      const totalHoras = horasT + horasP + (horasL > 0 ? horasL * cantidadGruposLab : 0);

      seenDocs.set(key, {
        nombre: getNombreDocente(h),
        asignatura: h.curso.nombre,
        cursoCodigo: h.curso.codigo || '',

        horasT: formatearNumero(horasT),
        horasP: formatearNumero(horasP),
        horasL: formatearNumero(horasL),

        grupos: cantidadGruposGeneral,

        totalHoras: formatearNumero(totalHoras),

        departamento: getDepartamentoDocente(h),
        docId,
      });
    }
  }

  const docentesUnicos = Array.from(seenDocs.values());

  docentesUnicos.sort((a, b) => {
    const prioridad = (codigo: string) => {
      if (codigo.startsWith('IS-')) return 1;
      if (codigo.startsWith('EG-')) return 2;
      return 3;
    };

    if (prioridad(a.cursoCodigo) !== prioridad(b.cursoCodigo)) {
      return prioridad(a.cursoCodigo) - prioridad(b.cursoCodigo);
    }

    return a.cursoCodigo.localeCompare(b.cursoCodigo);
  });

  docentesUnicos.forEach((doc, idx) => {
    doc.numero = idx + 1;
    doc.color = COLORES[idx % COLORES.length];

    const key = `${doc.docId}||${doc.cursoCodigo}`;
    seenDocs.set(key, doc);
  });

  const cicloMatch = subtitulo.match(/CICLO\s*:?\s*([IVX]+|\d+)/i);
  const ciclo = cicloMatch?.[1] ?? '';
  const esCicloI = ciclo === 'I' || ciclo === '1';

  const thStyle = `
    border:1px solid #000;
    padding:4px 6px;
    font-size:10px;
    background:#1a1a2e;
    color:#fff;
    font-weight:bold;
    text-align:center;
    box-sizing:border-box;
  `;

  const horaStyle = `
    border:1px solid #000;
    padding:2px 2px;
    font-size:10px;
    background:#f2f2f2;
    font-weight:bold;
    text-align:center;
    width:38px;
    min-width:38px;
    max-width:38px;
    white-space:nowrap;
    box-sizing:border-box;
  `;

  const celdaBase = `
    border:1px solid #000;
    padding:2px 4px;
    font-size:10px;
    box-sizing:border-box;
  `;

  const colgroupHorario = `
    <colgroup>
      <col style="width:38px" />
      <col style="width:calc((100% - 134px) / 5)" />
      <col style="width:calc((100% - 134px) / 5)" />
      <col style="width:calc((100% - 134px) / 5)" />
      <col style="width:calc((100% - 134px) / 5)" />
      <col style="width:calc((100% - 134px) / 5)" />
      <col style="width:58px" />
      <col style="width:38px" />
    </colgroup>
  `;

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
      leftCell = `
        <td colspan="2" style="${celdaBase}text-align:left">
          ESCUELA: <span style="color:#0070c0;font-weight:bold">INGENIERÍA DE SISTEMAS</span>
        </td>`;
    } else if (i === 4) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 5) {
      leftCell = `
        <td colspan="2" style="${celdaBase}text-align:left">
          CICLO: <span style="color:#0070c0;font-weight:bold">${ciclo}</span>
          &nbsp;&nbsp;&nbsp;
          SECCIÓN: <span style="color:#0070c0;font-weight:bold">A</span>
        </td>`;
    } else if (i === 6) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 7) {
      leftCell = `
        <td colspan="2" style="${celdaBase}text-align:left">
          AÑO ACADÉMICO:
          <span style="color:#0070c0;font-weight:bold">${new Date().getFullYear()}</span>
          &nbsp;&nbsp;
          SEMESTRE: <span style="font-weight:bold">I</span>
        </td>`;
    } else if (i === 8) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    } else if (i === 9) {
      leftCell = `
        <td colspan="2" style="${celdaBase}text-align:left">
          Inicio del Ciclo:
          <span style="color:#c00000;font-weight:bold">13-04-2026</span>
        </td>`;
    } else if (i === 10) {
      leftCell = `
        <td colspan="2" style="${celdaBase}text-align:left">
          Término del Ciclo:
          <span style="color:#c00000;font-weight:bold">08-08-2026</span>
        </td>`;
    } else if (![1, 2].includes(i)) {
      leftCell = `<td colspan="2" style="border:none"></td>`;
    }

    return `
      <tr>
        ${leftCell}

        <td style="${celdaBase}text-align:center;font-weight:bold">
          ${doc ? doc.numero : ''}
        </td>

        ${tdDoc(doc?.nombre)}
        ${tdDoc(doc?.asignatura)}
        ${tdCenter(doc?.horasT ?? '')}
        ${tdCenter(doc?.horasP ?? '')}
        ${tdCenter(doc?.horasL ?? '')}
        ${tdCenter(doc?.grupos ?? '')}

        <td style="${celdaBase}text-align:center;font-weight:bold;background:${bg}">
          ${doc?.totalHoras ?? ''}
        </td>

        ${tdDoc(doc?.departamento)}
      </tr>`;
  }).join('');

  const ROW_HEIGHT = 30;
  const START_MINUTES = 7 * 60;
  const TOTAL_FRANJAS = FRANJAS.length;
  const GRID_HEIGHT = ROW_HEIGHT * TOTAL_FRANJAS;

  const PRIORIDAD_CARRIL: Record<string, number> = {
    'FIS-301': 1,
    'IS-303': 2,

    'IS-902B': 1,
    'IS-901B': 1,
    'IS-906': 2,
  };

  const getDocenteCurso = (h: any) => {
    const docId = getDocId(h);
    const key = `${docId}||${h.curso.codigo}`;

    return seenDocs.get(key);
  };

  const getTopPx = (time: string): number => {
    const minutes = timeToMinutes(time);
    return ((minutes - START_MINUTES) / 60) * ROW_HEIGHT;
  };

  const getHeightPx = (ini: string, fin: string): number => {
    const diff = timeToMinutes(fin) - timeToMinutes(ini);
    return Math.max((diff / 60) * ROW_HEIGHT, ROW_HEIGHT);
  };

  const ordenarBloquesParaCarriles = (a: any, b: any): number => {
    const aIni = timeToMinutes(a.horaInicio);
    const bIni = timeToMinutes(b.horaInicio);

    if (aIni !== bIni) return aIni - bIni;

    const aCodigo = String(a.curso?.codigo ?? '').toUpperCase();
    const bCodigo = String(b.curso?.codigo ?? '').toUpperCase();

    const aPrioridad = PRIORIDAD_CARRIL[aCodigo] ?? 9999;
    const bPrioridad = PRIORIDAD_CARRIL[bCodigo] ?? 9999;

    if (aPrioridad !== bPrioridad) {
      return aPrioridad - bPrioridad;
    }

    const aFin = timeToMinutes(a.horaFin);
    const bFin = timeToMinutes(b.horaFin);

    if (aFin !== bFin) return bFin - aFin;

    return (a.__ordenOriginal ?? 0) - (b.__ordenOriginal ?? 0);
  };

  const dividirEnClusters = (bloques: any[]) => {
    const ordenados = [...bloques].sort(ordenarBloquesParaCarriles);

    const clusters: any[][] = [];
    let clusterActual: any[] = [];
    let finCluster = -1;

    for (const h of ordenados) {
      const ini = timeToMinutes(h.horaInicio);
      const fin = timeToMinutes(h.horaFin);

      if (clusterActual.length === 0) {
        clusterActual.push(h);
        finCluster = fin;
        continue;
      }

      if (ini < finCluster) {
        clusterActual.push(h);
        finCluster = Math.max(finCluster, fin);
      } else {
        clusters.push(clusterActual);
        clusterActual = [h];
        finCluster = fin;
      }
    }

    if (clusterActual.length > 0) {
      clusters.push(clusterActual);
    }

    return clusters;
  };

  const asignarCarrilesCluster = (cluster: any[]) => {
    const ordenados = [...cluster].sort(ordenarBloquesParaCarriles);

    const carrilesFin: number[] = [];
    const ubicados: Array<{
      h: any;
      carril: number;
      cantidadCarriles: number;
    }> = [];

    for (const h of ordenados) {
      const inicio = timeToMinutes(h.horaInicio);
      const fin = timeToMinutes(h.horaFin);

      let carril = carrilesFin.findIndex(finCarril => finCarril <= inicio);

      if (carril === -1) {
        carril = carrilesFin.length;
        carrilesFin.push(fin);
      } else {
        carrilesFin[carril] = fin;
      }

      ubicados.push({
        h,
        carril,
        cantidadCarriles: 0,
      });
    }

    const cantidadCarriles = Math.max(1, carrilesFin.length);

    return ubicados.map(item => ({
      ...item,
      cantidadCarriles,
    }));
  };

  const asignarCarrilesPorDia = (dia: string) => {
    const bloquesDia = normalizedHorarios.filter(
      h => normalizarDia(h.diaSemana) === normalizarDia(dia)
    );

    const clusters = dividirEnClusters(bloquesDia);

    return clusters.flatMap(cluster => asignarCarrilesCluster(cluster));
  };

  const renderBloqueHorario = (
    h: any,
    carril: number,
    cantidadCarriles: number
  ): string => {
    const doc = getDocenteCurso(h);

    const top = getTopPx(h.horaInicio);
    const height = getHeightPx(h.horaInicio, h.horaFin);

    const ancho = 100 / cantidadCarriles;
    const left = carril * ancho;

    const labelComp = getComponentLabel(h);
    const ambText = formatAmbiente(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '');

    const nombreCorto = doc?.asignatura
      ? doc.asignatura.split(' ').slice(0, 4).join(' ')
      : '';

    const grupo = h.grupo?.nombre ? `Gr. ${h.grupo.nombre}` : '';

    return `
      <div
        style="
          position:absolute;
          top:${top}px;
          left:${left}%;
          width:${ancho}%;
          height:${height}px;
          background:${doc?.color ?? '#fff'};
          border:1px solid #000;
          text-align:center;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:2px 1px;
          z-index:3;
        "
      >
        <strong style="font-size:14px;line-height:1">${doc?.numero ?? ''}</strong>

        ${
          labelComp
            ? `<span style="font-size:8px;font-weight:normal;line-height:1.1">${labelComp}</span>`
            : ''
        }

        <div style="font-size:7.5px;margin-top:1px;font-style:italic;line-height:1.15">
          ${nombreCorto}
        </div>

        <div style="font-size:7px;margin-top:1px;line-height:1.15">
          ${ambText}
        </div>

        ${
          grupo
            ? `<div style="font-size:7px;margin-top:2px;line-height:1.1">${grupo}</div>`
            : ''
        }
      </div>
    `;
  };

  const renderEstudiosGenerales = (): string => {
    return `
      <div
        style="
          position:absolute;
          top:0;
          left:0;
          width:100%;
          height:${ROW_HEIGHT * 6}px;
          background:#bdd7ee;
          border:1px solid #000;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          font-size:11px;
          font-weight:bold;
          z-index:3;
        "
      >
        ESTUDIOS<br/>GENERALES
      </div>

      <div
        style="
          position:absolute;
          top:${ROW_HEIGHT * 6}px;
          left:0;
          width:100%;
          height:${ROW_HEIGHT * 7}px;
          background:#bdd7ee;
          border:1px solid #000;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          font-size:11px;
          font-weight:bold;
          z-index:3;
        "
      >
        ESTUDIOS<br/>GENERALES
      </div>
    `;
  };

  const renderDiaCompleto = (dia: string): string => {
    let contenido = '';

    if (normalizarDia(dia) === 'MIERCOLES' && esCicloI) {
      contenido = renderEstudiosGenerales();
    } else {
      contenido = asignarCarrilesPorDia(dia)
        .map(({ h, carril, cantidadCarriles }) =>
          renderBloqueHorario(h, carril, cantidadCarriles)
        )
        .join('');
    }

    return `
      <td rowspan="${TOTAL_FRANJAS}"
          style="
            ${celdaBase}
            padding:0;
            vertical-align:top;
            position:relative;
            height:${GRID_HEIGHT}px;
            overflow:hidden;
          "
      >
        <div
          style="
            position:relative;
            width:100%;
            height:${GRID_HEIGHT}px;
            overflow:hidden;
            background-image:
              repeating-linear-gradient(
                to bottom,
                transparent 0,
                transparent ${ROW_HEIGHT - 1}px,
                #000 ${ROW_HEIGHT - 1}px,
                #000 ${ROW_HEIGHT}px
              );
          "
        >
          <div
            style="
              position:absolute;
              top:${ROW_HEIGHT * 6}px;
              left:0;
              width:100%;
              border-top:3px solid #000;
              z-index:1;
              pointer-events:none;
            "
          ></div>

          ${contenido}
        </div>
      </td>
    `;
  };

  const grillaFilas = FRANJAS.map(({ ini, label }, index) => {
    const esPrimeroTarde = ini === '13:00';
    const borderTopExtra = esPrimeroTarde ? 'border-top:3px solid #000;' : '';
    const horaStyleExtra = `${horaStyle}${borderTopExtra}height:${ROW_HEIGHT}px;`;

    const diasSoloPrimeraFila =
      index === 0
        ? DIAS_GRILLA.map(dia => renderDiaCompleto(dia)).join('')
        : '';

    return `
      <tr>
        <td style="${horaStyleExtra}">${label}</td>
        ${diasSoloPrimeraFila}
        <td style="${horaStyleExtra}">${label}</td>
      </tr>
    `;
  }).join('');

  const htmlCompleto = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${titulo}</title>

  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }

    body {
      padding: 8mm;
    }

    @page {
      size: A4 landscape;
      margin: 8mm;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    th,
    td {
      box-sizing: border-box;
    }

    .tabla-superior {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 6px;
      table-layout: fixed;
    }

    .tabla-horario {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
      page-break-inside: avoid;
    }

    .tabla-horario th,
    .tabla-horario td {
      overflow: hidden;
      word-break: normal;
    }

    @media print {
      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        padding: 0;
      }

      .tabla-superior,
      .tabla-horario {
        width: 100%;
        table-layout: fixed;
      }
    }
  </style>
</head>

<body>

  <table class="tabla-superior">
    <thead>
      <tr>
        <th colspan="2" style="${thStyle}width:30%;text-align:center">
          DATOS INSTITUCIONALES
        </th>
        <th style="${thStyle}width:28px">N°</th>
        <th style="${thStyle}text-align:left">DOCENTE</th>
        <th style="${thStyle}text-align:left">ASIGNATURA</th>
        <th style="${thStyle}width:24px">T</th>
        <th style="${thStyle}width:24px">P</th>
        <th style="${thStyle}width:24px">L</th>
        <th style="${thStyle}width:24px">G</th>
        <th style="${thStyle}width:44px">T.<br/>HORAS</th>
        <th style="${thStyle}text-align:left">DEPARTAMENTO</th>
      </tr>
    </thead>

    <tbody>
      ${filas}
    </tbody>
  </table>

  <table class="tabla-horario">
    ${colgroupHorario}

    <thead>
      <tr>
        <th style="${thStyle}width:38px">HORA</th>
        <th style="${thStyle}">LUNES</th>
        <th style="${thStyle}">MARTES</th>
        <th style="${thStyle}">MIÉRCOLES</th>
        <th style="${thStyle}">JUEVES</th>
        <th style="${thStyle}">VIERNES</th>
        <th style="${thStyle}width:58px">SÁBADO</th>
        <th style="${thStyle}width:38px">HORA</th>
      </tr>
    </thead>

    <tbody>
      ${grillaFilas}
    </tbody>
  </table>

</body>
</html>`;

  const win = window.open('', '_blank');

  if (!win) {
    alert('Permite ventanas emergentes para exportar PDF');
    return;
  }

  win.document.open();
  win.document.write(htmlCompleto);
  win.document.close();


  //const imprimir = () => {
   // win.focus();

   // setTimeout(() => {
     // win.print();
    //}, 800);
  //};

  //if (win.document.readyState === 'complete') {
    //imprimir();
  //} else {
   // win.onload = imprimir;
  //}
//}
}