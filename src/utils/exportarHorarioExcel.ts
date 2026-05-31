import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { HorarioCalendarItem } from '@/components/horarios/HorarioWeeklyCalendar';

const EXCEL_COLORES_CURSO = [
  { bg: 'FFDBEAFE', text: 'FF1E3A8A' }, // Blue
  { bg: 'FFDCEFDB', text: 'FF14532D' }, // Green
  { bg: 'FFF3E8FF', text: 'FF581C87' }, // Purple
  { bg: 'FFFEF3C7', text: 'FF78350F' }, // Amber
  { bg: 'FFFFE4E6', text: 'FF881337' }, // Rose
  { bg: 'FFCCFBF1', text: 'FF0F766E' }, // Teal
  { bg: 'FFFFEDD5', text: 'FF7C2D12' }, // Orange
  { bg: 'FFCFFAFE', text: 'FF155E75' }, // Cyan
];

const getExcelColorForCurso = (cursoCodigo: string) => {
  let hash = 0;
  for (let i = 0; i < cursoCodigo.length; i++) {
    hash = cursoCodigo.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXCEL_COLORES_CURSO.length;
  return EXCEL_COLORES_CURSO[index];
};

export async function exportarHorarioExcel(
  horarios: HorarioCalendarItem[],
  titulo: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.created = new Date();

  // HOJA 1: CALENDARIO (Vista de Grilla con carriles y fusiones)
  const wsCalendario = workbook.addWorksheet('Calendario');
  
  const diasKeys = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  const diasLabel: Record<string, string> = {
    LUNES: 'LUNES',
    MARTES: 'MARTES',
    MIERCOLES: 'MIÉRCOLES',
    JUEVES: 'JUEVES',
    VIERNES: 'VIERNES'
  };

  const parseTime = (t: string) => parseInt(t.split(':')[0], 10);

  // Agrupar en lanes (carriles) por día
  const dayLanesMap: Record<string, HorarioCalendarItem[][]> = {};
  diasKeys.forEach(d => {
    const dayClasses = horarios.filter(h => h.diaSemana === d && h.estado !== 'CANCELADO');
    const lanes: HorarioCalendarItem[][] = [];
    const sortedClasses = [...dayClasses].sort((a, b) => parseTime(a.horaInicio) - parseTime(b.horaInicio));

    sortedClasses.forEach(c => {
      const start = parseTime(c.horaInicio);
      const end = parseTime(c.horaFin);

      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const hasOverlap = lanes[i].some(existing => {
          const estart = parseTime(existing.horaInicio);
          const eend = parseTime(existing.horaFin);
          return Math.max(start, estart) < Math.min(end, eend);
        });
        if (!hasOverlap) {
          lanes[i].push(c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([c]);
      }
    });

    if (lanes.length === 0) {
      lanes.push([]);
    }
    dayLanesMap[d] = lanes;
  });

  // Mapear columnas virtuales
  const colMap: Array<{ day: string; laneIndex: number }> = [];
  diasKeys.forEach(d => {
    const lanes = dayLanesMap[d];
    lanes.forEach((_, idx) => {
      colMap.push({ day: d, laneIndex: idx });
    });
  });

  const totalCols = 1 + colMap.length; // Columna A (Hora) + columnas de carriles

  // Fila 1: Título
  wsCalendario.getRow(1).height = 30;
  const startColLetter = 'A';
  const endColLetter = String.fromCharCode(65 + totalCols - 1);
  wsCalendario.mergeCells(`${startColLetter}1:${endColLetter}1`);
  
  const tituloCell = wsCalendario.getCell('A1');
  tituloCell.value = titulo;
  tituloCell.font = { size: 16, bold: true, color: { argb: 'FF1A365D' } };
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 2: Cabecera de días (fusionados horizontalmente según carriles)
  const headerRow = wsCalendario.getRow(2);
  headerRow.height = 24;

  // HORA en Columna 1 (A)
  headerRow.getCell(1).value = 'HORA';

  let currentExcelCol = 2; // Inicia en columna B (index 2)
  const dayColRanges: Record<string, { start: number; end: number }> = {};
  
  diasKeys.forEach(d => {
    const numLanes = dayLanesMap[d].length;
    dayColRanges[d] = {
      start: currentExcelCol,
      end: currentExcelCol + numLanes - 1
    };
    
    // Escribir el día en la primera columna del rango
    headerRow.getCell(currentExcelCol).value = diasLabel[d];

    // Si tiene más de 1 carril, fusionar horizontalmente
    if (numLanes > 1) {
      wsCalendario.mergeCells(2, currentExcelCol, 2, currentExcelCol + numLanes - 1);
    }
    currentExcelCol += numLanes;
  });

  // Estilo de la cabecera
  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } }; // bg-[#1a365d]
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { 
      top: { style: 'thin', color: { argb: 'FF0F172A' } }, 
      left: { style: 'thin', color: { argb: 'FF0F172A' } }, 
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }, 
      right: { style: 'thin', color: { argb: 'FF0F172A' } } 
    };
  }

  // Establecer anchos de columna dinámicos
  wsCalendario.getColumn(1).width = 16; // HORA
  const laneColWidth = colMap.length > 8 ? 16 : colMap.length > 5 ? 20 : 25;
  for (let c = 2; c <= totalCols; c++) {
    wsCalendario.getColumn(c).width = laneColWidth;
  }

  // Dibujar filas de horas y clases fusionadas
  // Grid 2D virtual para no sobrescribir celdas ocupadas por rowspan
  const isExcelCovered: boolean[][] = Array.from({ length: 14 }, () => Array(totalCols + 1).fill(false));

  for (let r = 0; r < 14; r++) {
    const startHour = 7 + r;
    const endHour = startHour + 1;
    const sheetRowIndex = 3 + r; // Fila Excel
    
    const row = wsCalendario.getRow(sheetRowIndex);
    row.height = 42; // Altura cómoda para ver la info

    // Columna A: HORA
    const horaCell = row.getCell(1);
    horaCell.value = `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`;
    horaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    horaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100
    horaCell.font = { bold: true, size: 8.5, color: { argb: 'FF64748B' } }; // text-slate-500
    horaCell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    for (let colIdx = 1; colIdx <= colMap.length; colIdx++) {
      const excelCol = 1 + colIdx; // Columna B en adelante
      const { day, laneIndex } = colMap[colIdx - 1];

      if (isExcelCovered[r][excelCol]) {
        continue; // Celda ocupada por merge vertical anterior
      }

      const laneClasses = dayLanesMap[day][laneIndex];
      const startingClass = laneClasses.find(c => parseTime(c.horaInicio) === startHour);

      const cell = row.getCell(excelCol);

      if (startingClass) {
        const duration = parseTime(startingClass.horaFin) - parseTime(startingClass.horaInicio);
        const endRowIndex = sheetRowIndex + duration - 1;

        // Escribir contenido estructurado
        const isLab = startingClass.ambiente ? startingClass.ambiente.codigo.toUpperCase().includes('LAB') : false;
        const docName = startingClass.docente?.usuario 
          ? `${startingClass.docente.usuario.nombre} ${startingClass.docente.usuario.apellidos}`
          : '';
        const ambCodigo = startingClass.ambiente ? startingClass.ambiente.codigo : 'No asignado';
          
        cell.value = `${startingClass.curso.codigo}\n${startingClass.curso.nombre}\n[${isLab ? 'LABORATORIO' : 'TEORÍA'}]\nAmb: ${ambCodigo}\n${docName}${startingClass.grupo?.nombre ? `\nGr: ${startingClass.grupo.nombre}` : ''}`;
        cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

        // Fusión vertical para la duración del bloque
        if (duration > 1) {
          wsCalendario.mergeCells(sheetRowIndex, excelCol, endRowIndex, excelCol);
          for (let k = 1; k < duration; k++) {
            if (r + k < 14) {
              isExcelCovered[r + k][excelCol] = true;
            }
          }
        }

        // Aplicar estilos a todas las celdas del bloque (para mantener bordes en Excel)
        const colors = getExcelColorForCurso(startingClass.curso.codigo);
        for (let rOffset = 0; rOffset < duration; rOffset++) {
          const currentCell = wsCalendario.getCell(sheetRowIndex + rOffset, excelCol);
          currentCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colors.bg }
          };
          currentCell.font = {
            color: { argb: colors.text },
            bold: true,
            size: colMap.length > 8 ? 8 : colMap.length > 5 ? 8.5 : 9
          };
          currentCell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        }
      } else {
        // Celda vacía
        cell.value = '';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }
    }
  }

  // Fila de Totales en el Excel
  const footerRowIndex = 17;
  const footerRow = wsCalendario.getRow(footerRowIndex);
  footerRow.height = 24;
  footerRow.getCell(1).value = 'TOTALES';
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  footerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  footerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // slate-700
  footerRow.getCell(1).border = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } }
  };

  // Sumar horas por día en el pie
  diasKeys.forEach(d => {
    const range = dayColRanges[d];
    
    // Obtener la suma de horas del día
    const dayClasses = horarios.filter(h => h.diaSemana === d && h.estado !== 'CANCELADO');
    const horasDia = dayClasses.reduce((acc, curr) => {
      const dur = parseTime(curr.horaFin) - parseTime(curr.horaInicio);
      return acc + dur;
    }, 0);

    // Escribir el total en el primer carril y fusionar si corresponde
    footerRow.getCell(range.start).value = `${horasDia}h`;
    
    if (range.end > range.start) {
      wsCalendario.mergeCells(footerRowIndex, range.start, footerRowIndex, range.end);
    }

    for (let c = range.start; c <= range.end; c++) {
      const cell = footerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // slate-700
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF0F172A' } }
      };
    }
  });


  // HOJA 2: LISTADO DETALLADO (Para facil filtrado y reportes tabulares)
  const wsListado = workbook.addWorksheet('Listado');
  wsListado.columns = [
    { header: 'Código Curso', key: 'codigo', width: 15 },
    { header: 'Curso', key: 'curso', width: 35 },
    { header: 'Ciclo', key: 'ciclo', width: 10 },
    { header: 'Docente', key: 'docente', width: 35 },
    { header: 'Ambiente', key: 'ambiente', width: 15 },
    { header: 'Día', key: 'dia', width: 15 },
    { header: 'Inicio', key: 'inicio', width: 10 },
    { header: 'Fin', key: 'fin', width: 10 },
    { header: 'Grupo', key: 'grupo', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 }
  ];

  wsListado.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  });

  horarios.forEach(h => {
    wsListado.addRow({
      codigo: h.curso.codigo,
      curso: h.curso.nombre,
      ciclo: h.curso.ciclo,
      docente: h.docente?.usuario ? `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}` : '-',
      ambiente: h.ambiente ? h.ambiente.codigo : 'No asignado',
      dia: h.diaSemana ? (diasLabel[h.diaSemana] || h.diaSemana) : 'No asignado',
      inicio: h.horaInicio || '-',
      fin: h.horaFin || '-',
      grupo: h.grupo?.nombre || '-',
      estado: h.estado
    });
  });

  // Estilo al listado
  wsListado.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // Generar buffer y descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'horario_academico.xlsx');
}
