import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica.ttf' },
    { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  universityTitle: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  printDate: {
    fontSize: 8,
  },
  mainTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    borderBottomWidth: 1,
    borderColor: '#cda852', // Dorado UNT
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#cda852',
    paddingBottom: 5,
    marginBottom: 5,
    alignItems: 'center',
  },
  colHeader: {
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    alignItems: 'center',
    minHeight: 16,
  },
  colNumber: { width: '8%', textAlign: 'center' },
  colCiclo: { width: '6%', textAlign: 'center' },
  colTipo: { width: '8%', textAlign: 'center' },
  colCurso: { width: '32%' },
  colT: { width: '5%', textAlign: 'center' },
  colP: { width: '5%', textAlign: 'center' },
  colL: { width: '5%', textAlign: 'center' },
  colC: { width: '5%', textAlign: 'center' },
  colDept: { width: '26%' },
  
  subRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  subRowText: {
    width: '100%',
    textAlign: 'right',
    paddingRight: '31%', // Alineado bajo la columna C aprox
    fontSize: 8,
  },
  boldText: {
    fontWeight: 'bold',
  }
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
  const fechaFormateada = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}-${String(fechaActual.getDate()).padStart(2, '0')} (${String(fechaActual.getHours()).padStart(2, '0')}:${String(fechaActual.getMinutes()).padStart(2, '0')}:${String(fechaActual.getSeconds()).padStart(2, '0')})`;

  // Agrupar cursos por ciclo
  const cursosPorCiclo = cursos.reduce((acc, curso) => {
    if (!acc[curso.ciclo]) acc[curso.ciclo] = [];
    acc[curso.ciclo].push(curso);
    return acc;
  }, {} as Record<number, CursoRow[]>);

  const ciclos = Object.keys(cursosPorCiclo).map(Number).sort((a, b) => a - b);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerTop}>
          <Text style={styles.universityTitle}>UNIVERSIDAD NACIONAL DE TRUJILLO</Text>
          <Text style={styles.printDate}>Fecha de Impresión: {fechaFormateada}</Text>
        </View>

        <Text style={styles.mainTitle}>
          PLAN DE ESTUDIOS DE {planNombre} {planAnio}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, styles.colNumber]}>#</Text>
            <Text style={[styles.colHeader, styles.colCiclo]}>Ciclo</Text>
            <Text style={[styles.colHeader, styles.colTipo]}>Tipo Curso</Text>
            <Text style={[styles.colHeader, styles.colCurso]}>Curso</Text>
            <Text style={[styles.colHeader, styles.colT]}>T</Text>
            <Text style={[styles.colHeader, styles.colP]}>P</Text>
            <Text style={[styles.colHeader, styles.colL]}>L</Text>
            <Text style={[styles.colHeader, styles.colC]}>C</Text>
            <Text style={[styles.colHeader, styles.colDept]}>Departamento Responsable</Text>
          </View>

          {ciclos.map(ciclo => {
            const cursosCiclo = cursosPorCiclo[ciclo];
            const noElectivos = cursosCiclo.filter(c => c.tipoCurso !== 'EL');
            const electivos = cursosCiclo.filter(c => c.tipoCurso === 'EL');
            const totalCreditos = noElectivos.reduce((sum, c) => sum + c.creditos, 0) +
              (electivos.length > 0 ? electivos[0].creditos : 0);

            return (
              <React.Fragment key={`ciclo-${ciclo}`}>
                {cursosCiclo.map(curso => (
                  <View key={curso.codigo} style={styles.tableRow}>
                    <Text style={styles.colNumber}>{curso.codigo}</Text>
                    <Text style={styles.colCiclo}>{curso.ciclo}</Text>
                    <Text style={styles.colTipo}>{curso.tipoCurso || 'OB'}</Text>
                    <Text style={styles.colCurso}>{curso.nombre}</Text>
                    <Text style={styles.colT}>{curso.horasTeoria}</Text>
                    <Text style={styles.colP}>{curso.horasPractica}</Text>
                    <Text style={styles.colL}>{curso.horasLaboratorio}</Text>
                    <Text style={styles.colC}>{curso.creditos}</Text>
                    <Text style={styles.colDept}>{curso.departamento}</Text>
                  </View>
                ))}
                <View style={styles.subRow}>
                  <Text style={styles.subRowText}>
                    Suma de créditos:   <Text style={styles.boldText}>{totalCreditos}</Text>
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
