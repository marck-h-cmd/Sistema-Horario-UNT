import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

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
    fontSize: 7,
    lineHeight: 1.2,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    alignItems: 'stretch',
    minHeight: 18,
  },
  rowNoBorder: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 18,
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: '#000',
    padding: 4,
    justifyContent: 'center',
  },
  cellNoBorder: {
    padding: 4,
    justifyContent: 'center',
  },
  cellHeader: {
    backgroundColor: '#dae8f5',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  textBold: {
    fontWeight: 'bold',
  },
  textCenter: {
    textAlign: 'center',
  },
  footerNotes: {
    fontSize: 6,
    marginTop: 5,
    lineHeight: 1.3,
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    paddingHorizontal: 10,
  },
  signatureBox: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 0.8,
    borderTopColor: '#000000',
    marginBottom: 4,
  },
  signatureTitle: {
    fontSize: 7.5,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  registroFooter: {
    marginTop: 40,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export interface CargaLectivaRow {
  horarioStr: string;
  asignatura: string;
  lugar: string;
  aula: string;
  total: number;
}

export interface CargaNoLectivaRow {
  actividadId: string;
  horarioStr: string;
  actividadNombre: string;
  lugar: string;
  aula: string;
  total: number;
}

export interface FormatoHorarioSemanalProps {
  docente: {
    dni: string;
    nombreCompleto: string;
    departamento: string;
    facultad: string;
    categoriaDedicacion: string;
    email?: string;
  };
  periodo: {
    anio: string;
    ciclo: string;
    fechaInicio: string;
    fechaFin: string;
  };
  cargaLectiva: CargaLectivaRow[];
  cargaNoLectiva: CargaNoLectivaRow[];
  totalHoras: number;
  fechaRegistro?: string;
}

const ACTIVIDADES_ORDENADAS = [
  { id: 'PREPARACION_Y_EVALUACION', nombre: 'PREPARACION Y EVALUACION' },
  { id: 'CONSEJERIA', nombre: 'TUTORIA Y CONSEJERIA' },
  { id: 'INVESTIGACION', nombre: 'INVESTIGACION' },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', nombre: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA' },
  { id: 'ASESORIA_DE_TESIS', nombre: 'ASESORÍA DE TESIS Y EXAMENES PROFESIONALES' },
  { id: 'CAPACITACION', nombre: 'FORMACIÓN ACADÉMICA Y CAPACITACIÓN' },
  { id: 'AUTOEVALUACION', nombre: 'AUTOEVALUACIÓN Y/O ACREDITACIÓN DE LA ESCUELA PROFESIONAL' },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', nombre: 'COMITES O COMISIONES ESPECIALES' },
  { id: 'ACTIVIDADES_DE_GOBIERNO', nombre: 'ACTIVIDADES DE GOBIERNO O AUTORIDAD' },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', nombre: 'ACTIVIDADES DE GESTIÓN INSTITUCIONAL' },
];

export function FormatoHorarioSemanal({
  docente,
  periodo,
  cargaLectiva = [],
  cargaNoLectiva = [],
  totalHoras,
  fechaRegistro,
}: FormatoHorarioSemanalProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerTitle}>HORARIO SEMANAL DE LA CARGA ACADÉMICA DOCENTE (F03-CAD)</Text>

        <View style={styles.table}>
          {/* Header Rows */}
          <View style={styles.row}>
            <View style={[styles.cell, { width: '60%' }]}>
              <Text><Text style={styles.textBold}>Facultad / Filial:</Text> {docente.facultad}</Text>
            </View>
            <View style={[styles.cellNoBorder, { width: '40%' }]}>
              <Text><Text style={styles.textBold}>Dpto. Académico:</Text> {docente.departamento}</Text>
            </View>
          </View>
          
          <View style={styles.row}>
            <View style={[styles.cell, { width: '8%', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.textBold}>DNI</Text>
            </View>
            <View style={[styles.cell, { width: '12%', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.textBold}>{docente.dni}</Text>
            </View>
            <View style={[styles.cell, { width: '50%' }]}>
              <Text><Text style={styles.textBold}>Docente:</Text> {docente.nombreCompleto}</Text>
            </View>
            <View style={[styles.cellNoBorder, { width: '30%', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.textBold}>{docente.categoriaDedicacion.split('\n')[0]}</Text>
              {docente.categoriaDedicacion.split('\n')[1] && (
                <Text style={styles.textBold}>{docente.categoriaDedicacion.split('\n')[1]}</Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cellNoBorder, { width: '100%', flexDirection: 'row', justifyContent: 'center' }]}>
              <Text style={{ marginRight: 20 }}>
                <Text style={styles.textBold}>AÑO ACADEMICO: </Text>{periodo.anio} 
                <Text style={styles.textBold}> SEMESTRE: </Text>{periodo.ciclo}
              </Text>
              <Text style={{ marginRight: 20 }}>
                <Text style={styles.textBold}>Fecha de inicio: </Text>{periodo.fechaInicio}
              </Text>
              <Text>
                <Text style={styles.textBold}>Fecha de término: </Text>{periodo.fechaFin}
              </Text>
            </View>
          </View>

          {/* CHL Header */}
          <View style={[styles.row, styles.cellHeader]}>
            <View style={[styles.cell, { width: '25%' }]}><Text>HORARIO</Text></View>
            <View style={[styles.cell, { width: '45%' }]}><Text>CARGA HORARIA LECTIVA (CHL)</Text></View>
            <View style={[styles.cell, { width: '10%' }]}><Text>LUGAR</Text></View>
            <View style={[styles.cell, { width: '12%' }]}><Text>AULA</Text></View>
            <View style={[styles.cellNoBorder, { width: '8%' }]}><Text>TOTAL</Text></View>
          </View>

          {/* CHL Body */}
          {cargaLectiva.length > 0 ? cargaLectiva.map((item, idx) => (
            <View style={styles.row} key={`chl-${idx}`}>
              <View style={[styles.cell, { width: '25%' }]}>
                <Text style={styles.textBold}>{item.horarioStr}</Text>
              </View>
              <View style={[styles.cell, { width: '45%' }]}>
                <Text>{item.asignatura}</Text>
              </View>
              <View style={[styles.cell, { width: '10%', alignItems: 'center' }]}>
                <Text>{item.lugar}</Text>
              </View>
              <View style={[styles.cell, { width: '12%', alignItems: 'center' }]}>
                <Text>{item.aula}</Text>
              </View>
              <View style={[styles.cellNoBorder, { width: '8%', alignItems: 'center' }]}>
                <Text>{item.total}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.row}>
              <View style={[styles.cell, { width: '25%' }]}><Text></Text></View>
              <View style={[styles.cell, { width: '45%' }]}><Text></Text></View>
              <View style={[styles.cell, { width: '10%' }]}><Text></Text></View>
              <View style={[styles.cell, { width: '12%' }]}><Text></Text></View>
              <View style={[styles.cellNoBorder, { width: '8%' }]}><Text></Text></View>
            </View>
          )}
          
          <View style={styles.row}>
            <View style={[styles.cell, { width: '25%' }]}>
              <Text style={styles.textBold}>T: </Text>
              <Text style={styles.textBold}>P: </Text>
            </View>
            <View style={[styles.cell, { width: '45%' }]}><Text></Text></View>
            <View style={[styles.cell, { width: '10%' }]}><Text></Text></View>
            <View style={[styles.cell, { width: '12%' }]}><Text></Text></View>
            <View style={[styles.cellNoBorder, { width: '8%' }]}><Text></Text></View>
          </View>

          {/* CHNL Header */}
          <View style={[styles.row, styles.cellHeader]}>
            <View style={[styles.cell, { width: '25%' }]}><Text>HORARIO</Text></View>
            <View style={[styles.cell, { width: '45%' }]}><Text>CARGA HORARIA NO LECTIVA (CHNL)</Text></View>
            <View style={[styles.cell, { width: '10%' }]}><Text>LUGAR</Text></View>
            <View style={[styles.cell, { width: '12%' }]}><Text>AULA</Text></View>
            <View style={[styles.cellNoBorder, { width: '8%' }]}><Text>TOTAL</Text></View>
          </View>

          {/* CHNL Body */}
          {ACTIVIDADES_ORDENADAS.map((act) => {
            const rowData = cargaNoLectiva.find(r => r.actividadId === act.id);
            return (
              <View style={styles.row} key={act.id}>
                <View style={[styles.cell, { width: '25%' }]}>
                  <Text>{rowData?.horarioStr || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '45%' }]}>
                  <Text>{act.nombre}</Text>
                </View>
                <View style={[styles.cell, { width: '10%', alignItems: 'center' }]}>
                  <Text>{rowData?.lugar || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '12%', alignItems: 'center' }]}>
                  <Text>{rowData?.aula || ''}</Text>
                </View>
                <View style={[styles.cellNoBorder, { width: '8%', alignItems: 'center' }]}>
                  <Text>{rowData?.total || ''}</Text>
                </View>
              </View>
            );
          })}

          {/* Footer Total */}
          <View style={[styles.rowNoBorder, styles.cellHeader]}>
            <View style={{ width: '92%', borderRightWidth: 1, borderRightColor: '#000', padding: 4, alignItems: 'center' }}>
              <Text>TOTAL HORAS CARGA ACADÉMICA</Text>
            </View>
            <View style={{ width: '8%', padding: 4, alignItems: 'center' }}>
              <Text>{totalHoras}</Text>
            </View>
          </View>
        </View>

        {/* Footer Notes */}
        <View style={styles.footerNotes}>
          <Text>T: TEORIA - P: PRACTICA</Text>
          <Text>LU (LUNES); MA (MARTES); MI (MIERCOLES); JU (JUEVES); VI (VIERNES); SA (SABADO); DO (DOMINGO); TIEMPO EN FORMATO DE 24 HORAS.</Text>
          <Text style={{ marginTop: 4 }}>
            LUGAR: (F01: "CC. Agropecuarias"; F02: "CC. Biológicas"; F03: "CC. Económicas"; F04: "CC. Físicas y Matemáticas"; F05: "CC. Sociales"; F06: "Derecho y Ciencias Políticas"; F07: "Educación y Comunicación"; F08: "Enfermería"; F09: "Estomatología"; F10: "Farmacia y Bioquímica"; F11: "Ingeniería"; F12: "Ingeniería Química"; F13: "Medicina"; F14: "Filial Valle Jequetepeque"; F15: "Filial Huamachuco"; F16: "Filial Santiago de Chuco"; OA: "Oficina Administrativa"; SC: "Salida de Campo").
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>FIRMA DEL DOCENTE</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>FIRMA Y SELLO DEL DIRECTOR DE DPTO.ACADEMICO</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>V°B° DECANO</Text>
          </View>
        </View>

        {/* Footer Registration Info */}
        <View style={styles.registroFooter}>
          <Text>FECHA DE REGISTRO: ({fechaRegistro || new Date().toLocaleString('es-PE')}) EMAIL: {docente.email || 'SIN CORREO'}</Text>
        </View>

      </Page>
    </Document>
  );
}
