import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { HorarioCalendarItem } from '@/components/horarios/HorarioWeeklyCalendar';

// ─────────────────────────────────────────────
// EXPORTACIÓN EXCEL — FORMATO OFICIAL UNT
// Corregido para parecerse al PDF:
// - Detecta ciclo desde subtítulo/título o desde horarios[0].curso.ciclo.
// - Agrega bloque ESTUDIOS GENERALES en miércoles para Ciclo I o cuando se fuerce desde opciones.
// - Muestra número, tipo de componente, curso corto y ambiente.
// - Mantiene colores por docente y mejor formato visual.
// - Configura hoja para impresión horizontal A4.
// ─────────────────────────────────────────────

const COLORES_UNT_GRILLA = [
  { argb: 'FFC6EFCE' }, { argb: 'FFFFC7CE' }, { argb: 'FFBDD7EE' }, { argb: 'FFE2EFDA' },
  { argb: 'FFFFFF00' }, { argb: 'FF92D050' }, { argb: 'FFDCE6F1' }, { argb: 'FFE4DFEC' },
  { argb: 'FFFCE4D6' }, { argb: 'FFD9D9D9' }, { argb: 'FFFFF2CC' }, { argb: 'FFDDEBF7' },
  { argb: 'FFF8CBAD' },
];

const COLORES_UNT_TABLA = [
  { argb: 'FFFFFFFF' },
  { argb: 'FFF0F7FF' },
];

const DIAS_GRILLA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const DIA_LABELS: Record<string, string> = {
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIÉRCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SÁBADO',
};

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

const HORA_COL_IZQ = 1;      // A
const PRIMER_DIA_COL = 2;    // B
const ANCHO_DIA = 4;         // 4 subcolumnas por día para poder dividir bloques simultáneos

const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const borderMediumTop: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const headerFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A1A2E' },
};

const horaFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

const estudiosFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFBDD7EE' },
};

const whiteFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFFF' },
};

const normalizeTime = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
};

const calcSpanH = (ini: string, fin?: string | null): number => {
  if (!ini || !fin) return 1;
  const h1 = parseInt(ini, 10);
  const h2 = parseInt(fin, 10);
  return Math.max(h2 - h1, 1);
};

const normalizarTexto = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const normalizarDia = (dia: string): string => normalizarTexto(dia || '');

const normalizarCiclo = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const texto = normalizarTexto(raw)
    .replace(/CICLO/g, '')
    .replace(/SEMESTRE/g, '')
    .replace(/[^A-Z0-9]/g, '');

  if (['I', '1', '01', 'PRIMER', 'PRIMERO'].includes(texto)) return 'I';
  if (['II', '2', '02', 'SEGUNDO'].includes(texto)) return 'II';
  if (['III', '3', '03', 'TERCER', 'TERCERO'].includes(texto)) return 'III';
  if (['IV', '4', '04', 'CUARTO'].includes(texto)) return 'IV';
  if (['V', '5', '05', 'QUINTO'].includes(texto)) return 'V';
  if (['VI', '6', '06', 'SEXTO'].includes(texto)) return 'VI';
  if (['VII', '7', '07', 'SEPTIMO'].includes(texto)) return 'VII';
  if (['VIII', '8', '08', 'OCTAVO'].includes(texto)) return 'VIII';
  if (['IX', '9', '09', 'NOVENO'].includes(texto)) return 'IX';
  if (['X', '10', 'DECIMO'].includes(texto)) return 'X';

  return texto;
};

const extraerCiclo = (
  horarios: HorarioCalendarItem[],
  titulo: string,
  subtitulo = ''
): string => {
  const texto = `${titulo ?? ''} ${subtitulo ?? ''}`;

  const matchCiclo = texto.match(/Ciclo\s*[:\-]?\s*([IVXLCDM]+|\d+|primer(?:o)?|segundo|tercer(?:o)?|cuarto|quinto|sexto|septimo|séptimo|octavo|noveno|decimo|décimo)/i);
  if (matchCiclo?.[1]) return normalizarCiclo(matchCiclo[1]);

  const matchGeneral = texto.match(/\b(0?1|I|primer(?:o)?)\b/i);
  if (matchGeneral?.[1]) return normalizarCiclo(matchGeneral[1]);

  const ciclosData = horarios
    .map(h => normalizarCiclo(h?.curso?.ciclo))
    .filter(Boolean);

  return ciclosData[0] ?? '';
};

const extraerSemestre = (texto: string): string => {
  const t = normalizarTexto(texto);
  const matchRoman = t.match(/\b(I{1,3}|IV|V)\b/);
  if (matchRoman?.[1]) return matchRoman[1];
  const matchNum = t.match(/\b(1|2)\b/);
  if (matchNum?.[1]) {
    return matchNum[1] === '1' ? 'I' : 'II';
  }
  return 'I';
};

const debeMostrarEstudiosGeneralesMiercoles = (
  horarios: HorarioCalendarItem[],
  ciclo: string,
  forzar?: boolean
): boolean => {
  if (typeof forzar === 'boolean') return forzar;

  const cicloNormalizado = normalizarCiclo(ciclo);
  if (cicloNormalizado === 'I') return true;

  // Respaldo: en algunos casos la función se llama solo con `titulo` y no llega el subtítulo.
  // Si no se pudo detectar ciclo, pero hay cursos de Estudios Generales (EG-), se muestra el bloque.
  const hayCursosEG = horarios.some(h => String(h?.curso?.codigo ?? '').toUpperCase().startsWith('EG-'));
  if (!cicloNormalizado && hayCursosEG) return true;

  // Último respaldo para evitar que el bloque desaparezca cuando el backend no envía ciclo/código.
  // Si en tu sistema no quieres este comportamiento, llama la función con:
  // exportarHorarioExcel(horarios, titulo, subtitulo, { mostrarEstudiosGeneralesMiercoles: false })
  if (!cicloNormalizado) return true;

  return false;
};

const formatAmbienteExcel = (name: string): string => {
  if (!name) return '';
  if (name.toLowerCase().includes('posgrado')) return `(${name.toLowerCase()})`;
  return name.replace(/\s*-\s*/, '\n');
};

const getNombreDocente = (h: any): string => {
  const nombre = h.docente?.usuario?.nombre ?? h.docente?.nombre ?? '';
  const apellidos = h.docente?.usuario?.apellidos ?? h.docente?.apellidos ?? '';
  return `${nombre} ${apellidos}`.trim();
};

const normalizarClave = (texto: string): string =>
  (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const DEPARTAMENTOS_DOCENTE: Record<string, string> = {
  [normalizarClave('Marcelino Torres Villanueva')]: 'Ing. de Sistemas',
  [normalizarClave('Alberto Mendoza de los Santos')]: 'Ing. de Sistemas',
  [normalizarClave('Paul Cotrina Castellanos')]: 'Ing. de Sistemas',
  [normalizarClave('Bertha Urtecho Zavaleta')]: 'CC. Psicológicas',
  [normalizarClave('José Luis Ponte Bejarano')]: 'Matemáticas',
  [normalizarClave('Jose Luis Ponte Bejarano')]: 'Matemáticas',
  [normalizarClave('Jorge Luis Ríos Gonzales')]: 'Lengua Nacional y Literatura',
  [normalizarClave('Jorge Luis Rios Gonzales')]: 'Lengua Nacional y Literatura',
  [normalizarClave('Segundo Guíbar Obeso')]: 'Matemáticas',
  [normalizarClave('Segundo Guibar Obeso')]: 'Matemáticas',
  [normalizarClave('Miguel Ipanaque Zapata')]: 'Estadística',
  [normalizarClave('Martha Cardoso')]: 'Estadística',

  [normalizarClave('Zoraida Vidal Melgarejo')]: 'Ing. de Sistemas',
  [normalizarClave('Everson David Agreda Gamboa')]: 'Ing. de Sistemas',
  [normalizarClave('Juan Carlos Obando Roldán')]: 'Ing. de Sistemas',
  [normalizarClave('Juan Carlos Obando Roldan')]: 'Ing. de Sistemas',
  [normalizarClave('Marcos Ferrer Reyna')]: 'Matemáticas',
  [normalizarClave('Teresita Rojas García')]: 'Estadística',
  [normalizarClave('Teresita Rojas Garcia')]: 'Estadística',
  [normalizarClave('Juan Carrascal Cabanillas')]: 'Administración',
  [normalizarClave('Vilma Méndez Gil')]: 'Física',
  [normalizarClave('Vilma Mendez Gil')]: 'Física',
  [normalizarClave('Sheyla Laura Escobedo Rodríguez')]: 'CC. Psicológicas',
  [normalizarClave('Sheyla Laura Escobedo Rodriguez')]: 'CC. Psicológicas',

  [normalizarClave('Luis Boy Chavil')]: 'Ing. de Sistemas',
  [normalizarClave('Robert Jerry Sánchez Ticona')]: 'Ing. de Sistemas',
  [normalizarClave('Robert Jerry Sanchez Ticona')]: 'Ing. de Sistemas',
  [normalizarClave('César Arellano Salazar')]: 'Ing. de Sistemas',
  [normalizarClave('Cesar Arellano Salazar')]: 'Ing. de Sistemas',
  [normalizarClave('Camilo Suárez Rebaza')]: 'Ing. de Sistemas',
  [normalizarClave('Camilo Suarez Rebaza')]: 'Ing. de Sistemas',
  [normalizarClave('Marcos Baca López')]: 'Ing. Industrial',
  [normalizarClave('Marcos Baca Lopez')]: 'Ing. Industrial',
  [normalizarClave('Ana Cuadra Mitzugaray')]: 'Contabilidad y Finanzas',

  [normalizarClave('Juan Pedro Santos Fernández')]: 'Ing. de Sistemas',
  [normalizarClave('Juan Pedro Santos Fernandez')]: 'Ing. de Sistemas',
  [normalizarClave('Ricardo Mendoza Rivera')]: 'Ing. de Sistemas',
  [normalizarClave('Óscar Romel Alcántara Moreno')]: 'Ing. de Sistemas',
  [normalizarClave('Oscar Romel Alcantara Moreno')]: 'Ing. de Sistemas',
  [normalizarClave('Jhoe Gonzalez Vasquez')]: 'Ing. Industrial',
  [normalizarClave('José Gómez Ávila')]: 'Ing. de Sistemas',
  [normalizarClave('Jose Gomez Avila')]: 'Ing. de Sistemas',
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
  return DEPARTAMENTOS_DOCENTE[normalizarClave(nombreDocente)] ?? '';
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

type MetadatosCursoExcel = {
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
};

// Metadatos usados para la tabla superior del Excel.
// Se trabaja por CÓDIGO de curso porque algunos cursos tienen nombres parecidos,
// por ejemplo IS-101 y EG-101, pero no tienen la misma distribución T/P/L.
const METADATOS_CURSO_EXCEL: Record<string, MetadatosCursoExcel> = {
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

const getMetadatosCursoExcel = (h: any): MetadatosCursoExcel => {
  const codigo = String(h.curso?.codigo ?? '').toUpperCase().trim();
  const override = METADATOS_CURSO_EXCEL[codigo];

  if (override) return override;

  return {
    horasTeoria: Number(h.curso?.horasTeoria ?? 0),
    horasPractica: Number(h.curso?.horasPractica ?? 0),
    horasLaboratorio: Number(h.curso?.horasLaboratorio ?? 0),
  };
};

const PRIORIDAD_CARRIL: Record<string, number> = {
  'FIS-301': 1,
  'IS-303': 2,

  'IS-902B': 1,
  'IS-901B': 1,
  'IS-906': 2,
};

const ordenarBloquesParaCarriles = (a: any, b: any): number => {
  const aIni = String(a.horaInicio ?? '');
  const bIni = String(b.horaInicio ?? '');

  if (aIni !== bIni) return aIni.localeCompare(bIni);

  const aCodigo = String(a.curso?.codigo ?? '').toUpperCase();
  const bCodigo = String(b.curso?.codigo ?? '').toUpperCase();

  const aPrioridad = PRIORIDAD_CARRIL[aCodigo] ?? 9999;
  const bPrioridad = PRIORIDAD_CARRIL[bCodigo] ?? 9999;

  if (aPrioridad !== bPrioridad) {
    return aPrioridad - bPrioridad;
  }

  const aFin = String(a.horaFin ?? '');
  const bFin = String(b.horaFin ?? '');

  if (aFin !== bFin) return bFin.localeCompare(aFin);

  return (a.__ordenOriginal ?? 0) - (b.__ordenOriginal ?? 0);
};

const nombreCursoCorto = (nombre?: string, maxWords = 4): string => {
  if (!nombre) return '';
  return nombre.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
};

const docenteKey = (h: any): string =>
  h.docenteId ??
  h.docente?.id ??
  `${h.docente?.usuario?.apellidos ?? h.docente?.apellidos ?? ''}-${h.docente?.usuario?.nombre ?? h.docente?.nombre ?? ''}`;

const colLetter = (n: number): string => {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};



const applyStyle = (cell: ExcelJS.Cell, style: Partial<ExcelJS.Style>): void => {
  if (style.fill) cell.fill = style.fill;
  if (style.font) cell.font = style.font;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
  if (style.numFmt) cell.numFmt = style.numFmt;
};

const styleRange = (
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  style: Partial<ExcelJS.Style>
): void => {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      applyStyle(ws.getCell(r, c), style);
    }
  }
};

const mergeAndStyle = (
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  value: ExcelJS.CellValue,
  style: Partial<ExcelJS.Style>
): ExcelJS.Cell => {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  const cell = ws.getCell(r1, c1);
  cell.value = value;
  styleRange(ws, r1, c1, r2, c2, style);
  return cell;
};

const headerStyle: Partial<ExcelJS.Style> = {
  fill: headerFill,
  font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: borderThin,
};

const horaStyle = (thickTop = false): Partial<ExcelJS.Style> => ({
  fill: horaFill,
  font: { bold: true, size: 9 },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: thickTop ? borderMediumTop : borderThin,
});

const blankStyle = (thickTop = false): Partial<ExcelJS.Style> => ({
  fill: whiteFill,
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: thickTop ? borderMediumTop : borderThin,
});

const blockStyle = (argb: string, fontSize = 8, thickTop = false): Partial<ExcelJS.Style> => ({
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb } },
  font: { bold: true, size: fontSize, color: { argb: 'FF000000' } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: thickTop ? borderMediumTop : borderThin,
});

const getAvailableRanges = (
  row: number,
  c1: number,
  c2: number,
  ocupado: Set<string>
): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  let start: number | null = null;

  for (let c = c1; c <= c2; c++) {
    const key = `${row}-${c}`;
    if (!ocupado.has(key)) {
      if (start === null) start = c;
    } else if (start !== null) {
      ranges.push([start, c - 1]);
      start = null;
    }
  }

  if (start !== null) ranges.push([start, c2]);
  return ranges;
};

const marcarOcupado = (
  ocupado: Set<string>,
  r1: number,
  c1: number,
  r2: number,
  c2: number
): void => {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) ocupado.add(`${r}-${c}`);
  }
};

const dividirColumnas = (
  c1: number,
  c2: number,
  partes: number
): Array<[number, number]> => {
  const total = c2 - c1 + 1;
  if (partes <= 1) return [[c1, c2]];
  if (partes > total) return [[c1, c2]];

  const result: Array<[number, number]> = [];
  let actual = c1;
  for (let i = 0; i < partes; i++) {
    const restantesCols = c2 - actual + 1;
    const restantesPartes = partes - i;
    const ancho = Math.max(1, Math.floor(restantesCols / restantesPartes));
    const end = i === partes - 1 ? c2 : actual + ancho - 1;
    result.push([actual, end]);
    actual = end + 1;
  }
  return result;
};

function getDocentesUnicosYHorariosNormalizados(
  horarios: HorarioCalendarItem[],
  format: 'grid' | 'table'
) {
  const COLORES_UNT = format === 'grid' ? COLORES_UNT_GRILLA : COLORES_UNT_TABLA;
  const normalizedHorarios = horarios.map((h, index) => ({
    ...h,
    __ordenOriginal: index,
    diaSemana: normalizarDia(h.diaSemana),
    horaInicio: normalizeTime(h.horaInicio),
    horaFin: normalizeTime(h.horaFin)
  }));

  const seenDocs = new Map<string, any>();

  for (const h of normalizedHorarios) {
    const docId = docenteKey(h);
    const key = `${docId}||${h.curso?.codigo ?? ''}`;

    if (!seenDocs.has(key)) {
      const bloquesDocenteCurso = normalizedHorarios.filter(x => {
        const xDocId = docenteKey(x);
        return xDocId === docId && x.curso?.codigo === h.curso?.codigo;
      });

      const metadatosExcel = getMetadatosCursoExcel(h);
      const horasT = Number(metadatosExcel.horasTeoria ?? 0);
      const horasP = Number(metadatosExcel.horasPractica ?? 0);
      const horasL = Number(metadatosExcel.horasLaboratorio ?? 0);

      // Cuenta todos los grupos reales del curso: A, B, C, etc.
      const gruposTodos = new Set(
        bloquesDocenteCurso
          .map(bloque => String(bloque.grupo?.nombre ?? 'A').trim())
          .filter(Boolean)
      );

      const cantidadGruposGeneral = Math.max(gruposTodos.size, 1);

      // Solo los grupos de laboratorio multiplican las horas L.
      const gruposLaboratorio = new Set(
        bloquesDocenteCurso
          .filter(bloque => getTipoBloque(bloque) === 'LABORATORIO')
          .map(bloque => String(bloque.grupo?.nombre ?? 'A').trim())
          .filter(Boolean)
      );

      const cantidadGruposLab = horasL > 0 ? Math.max(gruposLaboratorio.size, 1) : 0;
      const totalHoras = horasT + horasP + (horasL > 0 ? horasL * cantidadGruposLab : 0);

      seenDocs.set(key, {
        nombre: getNombreDocente(h),
        asignatura: h.curso?.nombre ?? '',
        cursoCodigo: h.curso?.codigo ?? '',
        horasT: formatearNumero(horasT),
        horasP: formatearNumero(horasP),
        horasL: formatearNumero(horasL),
        grupos: cantidadGruposGeneral,
        totalHoras: formatearNumero(totalHoras),
        departamento: getDepartamentoDocente(h),
        docId,
        key,
      });
    }
  }

  const docentesUnicos = Array.from(seenDocs.values());
  docentesUnicos.sort((a, b) => {
    const prioridad = (codigo: string) =>
      codigo.startsWith('IS-') ? 1 : codigo.startsWith('EG-') ? 2 : 3;

    if (prioridad(a.cursoCodigo) !== prioridad(b.cursoCodigo)) {
      return prioridad(a.cursoCodigo) - prioridad(b.cursoCodigo);
    }
    return a.cursoCodigo.localeCompare(b.cursoCodigo);
  });

  docentesUnicos.forEach((doc, idx) => {
    doc.numero = idx + 1;
    doc.colorArgb = COLORES_UNT[idx % COLORES_UNT.length].argb;
    seenDocs.set(doc.key, doc);
  });

  return { normalizedHorarios, docentesUnicos, seenDocs };
}

export async function appendHorarioToExcelWorksheet(
  ws: ExcelJS.Worksheet,
  startRow: number,
  horarios: HorarioCalendarItem[],
  titulo: string,
  subtitulo = '',
  opciones: { mostrarEstudiosGeneralesMiercoles?: boolean, diasMostrados?: string[], format?: 'table' | 'grid' } = {}
): Promise<number> {
  console.log('appendHorarioToExcelWorksheet options:', opciones);
  const { format = 'grid' } = opciones;
  console.log('appendHorarioToExcelWorksheet format:', format);

  const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
    ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
    : DIAS_GRILLA;

  const diaStartCol = (dia: string): number => {
    const idx = diasRender.indexOf(dia);
    return PRIMER_DIA_COL + Math.max(0, idx) * ANCHO_DIA;
  };

  const diaEndCol = (dia: string): number => diaStartCol(dia) + ANCHO_DIA - 1;

  const ULTIMA_COL = PRIMER_DIA_COL + Math.max(0, diasRender.length) * ANCHO_DIA;
  const HORA_COL_DER = ULTIMA_COL + 1;

  const { normalizedHorarios, docentesUnicos, seenDocs } = getDocentesUnicosYHorariosNormalizados(horarios, format);

  const ciclo = extraerCiclo(normalizedHorarios, titulo, subtitulo);
  const mostrarEstudiosGeneralesMiercoles = debeMostrarEstudiosGeneralesMiercoles(
    normalizedHorarios,
    ciclo,
    opciones.mostrarEstudiosGeneralesMiercoles
  );

  // Configure column widths only on the first block to avoid repeating and messing up widths
  if (startRow === 1) {
    if (format === 'grid') {
      for (let c = 1; c <= HORA_COL_DER; c++) {
        ws.getColumn(c).width = c === HORA_COL_IZQ || c === HORA_COL_DER ? 8 : 7.2;
      }
    } else {
      ws.getColumn(1).width = 14; // Hora
      ws.getColumn(2).width = 7;  // N°
      ws.getColumn(3).width = 40; // Curso
      ws.getColumn(4).width = 35; // Docente
      ws.getColumn(5).width = 25; // Ambiente
      ws.getColumn(6).width = 12; // Grupo
      ws.getColumn(7).width = 14; // Estado
    }
  }

  // Aumentar altura de las primeras filas para el encabezado
  for (let r = 0; r < 4; r++) {
    ws.getRow(startRow + r).height = r === 0 ? 30 : 20;
  }

  // Título principal institucional
  mergeAndStyle(ws, startRow, 1, startRow, format === 'grid' ? HORA_COL_DER : 7, 'UNIVERSIDAD NACIONAL DE TRUJILLO', {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
    font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });

  // Subtítulo 1
  mergeAndStyle(ws, startRow + 1, 1, startRow + 1, format === 'grid' ? HORA_COL_DER : 7, 'FACULTAD DE INGENIERÍA', {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFF6' } },
    font: { bold: true, size: 10.5, color: { argb: 'FF1A365D' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });

  // Subtítulo 2
  mergeAndStyle(ws, startRow + 2, 1, startRow + 2, format === 'grid' ? HORA_COL_DER : 7, 'ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS', {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
    font: { bold: true, size: 10, color: { argb: 'FF475569' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });

  // Fecha y título del documento
  const fechaGeneracion = new Date().toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  mergeAndStyle(ws, startRow + 3, 1, startRow + 3, format === 'grid' ? Math.floor(HORA_COL_DER / 2) : 3, `${titulo || 'HORARIO ACADÉMICO'}`, {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  });
  mergeAndStyle(ws, startRow + 3, format === 'grid' ? Math.floor(HORA_COL_DER / 2) + 1 : 4, startRow + 3, format === 'grid' ? HORA_COL_DER : 7, `Generado el: ${fechaGeneracion}`, {
    font: { size: 9, color: { argb: 'FF64748B' } },
    alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
  });

  let currentRow = startRow + 5;

  if (format === 'grid') {
    const dataStartRow = currentRow;
    
    // Encabezados de la tabla de docentes
    ws.getRow(dataStartRow).height = 24;
    mergeAndStyle(ws, dataStartRow, 1, dataStartRow, 4, 'DATOS INSTITUCIONALES', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 5, dataStartRow, 5, 'N°', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 6, dataStartRow, 9, 'DOCENTE', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 10, dataStartRow, 13, 'ASIGNATURA', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 14, dataStartRow, 14, 'T', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 15, dataStartRow, 15, 'P', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 16, dataStartRow, 16, 'L', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 17, dataStartRow, 17, 'G', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 18, dataStartRow, 18, 'T. HORAS', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });
    mergeAndStyle(ws, dataStartRow, 19, dataStartRow, HORA_COL_DER - 1, 'DEPARTAMENTO', {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: borderThin,
    });

    const totalFilasDocentes = Math.max(11, docentesUnicos.length);

    for (let i = 0; i < totalFilasDocentes; i++) {
      const excelRow = dataStartRow + 1 + i;
      const row = ws.getRow(excelRow);
      row.height = 22;

      const doc = docentesUnicos[i];
      const bgArgb = doc?.colorArgb ?? 'FFFFFFFF';

      if (i === 0) {
        mergeAndStyle(ws, excelRow, 1, excelRow + 2, 4, 'ESCUELA: INGENIERÍA DE SISTEMAS\nCICLO: ' + (ciclo || '—') + '\nAÑO: ' + new Date().getFullYear(), {
          font: { bold: true, size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: borderThin,
        });
      } else if (i === 3) {
        const semestre = extraerSemestre(subtitulo || titulo || '');
        mergeAndStyle(ws, excelRow, 1, excelRow, 4, `SECCIÓN: A    SEMESTRE: ${semestre}`, {
          font: { color: { argb: 'FF1A365D' }, bold: true, size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: borderThin,
        });
      } else if (i === 5) {
        mergeAndStyle(ws, excelRow, 1, excelRow, 4, 'Inicio del Ciclo: 13-04-2026', {
          font: { color: { argb: 'FFC00000' }, bold: true, size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: borderThin,
        });
      } else if (i === 6) {
        mergeAndStyle(ws, excelRow, 1, excelRow, 4, 'Término del Ciclo: 08-08-2026', {
          font: { color: { argb: 'FFC00000' }, bold: true, size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: borderThin,
        });
      } else if (i === 4 || i >= 7) {
        mergeAndStyle(ws, excelRow, 1, excelRow, 4, '', {
          border: borderThin,
        });
      }

      const docenteFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };

      const docBaseStyle: Partial<ExcelJS.Style> = {
        fill: docenteFill,
        font: { size: 8 },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: borderThin,
      };

      mergeAndStyle(ws, excelRow, 5, excelRow, 5, doc ? doc.numero : '', {
        fill: docenteFill,
        font: { size: 9, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borderThin,
      });

      mergeAndStyle(ws, excelRow, 6, excelRow, 9, doc?.nombre ?? '', docBaseStyle);
      mergeAndStyle(ws, excelRow, 10, excelRow, 13, doc?.asignatura ?? '', docBaseStyle);
      mergeAndStyle(ws, excelRow, 14, excelRow, 14, doc?.horasT ?? '', {
        ...docBaseStyle,
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      mergeAndStyle(ws, excelRow, 15, excelRow, 15, doc?.horasP ?? '', {
        ...docBaseStyle,
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      mergeAndStyle(ws, excelRow, 16, excelRow, 16, doc?.horasL ?? '', {
        ...docBaseStyle,
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      mergeAndStyle(ws, excelRow, 17, excelRow, 17, doc?.grupos ?? '', {
        ...docBaseStyle,
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      mergeAndStyle(ws, excelRow, 18, excelRow, 18, doc?.totalHoras ?? '', {
        ...docBaseStyle,
        font: { size: 9, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      mergeAndStyle(ws, excelRow, 19, excelRow, HORA_COL_DER - 1, doc?.departamento ?? '', docBaseStyle);
    }

    currentRow = dataStartRow + totalFilasDocentes + 2 + 1;

    // ─────────────────────────────────────────────
    // 5. Tabla inferior: grilla semanal
    // ─────────────────────────────────────────────
    const sepRow = currentRow - 1;
    ws.getRow(sepRow).height = 5;

    const grillaStartRow = sepRow + 1;
    ws.getRow(grillaStartRow).height = 20;

    mergeAndStyle(ws, grillaStartRow, HORA_COL_IZQ, grillaStartRow, HORA_COL_IZQ, 'HORA', headerStyle);

    diasRender.forEach(dia => {
      mergeAndStyle(
        ws,
        grillaStartRow,
        diaStartCol(dia),
        grillaStartRow,
        diaEndCol(dia),
        DIA_LABELS[dia],
        headerStyle
      );
    });

    mergeAndStyle(ws, grillaStartRow, HORA_COL_DER, grillaStartRow, HORA_COL_DER, 'HORA', headerStyle);

    const ocupado = new Set<string>();

    const crearBloque = (
      r1: number,
      c1: number,
      r2: number,
      c2: number,
      value: ExcelJS.CellValue,
      style: Partial<ExcelJS.Style>
    ): void => {
      mergeAndStyle(ws, r1, c1, r2, c2, value, style);
      marcarOcupado(ocupado, r1, c1, r2, c2);
    };

    const crearVacios = (row: number, c1: number, c2: number, thickTop: boolean): void => {
      const libres = getAvailableRanges(row, c1, c2, ocupado);
      libres.forEach(([inicio, fin]) => {
        crearBloque(row, inicio, row, fin, '', blankStyle(thickTop));
      });
    };

    FRANJAS.forEach(({ ini, label }, franjaIdx) => {
      const excelRow = grillaStartRow + 1 + franjaIdx;
      const thickTop = ini === '13:00';
      const row = ws.getRow(excelRow);
      row.height = 32;

      mergeAndStyle(ws, excelRow, HORA_COL_IZQ, excelRow, HORA_COL_IZQ, label, horaStyle(thickTop));
      mergeAndStyle(ws, excelRow, HORA_COL_DER, excelRow, HORA_COL_DER, label, horaStyle(thickTop));

      diasRender.forEach(dia => {
        const c1 = diaStartCol(dia);
        const c2 = diaEndCol(dia);

        // Miércoles — Ciclo I: Estudios Generales, como en el PDF.
        if (dia === 'MIERCOLES' && mostrarEstudiosGeneralesMiercoles) {
          if (ini === '07:00') {
            crearBloque(excelRow, c1, excelRow + 5, c2, 'ESTUDIOS\nGENERALES', {
              fill: estudiosFill,
              font: { bold: true, size: 11 },
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              border: thickTop ? borderMediumTop : borderThin,
            });
            return;
          }

          if (ini === '13:00') {
            crearBloque(excelRow, c1, excelRow + 6, c2, 'ESTUDIOS\nGENERALES', {
              fill: estudiosFill,
              font: { bold: true, size: 11 },
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              border: borderMediumTop,
            });
            return;
          }
        }

        const libres = getAvailableRanges(excelRow, c1, c2, ocupado);
        if (libres.length === 0) return;

        const bloques = normalizedHorarios
          .filter(x =>
            normalizarDia(x.diaSemana) === dia &&
            x.horaInicio === ini
          )
          .sort(ordenarBloquesParaCarriles);

        if (bloques.length === 0) {
          crearVacios(excelRow, c1, c2, thickTop);
          return;
        }

        const columnasDisponibles = libres.flatMap(([inicio, fin]) =>
          Array.from({ length: fin - inicio + 1 }, (_, idx) => inicio + idx)
        );

        if (bloques.length > columnasDisponibles.length) {
          const span = Math.max(...bloques.map(h => calcSpanH(h.horaInicio, h.horaFin)));
          const contenido = bloques.map(h => {
            const docId = docenteKey(h);
            const key = `${docId}||${h.curso?.codigo ?? ''}`;
            const doc = seenDocs.get(key);
            const labelComp = getComponentLabel(h);
            const ambiente = formatAmbienteExcel(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '');
            
            if (span === 1) {
              const labelText = labelComp ? ` ${labelComp}` : '';
              return `${doc?.numero ?? ''}${labelText} (${ambiente.replace(/\n/g, ' ')})`;
            } else if (span === 2) {
              const labelText = labelComp ? ` ${labelComp}` : '';
              const curso = nombreCursoCorto(doc?.asignatura, 2);
              return `${doc?.numero ?? ''}${labelText} - ${curso} (${ambiente.replace(/\n/g, ' ')})`;
            } else {
              const curso = nombreCursoCorto(doc?.asignatura, 3);
              return `${doc?.numero ?? ''}${labelComp ? ` ${labelComp}` : ''}\n${curso}\n${ambiente}`;
            }
          }).join(span === 1 ? ' | ' : '\n────\n');

          libres.forEach(([inicio, fin], idxLibre) => {
            crearBloque(
              excelRow,
              inicio,
              excelRow + span - 1,
              fin,
              idxLibre === 0 ? contenido : '',
              blockStyle('FFFFFFFF', span === 1 ? 7 : 7.5, thickTop)
            );
          });
          return;
        }

        const hayHuecosEnLibres = columnasDisponibles.some((col, idx) =>
          idx > 0 && col !== columnasDisponibles[idx - 1] + 1
        );

        const rangosBloques = hayHuecosEnLibres
          ? bloques.map((_, idx) => {
            const col = columnasDisponibles[Math.min(idx, columnasDisponibles.length - 1)];
            return [col, col] as [number, number];
          })
          : dividirColumnas(columnasDisponibles[0], columnasDisponibles[columnasDisponibles.length - 1], bloques.length);

        bloques.forEach((h, idx) => {
          const docId = docenteKey(h);
          const key = `${docId}||${h.curso?.codigo ?? ''}`;
          const doc = seenDocs.get(key);
          const span = calcSpanH(h.horaInicio, h.horaFin);
          const [bc1, bc2] = rangosBloques[idx];
          const labelComp = getComponentLabel(h);
          const ambiente = formatAmbienteExcel(h.ambiente?.nombre ?? h.ambiente?.codigo ?? '');
          const curso = nombreCursoCorto(doc?.asignatura, bloques.length > 1 ? 3 : 4);
          
          let contenido = '';
          let fontSize = 8;

          if (span === 1) {
            const firstLine = labelComp ? `${doc?.numero ?? ''} ${labelComp}` : `${doc?.numero ?? ''}`;
            contenido = [firstLine, ambiente.replace(/\n/g, ' ')].filter(Boolean).join('\n');
            fontSize = bloques.length > 1 ? 7.5 : 8.5;
          } else if (span === 2) {
            const firstLine = labelComp ? `${doc?.numero ?? ''} ${labelComp}` : `${doc?.numero ?? ''}`;
            contenido = [firstLine, curso, ambiente].filter(Boolean).join('\n');
            fontSize = bloques.length > 1 ? 7.5 : 9;
          } else {
            contenido = [
              `${doc?.numero ?? ''}`,
              labelComp,
              curso,
              ambiente,
            ].filter(Boolean).join('\n');
            fontSize = bloques.length > 1 ? 8 : 9.5;
          }

          crearBloque(
            excelRow,
            bc1,
            excelRow + span - 1,
            bc2,
            contenido,
            blockStyle(doc?.colorArgb ?? 'FFFFFFFF', fontSize, thickTop)
          );
        });

        crearVacios(excelRow, c1, c2, thickTop);
      });
    });

    return grillaStartRow + FRANJAS.length;
  } else {
    // ─────────────────────────────────────────────
    // 5. Tabla inferior: listado por días
    // ─────────────────────────────────────────────
    const horariosOrdenados = [...normalizedHorarios].sort((a, b) => {
      const diaA = diasRender.indexOf(normalizarDia(a.diaSemana));
      const diaB = diasRender.indexOf(normalizarDia(b.diaSemana));
      if (diaA !== diaB) return diaA - diaB;
      const horaCompare = String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? ''));
      if (horaCompare !== 0) return horaCompare;
      return ordenarBloquesParaCarriles(a, b);
    });

    diasRender.forEach(dia => {
      const horariosDia = horariosOrdenados.filter(x => normalizarDia(x.diaSemana) === dia);

      if (horariosDia.length === 0) return;

      const headerRow = ws.getRow(currentRow);
      headerRow.height = 24;
      mergeAndStyle(ws, currentRow, 1, currentRow, 7, DIA_LABELS[dia], {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
        font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: borderThin,
      });

      currentRow++;

      const colHeaders = ['Horario', 'N°', 'Curso', 'Docente', 'Ambiente', 'Grupo', 'Estado'];
      colHeaders.forEach((header, idx) => {
        const cell = ws.getCell(currentRow, idx + 1);
        applyStyle(cell, {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFF6' } },
          font: { color: { argb: 'FF1A365D' }, bold: true, size: 10 },
          alignment: { horizontal: idx === 0 || idx === 1 || idx === 5 || idx === 6 ? 'center' : 'left', vertical: 'middle', wrapText: true },
          border: borderThin,
        });
        cell.value = header;
      });
      ws.getRow(currentRow).height = 20;
      currentRow++;

      horariosDia.forEach((h, index) => {
        const docId = docenteKey(h);
        const key = `${docId}||${h.curso?.codigo ?? ''}`;
        const doc = seenDocs.get(key);

        const row = ws.getRow(currentRow);
        row.height = 20;

        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF0F8FF';
        const docBaseStyle: Partial<ExcelJS.Style> = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
          font: { size: 10 },
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
          border: borderThin,
        };

        applyStyle(ws.getCell(currentRow, 1), { ...docBaseStyle, alignment: { ...docBaseStyle.alignment, horizontal: 'center' } });
        ws.getCell(currentRow, 1).value = `${h.horaInicio ?? ''} - ${h.horaFin ?? ''}`;

        applyStyle(ws.getCell(currentRow, 2), { ...docBaseStyle, alignment: { ...docBaseStyle.alignment, horizontal: 'center' } });
        ws.getCell(currentRow, 2).value = doc?.numero ?? '';

        applyStyle(ws.getCell(currentRow, 3), docBaseStyle);
        ws.getCell(currentRow, 3).value = h.curso?.codigo ? `${h.curso.codigo} ${h.curso?.nombre ?? ''}` : (h.curso?.nombre ?? '');

        applyStyle(ws.getCell(currentRow, 4), docBaseStyle);
        ws.getCell(currentRow, 4).value = getNombreDocente(h);

        applyStyle(ws.getCell(currentRow, 5), docBaseStyle);
        ws.getCell(currentRow, 5).value = h.ambiente?.nombre ?? h.ambiente?.codigo ?? '';

        applyStyle(ws.getCell(currentRow, 6), { ...docBaseStyle, alignment: { ...docBaseStyle.alignment, horizontal: 'center' } });
        ws.getCell(currentRow, 6).value = h.grupo?.nombre ?? '';

        applyStyle(ws.getCell(currentRow, 7), { ...docBaseStyle, alignment: { ...docBaseStyle.alignment, horizontal: 'center' } });
        ws.getCell(currentRow, 7).value = h.estado ?? '';

        currentRow++;
      });

      currentRow++;
    });

    return currentRow - 1;
  }
}

export async function appendHorarioToExcelWorkbook(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  horarios: HorarioCalendarItem[],
  titulo: string,
  subtitulo = '',
  opciones: { mostrarEstudiosGeneralesMiercoles?: boolean, diasMostrados?: string[], format?: 'table' | 'grid', includeListSheet?: boolean } = {}
): Promise<void> {
  const { format = 'grid', includeListSheet = false } = opciones;
  const ws = workbook.addWorksheet(sheetName);
  ws.properties.defaultRowHeight = 15;
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.25,
      bottom: 0.25,
      header: 0.1,
      footer: 0.1,
    },
  };

  const lastRow = await appendHorarioToExcelWorksheet(ws, 1, horarios, titulo, subtitulo, opciones);

  // Configurar printArea para el bloque principal
  if (format === 'grid') {
    const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
      ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
      : DIAS_GRILLA;
    const ULTIMA_COL = PRIMER_DIA_COL + Math.max(0, diasRender.length) * ANCHO_DIA;
    const HORA_COL_DER = ULTIMA_COL + 1;
    ws.pageSetup.printArea = `A1:${colLetter(HORA_COL_DER)}${lastRow}`;
    ws.pageSetup.printTitlesRow = '1:1';
  } else {
    ws.pageSetup.printArea = `A1:G${lastRow}`;
    ws.pageSetup.printTitlesRow = '1:1';
  }

  if (includeListSheet) {
    // ─────────────────────────────────────────────
    // 5. Hoja 2: listado detallado
    // ─────────────────────────────────────────────
    const wsListado = workbook.addWorksheet('Listado');
    wsListado.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
    wsListado.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.1,
        footer: 0.1,
      },
    };

    wsListado.columns = [
      { header: 'N°', key: 'numero', width: 7 },
      { header: 'Código', key: 'codigo', width: 13 },
      { header: 'Curso', key: 'curso', width: 36 },
      { header: 'Ciclo', key: 'ciclo', width: 9 },
      { header: 'Docente', key: 'docente', width: 36 },
      { header: 'Ambiente', key: 'ambiente', width: 18 },
      { header: 'Día', key: 'dia', width: 13 },
      { header: 'Inicio', key: 'inicio', width: 10 },
      { header: 'Fin', key: 'fin', width: 10 },
      { header: 'Horas', key: 'horas', width: 10 },
      { header: 'Grupo', key: 'grupo', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Estado', key: 'estado', width: 14 },
    ];

    wsListado.getRow(1).height = 20;
    wsListado.getRow(1).eachCell(cell => applyStyle(cell, headerStyle));

    const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
      ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
      : DIAS_GRILLA;

    const { normalizedHorarios, seenDocs } = getDocentesUnicosYHorariosNormalizados(horarios, format);

    const horariosOrdenados = [...normalizedHorarios].sort((a, b) => {
      const diaA = diasRender.indexOf(normalizarDia(a.diaSemana));
      const diaB = diasRender.indexOf(normalizarDia(b.diaSemana));
      if (diaA !== diaB) return diaA - diaB;
      const horaCompare = String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? ''));
      if (horaCompare !== 0) return horaCompare;
      return ordenarBloquesParaCarriles(a, b);
    });

    let listadoCurrentRow = 2;
    const ciclo = extraerCiclo(normalizedHorarios, titulo, subtitulo);

    diasRender.forEach(dia => {
      const horariosDia = horariosOrdenados.filter(x => normalizarDia(x.diaSemana) === dia);

      if (horariosDia.length === 0) return;

      // Add day header row
      const headerRow = wsListado.getRow(listadoCurrentRow);
      headerRow.height = 20;
      mergeAndStyle(wsListado, listadoCurrentRow, 1, listadoCurrentRow, 13, DIA_LABELS[dia], {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
        font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borderThin,
      });

      listadoCurrentRow++;

      // Add the items for this day
      horariosDia.forEach((h) => {
        const docId = docenteKey(h);
        const key = `${docId}||${h.curso?.codigo ?? ''}`;
        const doc = seenDocs.get(key);
        const row = wsListado.addRow({
          numero: doc?.numero ?? '',
          codigo: h.curso?.codigo ?? '',
          curso: h.curso?.nombre ?? '',
          ciclo: h.curso?.ciclo ?? ciclo,
          docente: getNombreDocente(h),
          ambiente: h.ambiente?.nombre ?? h.ambiente?.codigo ?? '',
          dia: '',
          inicio: h.horaInicio ?? '',
          fin: h.horaFin ?? '',
          horas: calcSpanH(h.horaInicio ?? '', h.horaFin ?? ''),
          grupo: h.grupo?.nombre ?? '',
          tipo: getComponentLabel(h) || h.tipoComponente || '',
          estado: h.estado ?? '',
        });

        row.height = 18;
        row.eachCell(cell => {
          cell.border = borderThin;
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
        listadoCurrentRow++;
      });
    });

    wsListado.autoFilter = {
      from: 'A1',
      to: `M${wsListado.rowCount}`,
    };
  }
}

export async function exportarHorarioExcel(
  horarios: HorarioCalendarItem[],
  titulo: string,
  subtitulo = '',
  opciones: { mostrarEstudiosGeneralesMiercoles?: boolean, diasMostrados?: string[], format?: 'table' | 'grid' } = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.created = new Date();

  await appendHorarioToExcelWorkbook(workbook, 'Horario Oficial', horarios, titulo, subtitulo, opciones);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const ciclo = extraerCiclo(horarios, titulo, subtitulo);
  const nombreArchivo = `horario_academico_unt_${ciclo ? `ciclo_${ciclo}_` : ''}${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  saveAs(blob, nombreArchivo);
}

export async function exportarHorariosTodosCiclosExcel(
  horarios: HorarioCalendarItem[],
  periodoNombre: string,
  opciones: { mostrarEstudiosGeneralesMiercoles?: boolean, diasMostrados?: string[], format?: 'table' | 'grid', includeListSheet?: boolean } = {}
): Promise<void> {
  const { format = 'grid', includeListSheet = false } = opciones;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.created = new Date();

  const ciclosUnicos = Array.from(new Set(horarios.map(h => normalizarCiclo(h.curso?.ciclo)).filter(Boolean)));
  const order = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  ciclosUnicos.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b);
  });

  if (ciclosUnicos.length === 0) {
    const ws = workbook.addWorksheet('Horario General');
    ws.properties.defaultRowHeight = 15;
    ws.views = [{ showGridLines: false }];
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0.1,
        footer: 0.1,
      },
    };
    const lastRow = await appendHorarioToExcelWorksheet(ws, 1, horarios, 'HORARIO ACADÉMICO', periodoNombre, opciones);
    if (format === 'grid') {
      const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
        ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
        : DIAS_GRILLA;
      const ULTIMA_COL = PRIMER_DIA_COL + Math.max(0, diasRender.length) * ANCHO_DIA;
      const HORA_COL_DER = ULTIMA_COL + 1;
      ws.pageSetup.printArea = `A1:${colLetter(HORA_COL_DER)}${lastRow}`;
    } else {
      ws.pageSetup.printArea = `A1:G${lastRow}`;
    }
  } else {
    for (let i = 0; i < ciclosUnicos.length; i++) {
      const ciclo = ciclosUnicos[i];
      const horariosCiclo = horarios.filter(h => normalizarCiclo(h.curso?.ciclo) === ciclo);
      if (horariosCiclo.length === 0) continue;

      const ws = workbook.addWorksheet(`Ciclo ${ciclo}`);
      ws.properties.defaultRowHeight = 15;
      ws.views = [{ showGridLines: false }];
      ws.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.25,
          bottom: 0.25,
          header: 0.1,
          footer: 0.1,
        },
      };

      const lastRow = await appendHorarioToExcelWorksheet(
        ws,
        1,
        horariosCiclo,
        'HORARIO ACADÉMICO',
        `${periodoNombre} - Ciclo ${ciclo}`,
        opciones
      );

      if (format === 'grid') {
        const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
          ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
          : DIAS_GRILLA;
        const ULTIMA_COL = PRIMER_DIA_COL + Math.max(0, diasRender.length) * ANCHO_DIA;
        const HORA_COL_DER = ULTIMA_COL + 1;
        ws.pageSetup.printArea = `A1:${colLetter(HORA_COL_DER)}${lastRow}`;
      } else {
        ws.pageSetup.printArea = `A1:G${lastRow}`;
      }
    }
  }

  if (includeListSheet) {
    const wsListado = workbook.addWorksheet('Listado');
    wsListado.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
    wsListado.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.1,
        footer: 0.1,
      },
    };

    wsListado.columns = [
      { header: 'N°', key: 'numero', width: 7 },
      { header: 'Código', key: 'codigo', width: 13 },
      { header: 'Curso', key: 'curso', width: 36 },
      { header: 'Ciclo', key: 'ciclo', width: 9 },
      { header: 'Docente', key: 'docente', width: 36 },
      { header: 'Ambiente', key: 'ambiente', width: 18 },
      { header: 'Día', key: 'dia', width: 13 },
      { header: 'Inicio', key: 'inicio', width: 10 },
      { header: 'Fin', key: 'fin', width: 10 },
      { header: 'Horas', key: 'horas', width: 10 },
      { header: 'Grupo', key: 'grupo', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Estado', key: 'estado', width: 14 },
    ];

    wsListado.getRow(1).height = 20;
    wsListado.getRow(1).eachCell(cell => applyStyle(cell, headerStyle));

    const { normalizedHorarios, seenDocs } = getDocentesUnicosYHorariosNormalizados(horarios, format);

    const diasRender = opciones.diasMostrados && opciones.diasMostrados.length > 0
      ? DIAS_GRILLA.filter(d => opciones.diasMostrados!.includes(d))
      : DIAS_GRILLA;

    const horariosOrdenados = [...normalizedHorarios].sort((a, b) => {
      const diaA = diasRender.indexOf(normalizarDia(a.diaSemana));
      const diaB = diasRender.indexOf(normalizarDia(b.diaSemana));
      if (diaA !== diaB) return diaA - diaB;
      const horaCompare = String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? ''));
      if (horaCompare !== 0) return horaCompare;
      return ordenarBloquesParaCarriles(a, b);
    });

    let listadoCurrentRow = 2;

    diasRender.forEach(dia => {
      const horariosDia = horariosOrdenados.filter(x => normalizarDia(x.diaSemana) === dia);
      if (horariosDia.length === 0) return;

      const headerRow = wsListado.getRow(listadoCurrentRow);
      headerRow.height = 20;
      mergeAndStyle(wsListado, listadoCurrentRow, 1, listadoCurrentRow, 13, DIA_LABELS[dia], {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } },
        font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borderThin,
      });

      listadoCurrentRow++;

      horariosDia.forEach((h) => {
        const docId = docenteKey(h);
        const key = `${docId}||${h.curso?.codigo ?? ''}`;
        const doc = seenDocs.get(key);
        const row = wsListado.addRow({
          numero: doc?.numero ?? '',
          codigo: h.curso?.codigo ?? '',
          curso: h.curso?.nombre ?? '',
          ciclo: h.curso?.ciclo ?? '',
          docente: getNombreDocente(h),
          ambiente: h.ambiente?.nombre ?? h.ambiente?.codigo ?? '',
          dia: '',
          inicio: h.horaInicio ?? '',
          fin: h.horaFin ?? '',
          horas: calcSpanH(h.horaInicio ?? '', h.horaFin ?? ''),
          grupo: h.grupo?.nombre ?? '',
          tipo: getComponentLabel(h) || h.tipoComponente || '',
          estado: h.estado ?? '',
        });

        row.height = 18;
        row.eachCell(cell => {
          cell.border = borderThin;
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
        listadoCurrentRow++;
      });
    });

    wsListado.autoFilter = {
      from: 'A1',
      to: `M${wsListado.rowCount}`,
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const sanitize = (name: string) => name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const nombreArchivo = `Horarios_x_ciclos_${sanitize(periodoNombre)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, nombreArchivo);
}
