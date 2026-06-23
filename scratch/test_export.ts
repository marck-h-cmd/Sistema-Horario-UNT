import ExcelJS from 'c:/Users/Usuario/Documents/ghitub/E-PROJECT/node_modules/exceljs';
import path from 'path';
import { appendHorarioToExcelWorksheet } from '../../../../Documents/ghitub/E-PROJECT/src/utils/exportarHorarioExcel';

const mockHorarios = [
  // Ciclo I
  {
    diaSemana: 'LUNES',
    horaInicio: '07:00',
    horaFin: '09:00',
    tipoComponente: 'TEORIA',
    curso: { codigo: 'IS-101', nombre: 'Introducción a la Programación', ciclo: 'I' },
    docente: { nombre: 'Marcelino', apellidos: 'Torres Villanueva' },
    ambiente: { nombre: 'Posgrado A-307', codigo: 'A-307' },
    grupo: { nombre: 'A' },
    estado: 'CONFIRMADO'
  },
  // Ciclo III
  {
    diaSemana: 'MARTES',
    horaInicio: '09:00',
    horaFin: '13:00',
    tipoComponente: 'TEORIA',
    curso: { codigo: 'IS-301', nombre: 'Programación Orientada a Objetos II', ciclo: 'III' },
    docente: { nombre: 'Zoraida', apellidos: 'Vidal Melgarejo' },
    ambiente: { nombre: 'Lab. 2', codigo: 'Lab-2' },
    grupo: { nombre: 'C' },
    estado: 'CONFIRMADO'
  },
  // Ciclo V
  {
    diaSemana: 'MIERCOLES',
    horaInicio: '09:00',
    horaFin: '13:00',
    tipoComponente: 'TEORIA',
    curso: { codigo: 'IS-502', nombre: 'Sistemas de Información', ciclo: 'V' },
    docente: { nombre: 'Juan Carlos', apellidos: 'Obando Roldan' },
    ambiente: { nombre: 'Lab. 1', codigo: 'Lab-1' },
    grupo: { nombre: 'A' },
    estado: 'CONFIRMADO'
  }
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Horarios por Ciclo');
  ws.properties.defaultRowHeight = 15;
  ws.views = [{ showGridLines: false }];

  const ciclosUnicos = ['I', 'III', 'V'];
  
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: ciclosUnicos.length,
    horizontalCentered: true,
  };

  const DIAS_GRILLA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const PRIMER_DIA_COL = 2;
  const ANCHO_DIA = 4;
  const colLetter = (n: number): string => {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  let startRow = 1;

  for (let i = 0; i < ciclosUnicos.length; i++) {
    const ciclo = ciclosUnicos[i];
    const horariosCiclo = mockHorarios.filter(h => h.curso.ciclo === ciclo);

    const lastRow = await appendHorarioToExcelWorksheet(
      ws,
      startRow,
      horariosCiclo as any,
      'HORARIO ACADÉMICO',
      `Test Period - Ciclo ${ciclo}`,
      { format: 'grid' }
    );

    console.log(`Cycle ${ciclo} written from row ${startRow} to ${lastRow}`);

    if (i < ciclosUnicos.length - 1) {
      // Leave 2 blank rows for spacing in normal view, and add page break on the second blank row
      ws.getRow(lastRow + 2).addPageBreak();
      console.log(`Page break added at row ${lastRow + 2}`);
      startRow = lastRow + 3;
    } else {
      startRow = lastRow;
    }
  }

  const ULTIMA_COL = PRIMER_DIA_COL + 6 * ANCHO_DIA; // 2 + 24 = 26
  const HORA_COL_DER = ULTIMA_COL + 1; // 27
  ws.pageSetup.printArea = `A1:${colLetter(HORA_COL_DER)}${startRow}`;

  const destPath = path.join(__dirname, '..', 'test_stacked.xlsx');
  await workbook.xlsx.writeFile(destPath);
  console.log(`Workbook written to ${destPath}`);
}

main().catch(console.error);
