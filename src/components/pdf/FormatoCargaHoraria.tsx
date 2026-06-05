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

// Actividades no lectivas en el orden requerido
const ACTIVIDADES_NO_LECTIVAS = [
  { id: 'PREPARACION_Y_EVALUACION', num: 2, name: 'PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)' },
  { id: 'CONSEJERIA', num: 3, name: 'CONSEJERÍA' },
  { id: 'INVESTIGACION', num: 4, name: 'INVESTIGACIÓN' },
  { id: 'CAPACITACION', num: 5, name: 'CAPACITACIÓN' },
  { id: 'ACTIVIDADES_DE_GOBIERNO', num: 6, name: 'ACTIVIDADES DE GOBIERNO' },
  { id: 'ACTIVIDADES_DE_ADMINISTRACION', num: 7, name: 'ACTIVIDADES DE ADMINISTRACIÓN' },
  { id: 'ASESORIA_DE_TESIS', num: 8, name: 'ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL' },
  { id: 'RESPONSABILIDAD_SOCIAL_UNIVERSITARIA', num: 9, name: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA' },
  { id: 'COMITES_TECNICOS_Y_COMISIONES', num: 10, name: 'COMITÉS TÉCNICOS Y COMISIONES' },
];

// Estilos del Reporte PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 8,
    lineHeight: 1.2,
    color: '#000000',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  university: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  title1: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title2: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  datosTable: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#000',
    marginBottom: 10,
  },
  datosRow: {
    flexDirection: 'row',
  },
  datosCell: {
    borderWidth: 0.5,
    borderColor: '#000',
    padding: 5,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#000',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    alignItems: 'center',
    minHeight: 16,
  },
  tableRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 16,
    backgroundColor: '#f0f0f0',
  },
  tableColHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 7,
    padding: 4,
  },
  tableCol: {
    textAlign: 'left',
    paddingLeft: 4,
    fontSize: 7,
    padding: 4,
  },
  tableColCenter: {
    textAlign: 'center',
    fontSize: 7,
    padding: 4,
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 10,
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    marginRight: 10,
  },
  totalVal: {
    fontWeight: 'bold',
    fontSize: 9,
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
  },
  fechaLine: {
    textAlign: 'right',
    marginTop: 30,
    marginBottom: 10,
    fontSize: 8,
  }
});

interface AsignacionLectiva {
  codigo: string;
  nombre: string;
  escuela: string;
  ciclo: number;
  seccion: string;
  n_alumnos: number;
  horas_teoria: number;
  horas_practica: number;
  horas_laboratorio: number;
}

interface CargaNoLectivaItem {
  tipoActividad: string;
  horasSemanales: number;
  descripcion?: string;
}

interface FormatoCargaHorariaProps {
  docente: {
    nombres: string;
    apellidos: string;
    dni?: string;
    codigoIBM?: string;
    departamento: string;
    facultad: string;
    condicion: string;
    categoria: string;
    modalidad: string;
    dedicacion_horas: number;
  };
  periodo: {
    anio: string;
    ciclo: string;
    fecha_inicio: string;
    fecha_fin: string;
  };
  cargaLectiva: AsignacionLectiva[];
  cargaNoLectiva: CargaNoLectivaItem[];
  notaValidacion?: string;
}

export function FormatoCargaHoraria({
  docente,
  periodo,
  cargaLectiva = [],
  cargaNoLectiva = [],
  notaValidacion,
}: FormatoCargaHorariaProps) {
  // Sumar horas lectivas
  const totalHorasLectivas = cargaLectiva.reduce(
    (acc, c) => acc + (c.horas_teoria + c.horas_practica + c.horas_laboratorio),
    0
  );

  // Helper to get horas for a specific activity
  const getHorasActividad = (tipo: string) => {
    const item = cargaNoLectiva.find(i => i.tipoActividad === tipo);
    return item ? item.horasSemanales : 0;
  };
  
  // Helper to get descripcion for a specific activity
  const getDescripcionActividad = (tipo: string) => {
    const item = cargaNoLectiva.find(i => i.tipoActividad === tipo);
    return item ? (item.descripcion || '') : '';
  };

  // Sumar horas no lectivas
  const totalHorasNoLectivas = ACTIVIDADES_NO_LECTIVAS.reduce((acc, act) => acc + getHorasActividad(act.id), 0);

  // Suma total
  const sumaTotalHoras = totalHorasLectivas + totalHorasNoLectivas;
  
  // Fecha actual
  const fechaActual = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabecera Oficial */}
        <View style={styles.header}>
          <Text style={styles.university}>UNIVERSIDAD NACIONAL DE TRUJILLO</Text>
          <Text style={styles.title1}>FORMATO N° 1</Text>
          <Text style={styles.title2}>DECLARACIÓN DE CARGA HORARIA ASIGNADA</Text>
        </View>

        {/* I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR */}
        <Text style={styles.sectionTitle}>I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:</Text>
        
        <View style={styles.datosTable}>
          <View style={styles.datosRow}>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>FACULTAD:</Text>
            </View>
            <View style={[styles.datosCell, { width: '75%' }]}>
              <Text>{docente.facultad}</Text>
            </View>
          </View>
          <View style={styles.datosRow}>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>DPTO. ACADÉMICO:</Text>
            </View>
            <View style={[styles.datosCell, { width: '75%' }]}>
              <Text>{docente.departamento}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColHeader, { width: '40%' }]}>NOMBRE COMPLETO</Text>
            <Text style={[styles.tableColHeader, { width: '20%' }]}>CONDICIÓN</Text>
            <Text style={[styles.tableColHeader, { width: '20%' }]}>CATEGORÍA</Text>
            <Text style={[styles.tableColHeader, { width: '20%' }]}>MODALIDAD</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableColCenter, { width: '40%' }]}>{docente.nombres} {docente.apellidos}</Text>
            <Text style={[styles.tableColCenter, { width: '20%' }]}>{docente.condicion}</Text>
            <Text style={[styles.tableColCenter, { width: '20%' }]}>{docente.categoria}</Text>
            <Text style={[styles.tableColCenter, { width: '20%' }]}>{docente.modalidad}</Text>
          </View>
        </View>
        
        <View style={styles.datosTable}>
          <View style={styles.datosRow}>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>AÑO ACADÉMICO:</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text>{periodo.anio}</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>CICLO (SEM.):</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text>{periodo.ciclo}</Text>
            </View>
          </View>
          <View style={styles.datosRow}>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>INICIO:</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text>{periodo.fecha_inicio}</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text style={{ fontWeight: 'bold' }}>FINAL:</Text>
            </View>
            <View style={[styles.datosCell, { width: '25%' }]}>
              <Text>{periodo.fecha_fin}</Text>
            </View>
          </View>
        </View>

        {/* 1. TRABAJO LECTIVO */}
        <Text style={styles.sectionTitle}>1. TRABAJO LECTIVO.- Datos completos y con claridad</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColHeader, { width: '8%' }]}>CÓDIGO</Text>
            <Text style={[styles.tableColHeader, { width: '22%' }]}>NOMBRE DEL CURSO</Text>
            <Text style={[styles.tableColHeader, { width: '5%' }]}>CUR.</Text>
            <Text style={[styles.tableColHeader, { width: '15%' }]}>Escuela Prof.</Text>
            <Text style={[styles.tableColHeader, { width: '5%' }]}>CIC.</Text>
            <Text style={[styles.tableColHeader, { width: '5%' }]}>SEC.</Text>
            <Text style={[styles.tableColHeader, { width: '10%' }]}>N° AL.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.T.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.P.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.L.</Text>
            <Text style={[styles.tableColHeader, { width: '12%' }]}>Total</Text>
          </View>
          {cargaLectiva.length > 0 ? (
            cargaLectiva.map((item, index) => {
              const total = item.horas_teoria + item.horas_practica + item.horas_laboratorio;
              return (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableColCenter, { width: '8%' }]}>{item.codigo}</Text>
                  <Text style={[styles.tableCol, { width: '22%' }]}>{item.nombre}</Text>
                  <Text style={[styles.tableColCenter, { width: '5%' }]}>OB</Text>
                  <Text style={[styles.tableColCenter, { width: '15%' }]}>{item.escuela}</Text>
                  <Text style={[styles.tableColCenter, { width: '5%' }]}>{item.ciclo}</Text>
                  <Text style={[styles.tableColCenter, { width: '5%' }]}>{item.seccion}</Text>
                  <Text style={[styles.tableColCenter, { width: '10%' }]}>{item.n_alumnos}</Text>
                  <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_teoria}</Text>
                  <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_practica}</Text>
                  <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_laboratorio}</Text>
                  <Text style={[styles.tableColCenter, { width: '12%', fontWeight: 'bold' }]}>{total}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableColCenter, { width: '100%', paddingVertical: 8 }]}>No tiene carga lectiva asignada para este periodo.</Text>
            </View>
          )}
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCol, { width: '88%', fontWeight: 'bold', textAlign: 'right', paddingRight: 10 }]}>
              TOTAL HORAS LECTIVAS:
            </Text>
            <Text style={[styles.tableColCenter, { width: '12%', fontWeight: 'bold' }]}>
              {totalHorasLectivas}
            </Text>
          </View>
        </View>

        {/* 2-10. CARGA NO LECTIVA */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColHeader, { width: '10%' }]}>N°</Text>
            <Text style={[styles.tableColHeader, { width: '65%' }]}>ACTIVIDAD NO LECTIVA</Text>
            <Text style={[styles.tableColHeader, { width: '25%' }]}>HORAS</Text>
          </View>
          {ACTIVIDADES_NO_LECTIVAS.map((act) => (
            <View key={act.id} style={styles.tableRow}>
              <Text style={[styles.tableColCenter, { width: '10%' }]}>{act.num}</Text>
              <View style={[styles.tableCol, { width: '65%', flexDirection: 'column' }]}>
                <Text style={{ fontWeight: 'bold' }}>{act.name}</Text>
                {getDescripcionActividad(act.id) ? (
                  <Text style={{ fontSize: 6.5, marginTop: 2 }}>{getDescripcionActividad(act.id)}</Text>
                ) : null}
              </View>
              <Text style={[styles.tableColCenter, { width: '25%' }]}>{getHorasActividad(act.id)}</Text>
            </View>
          ))}
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCol, { width: '75%', fontWeight: 'bold', textAlign: 'right', paddingRight: 10 }]}>
              TOTAL HORAS NO LECTIVAS:
            </Text>
            <Text style={[styles.tableColCenter, { width: '25%', fontWeight: 'bold' }]}>
              {totalHorasNoLectivas}
            </Text>
          </View>
        </View>
        
        {/* TOTAL GENERAL */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL:</Text>
          <Text style={styles.totalVal}>{sumaTotalHoras}</Text>
        </View>
        
        {/* Fecha y firmas */}
        <Text style={styles.fechaLine}>Trujillo, {fechaActual}</Text>
        
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>Firma del Profesor</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>Firma del Director de Dpto.</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>V° B° DECANO FAC.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
