import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fuentes estándar para evitar problemas de compatibilidad
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
    color: '#000000',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title1: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  title2: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
  },
  rowHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  cellHeaderTitle: {
    width: '50%',
  },
  datosTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 8,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableColHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
  },
  tableColHeaderLast: {
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 5,
    justifyContent: 'center',
  },
  tableCol: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  tableColLast: {
    padding: 5,
  },
  tableColCenter: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
    textAlign: 'center',
  },
  textRowInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 20,
    fontWeight: 'bold',
    fontSize: 7.5,
  },
  footerDate: {
    textAlign: 'right',
    marginTop: 20,
    marginBottom: 40,
    fontSize: 9,
  },
  signaturesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 40,
  },
  signatureLine: {
    width: '80%',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginBottom: 5,
  },
  signatureTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkboxLabel: {
    width: 60,
  },
  checkboxMark: {
    color: '#0056b3', // blue color to mimic the image's checkmarks
    fontWeight: 'bold',
  },
  courseSubtext: {
    marginTop: 5,
    fontSize: 7,
    color: '#333',
  }
});

export interface CursoFilialRow {
  curso: string;
  dependencia: string;
  fechaInicio: string;
  fechaFin: string;
  horarioSemanal: string;
  totalHoras: string;
}

export interface FormatoCargaFilialesProps {
  docente: {
    nombresApellidos: string;
    codigo: string;
    condicion: string; // REGULAR, CONTRATADO
    categoria: string; // PRINCIPAL, ASOCIADO, AUXILIAR
    modalidad: string; // DE, TC, TP
    horasTp?: number;
    facultad: string;
    departamento: string;
  };
  periodo: {
    anio: string;
    semestre: string;
    inicio: string;
    final: string;
  };
  cursos: CursoFilialRow[];
  fechaEmision?: string;
}

const renderCheck = (condition: boolean) => (
  <Text style={styles.checkboxMark}>{condition ? '_( X )_' : '_(   )_'}</Text>
);

export function FormatoCargaFiliales({
  docente,
  periodo,
  cursos = [],
  fechaEmision = '4 de DICIEMBRE de 2025'
}: FormatoCargaFilialesProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title1}>FORMATO</Text>
          <Text style={styles.title2}>
            DECLARACIÓN DE CARGA HORARIA LECTIVA ASIGNADA EN FILIALES, POSTGRADO, SEGUNDAS ESPECIALIDADES Y CENTROS DE PRODUCCIÓN Y EXTENSIÓN UNIVERSITARIA
          </Text>
        </View>

        <View style={styles.rowHeader}>
          <Text style={styles.cellHeaderTitle}>FACULTAD: {docente.facultad}</Text>
          <Text style={styles.cellHeaderTitle}>DPTO. ACADÉMICO: {docente.departamento}</Text>
        </View>

        <Text style={styles.datosTitle}>DATOS DEL DOCENTE:</Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: '40%' }]}><Text>NOMBRES Y APELLIDOS</Text></View>
            <View style={[styles.tableColHeader, { width: '20%' }]}><Text>CONDICIÓN</Text></View>
            <View style={[styles.tableColHeader, { width: '20%' }]}><Text>CATEGORÍA</Text></View>
            <View style={[styles.tableColHeaderLast, { width: '20%' }]}><Text>MODALIDAD</Text></View>
          </View>
          <View style={styles.tableRowLast}>
            <View style={[styles.tableCol, { width: '40%' }]}>
              <Text style={{ marginBottom: 15 }}>{docente.nombresApellidos}</Text>
              <Text>CODIGO: {docente.codigo}.</Text>
            </View>
            <View style={[styles.tableCol, { width: '20%', justifyContent: 'center' }]}>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>REGULAR</Text>
                {renderCheck(docente.condicion === 'REGULAR')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>CONTRATADO</Text>
                {renderCheck(docente.condicion === 'CONTRATADO')}
              </View>
            </View>
            <View style={[styles.tableCol, { width: '20%', justifyContent: 'center' }]}>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>PRINCIPAL</Text>
                {renderCheck(docente.categoria === 'PRINCIPAL')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>ASOCIADO</Text>
                {renderCheck(docente.categoria === 'ASOCIADO')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>AUXILIAR</Text>
                {renderCheck(docente.categoria === 'AUXILIAR')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>TIPO___</Text>
                <Text style={styles.checkboxMark}>(   )</Text>
              </View>
            </View>
            <View style={[styles.tableColLast, { width: '20%', justifyContent: 'center' }]}>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>DE.</Text>
                {renderCheck(docente.modalidad === 'DE')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>TC.</Text>
                {renderCheck(docente.modalidad === 'TC')}
              </View>
              <View style={styles.checkboxContainer}>
                <Text style={styles.checkboxLabel}>TP</Text>
                <Text style={styles.checkboxMark}>{docente.modalidad === 'TP' ? '_( X )_ ' : '_(   )_ '}... {docente.horasTp || '___'}HS</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.textRowInfo}>
          <Text>AÑO ACADÉMICO: {periodo.anio}</Text>
          <Text>SEMESTRE: {periodo.semestre}</Text>
          <Text>INICIO: {periodo.inicio}_</Text>
          <Text>FINAL: {periodo.final}_</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: '25%' }]}><Text>CURSO</Text></View>
            <View style={[styles.tableColHeader, { width: '20%' }]}><Text>DEPENDENCIA</Text></View>
            <View style={[styles.tableColHeader, { width: '20%' }]}><Text>FECHA DE INICIO /{"\n"}TÉRMINO</Text></View>
            <View style={[styles.tableColHeader, { width: '20%' }]}><Text>HORARIO SEMANAL</Text></View>
            <View style={[styles.tableColHeaderLast, { width: '15%' }]}><Text style={{ textDecoration: 'underline' }}>TOTAL{"\n"}HORAS</Text></View>
          </View>

          {cursos.map((c, idx) => (
            <View key={idx} style={idx === cursos.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <View style={[styles.tableCol, { width: '25%', justifyContent: 'center' }]}>
                <Text>{c.curso}</Text>
              </View>
              <View style={[styles.tableCol, { width: '20%', justifyContent: 'center' }]}>
                <Text>{c.dependencia}</Text>
              </View>
              <View style={[styles.tableCol, { width: '20%', justifyContent: 'center' }]}>
                <Text style={{ marginBottom: 10 }}>F.I.: <Text style={{ color: '#0056b3', textDecoration: 'underline' }}>{c.fechaInicio}</Text></Text>
                <Text>F.T.: <Text style={{ color: '#0056b3', textDecoration: 'underline' }}>{c.fechaFin}</Text></Text>
              </View>
              <View style={[styles.tableCol, { width: '20%', justifyContent: 'center', fontStyle: 'italic' }]}>
                <Text>{c.horarioSemanal}</Text>
              </View>
              <View style={[styles.tableColLast, { width: '15%', justifyContent: 'center', alignItems: 'center' }]}>
                <Text>{c.totalHoras}</Text>
              </View>
            </View>
          ))}
          {cursos.length === 0 && (
            <View style={styles.tableRowLast}>
              <View style={[styles.tableColLast, { width: '100%', padding: 20, textAlign: 'center' }]}>
                <Text>No registra carga en filiales o postgrado.</Text>
              </View>
            </View>
          )}
          {cursos.length > 0 && (
            <View style={[styles.tableRowLast, { borderTopWidth: 1, borderTopColor: '#000' }]}>
              <View style={[styles.tableCol, { width: '85%' }]}></View>
              <View style={[styles.tableColLast, { width: '15%', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                  {cursos.reduce((acc, c) => acc + parseInt(c.totalHoras.replace(/\D/g, '') || '0'), 0)} HORAS
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.footerDate}>Trujillo, {fechaEmision}</Text>

        <View style={styles.signaturesContainer}>
          <View style={styles.signatureBox}>
            <View style={[styles.signatureLine, { marginTop: 40 }]} />
            <Text style={styles.signatureTitle}>Firma del Profesor</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#ff0000', fontWeight: 'bold', fontSize: 10 }}>V° B°</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>DECANO</Text>
          </View>
          
          <View style={[styles.signatureBox, { marginTop: 30 }]}>
            <View style={[styles.signatureLine, { width: '100%' }]} />
            <Text style={styles.signatureTitle}>Director del Departamento Académico</Text>
          </View>
          <View style={[styles.signatureBox, { marginTop: 30 }]}>
            <Text style={{ textAlign: 'center', color: '#0056b3', textDecoration: 'underline', marginBottom: 2 }}>Director</Text>
            <View style={[styles.signatureLine, { width: '100%' }]} />
            <Text style={styles.signatureTitle}>Director de la Unidad Académica</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
