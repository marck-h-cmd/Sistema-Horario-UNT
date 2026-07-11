import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Mapeo de tipoCurso (DB enum) -> etiqueta corta para el PDF
const TIPO_LABEL: Record<string, string> = {
  O:     'S',   // Obligatorio de carrera (Especialidad)
  E:     'EL',  // Electivo de carrera
  EG_OB: 'OB', // Estudios Generales Obligatorio
  EG_OP: 'OP', // Estudios Generales Opcional
  EG_EL: 'EL', // Estudios Generales Electivo
  ES:    'ES',
  EP:    'EP',
  EE:    'EE',
};

// Devuelve la etiqueta corta del tipo de curso
const getTipoLabel = (tipoCurso?: string | null): string => {
  if (!tipoCurso) return 'OB';
  return TIPO_LABEL[tipoCurso] ?? tipoCurso;
};

// Un curso es electivo de EG si es EG_EL
const esEGElectivo = (tipoCurso?: string | null) => tipoCurso === 'EG_EL';

// Un curso es electivo de carrera si es E
const esElectivoCarrera = (tipoCurso?: string | null) => tipoCurso === 'E';

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 7.5,
    color: '#000',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderColor: '#8B6914',
    paddingBottom: 8,
  },
  universityTitle: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  printDate: {
    fontSize: 7,
    color: '#555',
    textAlign: 'right',
  },
  mainTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  table: {
    width: '100%',
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#8B6914',
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderRadius: 2,
    marginBottom: 2,
    alignItems: 'center',
  },
  colHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 7.5,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderColor: '#d4c49a',
    paddingVertical: 3,
    paddingHorizontal: 3,
    alignItems: 'center',
    minHeight: 15,
  },
  tableRowAlt: {
    backgroundColor: '#fffdf4',
  },
  electivoRow: {
    backgroundColor: '#f5f0e8',
  },
  // Anchos de columnas
  colNumero:  { width: '7%',  textAlign: 'center' },
  colCiclo:   { width: '5%',  textAlign: 'center' },
  colTipo:    { width: '6%',  textAlign: 'center' },
  colCurso:   { width: '35%' },
  colT:       { width: '5%',  textAlign: 'center' },
  colP:       { width: '5%',  textAlign: 'center' },
  colL:       { width: '5%',  textAlign: 'center' },
  colC:       { width: '5%',  textAlign: 'center', fontWeight: 'bold' },
  colDept:    { width: '27%' },

  cellText: {
    fontSize: 7.5,
    color: '#111',
  },
  cellTextBold: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#111',
  },
  cellTextGray: {
    fontSize: 7,
    color: '#666',
  },
  electivoLabel: {
    fontSize: 6.5,
    color: '#7a5c00',
    fontStyle: 'italic',
  },

  // Fila de suma de créditos
  creditoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 3,
    marginBottom: 8,
    borderTopWidth: 1,
    borderColor: '#8B6914',
  },
  creditoText: {
    fontSize: 8,
    color: '#333',
  },
  creditoNum: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#8B6914',
    marginLeft: 4,
  },

  // Nota al pie de electivos
  electivoNota: {
    fontSize: 6.5,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 1,
    marginBottom: 8,
    paddingLeft: 3,
  },

  // Ciclo separador
  cicloHeader: {
    flexDirection: 'row',
    backgroundColor: '#e8dfc9',
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginTop: 4,
    marginBottom: 1,
    borderRadius: 2,
  },
  cicloHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#5a4000',
  },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 28,
    right: 28,
    borderTopWidth: 0.5,
    borderColor: '#bbb',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color: '#888',
  },
});

interface CursoRow {
  codigo: string;
  ciclo: number;
  tipoCurso?: string | null;
  nombre: string;
  horasTeoria: number;
  horasPractica: number;
  horasLaboratorio: number;
  creditos: number;
  departamento: string;
}

interface FormatoPlanEstudiosProps {
  planNombre: string;
  planAnio: number;
  cursos: CursoRow[];
}

export function FormatoPlanEstudios({ planNombre, planAnio, cursos }: FormatoPlanEstudiosProps) {
  const fechaActual = new Date();
  const fechaFormateada = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}-${String(fechaActual.getDate()).padStart(2, '0')} ${String(fechaActual.getHours()).padStart(2, '0')}:${String(fechaActual.getMinutes()).padStart(2, '0')}`;

  // Agrupar cursos por ciclo
  const cursosPorCiclo = cursos.reduce((acc, curso) => {
    if (!acc[curso.ciclo]) acc[curso.ciclo] = [];
    acc[curso.ciclo].push(curso);
    return acc;
  }, {} as Record<number, CursoRow[]>);

  const ciclos = Object.keys(cursosPorCiclo).map(Number).sort((a, b) => a - b);

  // Calcular total general de créditos del plan
  let totalGeneralCreditos = 0;
  for (const ciclo of ciclos) {
    const cc = cursosPorCiclo[ciclo];
    const noEGEl = cc.filter(c => !esEGElectivo(c.tipoCurso));
    const egEl   = cc.filter(c =>  esEGElectivo(c.tipoCurso));
    // Electivos de carrera: solo contar uno (el de mayor crédito)
    const noCarreraEl = noEGEl.filter(c => !esElectivoCarrera(c.tipoCurso));
    const carreraEl   = noEGEl.filter(c =>  esElectivoCarrera(c.tipoCurso));

    totalGeneralCreditos +=
      noCarreraEl.reduce((s, c) => s + c.creditos, 0) +
      (carreraEl.length > 0 ? Math.max(...carreraEl.map(c => c.creditos)) : 0) +
      (egEl.length   > 0 ? Math.max(...egEl.map(c => c.creditos))   : 0);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.headerTop}>
          <Text style={styles.universityTitle}>UNIVERSIDAD NACIONAL DE TRUJILLO</Text>
          <Text style={styles.printDate}>Fecha de impresión: {fechaFormateada}</Text>
        </View>

        <Text style={styles.mainTitle}>
          {planNombre} 
        </Text>

        {/* Cabecera de tabla */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colHeaderText, styles.colNumero]}>#</Text>
          <Text style={[styles.colHeaderText, styles.colCiclo]}>Ciclo</Text>
          <Text style={[styles.colHeaderText, styles.colTipo]}>Tipo</Text>
          <Text style={[styles.colHeaderText, styles.colCurso]}>Curso</Text>
          <Text style={[styles.colHeaderText, styles.colT]}>T</Text>
          <Text style={[styles.colHeaderText, styles.colP]}>P</Text>
          <Text style={[styles.colHeaderText, styles.colL]}>L</Text>
          <Text style={[styles.colHeaderText, styles.colC]}>C</Text>
          <Text style={[styles.colHeaderText, styles.colDept]}>Departamento Responsable</Text>
        </View>

        <View style={styles.table}>
          {ciclos.map(ciclo => {
            const cursosCiclo = cursosPorCiclo[ciclo];

            // Separar grupos para el cálculo de créditos
            const egElectivos    = cursosCiclo.filter(c => esEGElectivo(c.tipoCurso));
            const carreraElectivos = cursosCiclo.filter(c => esElectivoCarrera(c.tipoCurso));
            const normales       = cursosCiclo.filter(c => !esEGElectivo(c.tipoCurso) && !esElectivoCarrera(c.tipoCurso));

            // Créditos del ciclo:
            // - Cursos normales (O, EG_OB, EG_OP): suma completa
            // - Electivos de EG (EG_EL): solo el mayor crédito (alumno elige 1)
            // - Electivos de carrera (E): solo el mayor crédito (alumno elige 1)
            const creditosNormales       = normales.reduce((s, c) => s + c.creditos, 0);
            const creditosEGEl           = egElectivos.length > 0 ? Math.max(...egElectivos.map(c => c.creditos)) : 0;
            const creditosCarreraEl      = carreraElectivos.length > 0 ? Math.max(...carreraElectivos.map(c => c.creditos)) : 0;
            const totalCreditos          = creditosNormales + creditosEGEl + creditosCarreraEl;

            const tieneElectivos = egElectivos.length > 0 || carreraElectivos.length > 0;

            return (
              <React.Fragment key={`ciclo-${ciclo}`}>
                {/* Separador de ciclo */}
                <View style={styles.cicloHeader}>
                  <Text style={styles.cicloHeaderText}>CICLO {ciclo}</Text>
                </View>

                {cursosCiclo.map((curso, idx) => {
                  const tipoLabel = getTipoLabel(curso.tipoCurso);
                  const isEGEl = esEGElectivo(curso.tipoCurso);
                  const isCarreraEl = esElectivoCarrera(curso.tipoCurso);
                  const isAlt = idx % 2 === 1;

                  return (
                    <View
                      key={curso.codigo}
                      style={[
                        styles.tableRow,
                        isAlt ? styles.tableRowAlt : {},
                        (isEGEl || isCarreraEl) ? styles.electivoRow : {},
                      ]}
                    >
                      <Text style={[styles.cellTextBold, styles.colNumero]}>{curso.codigo}</Text>
                      <Text style={[styles.cellText, styles.colCiclo]}>{curso.ciclo}</Text>
                      <Text style={[styles.cellTextBold, styles.colTipo, { color: isEGEl || isCarreraEl ? '#7a5c00' : '#000' }]}>
                        {tipoLabel}
                      </Text>
                      <View style={styles.colCurso}>
                        <Text style={styles.cellText}>{curso.nombre}</Text>
                       
                      </View>
                      <Text style={[styles.cellText, styles.colT]}>{curso.horasTeoria}</Text>
                      <Text style={[styles.cellText, styles.colP]}>{curso.horasPractica}</Text>
                      <Text style={[styles.cellText, styles.colL]}>{curso.horasLaboratorio}</Text>
                      <Text style={[styles.cellTextBold, styles.colC]}>{curso.creditos}</Text>
                      <Text style={[styles.cellTextGray, styles.colDept]}>{curso.departamento.toUpperCase()}</Text>
                    </View>
                  );
                })}

              

                {/* Suma de créditos del ciclo */}
                <View style={styles.creditoRow}>
                  <Text style={styles.creditoText}>Suma de créditos del Ciclo {ciclo}:</Text>
                  <Text style={styles.creditoNum}>{totalCreditos}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Total general */}
        <View style={[styles.creditoRow, { borderTopWidth: 2, borderColor: '#5a4000', marginTop: 4 }]}>
          <Text style={[styles.creditoText, { fontSize: 9, fontWeight: 'bold' }]}>
            TOTAL CRÉDITOS DEL PLAN DE ESTUDIOS:
          </Text>
          <Text style={[styles.creditoNum, { fontSize: 11 }]}>{totalGeneralCreditos}</Text>
        </View>

        {/* Leyenda de tipos */}
        <View style={{ marginTop: 8, paddingTop: 4, borderTopWidth: 0.5, borderColor: '#ccc' }}>
          <Text style={{ fontSize: 6.5, color: '#555' }}>
            Tipos de curso — S: Especialidad  |  OB: Estudios Generales Obligatorio  |  OP: Estudios Generales Opcional  |  EL: Electivo (solo se suma 1 crédito por grupo de electivos)  |  EL: Electivo de carrera
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Universidad Nacional de Trujillo — Escuela de Ingeniería de Sistemas</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
