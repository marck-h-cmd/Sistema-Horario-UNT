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

// Estilos del Reporte PDF
const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    lineHeight: 1.3,
    color: '#1a1a1a',
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#002B49',
    paddingBottom: 8,
  },
  university: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#002B49',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#333333',
  },
  subtitle: {
    fontSize: 8,
    marginTop: 2,
    color: '#555555',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#002B49',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    borderBottomWidth: 0.8,
    borderBottomColor: '#002B49',
    paddingBottom: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#cccccc',
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#f9f9f9',
  },
  metaItem: {
    width: '50%',
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    fontWeight: 'bold',
    width: '35%',
    color: '#444444',
  },
  metaValue: {
    width: '65%',
    color: '#111111',
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#000000',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e6edf5',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    alignItems: 'center',
    height: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    alignItems: 'center',
    minHeight: 18,
  },
  tableRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
    backgroundColor: '#f5f5f5',
  },
  tableColHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 7.5,
    color: '#002b49',
  },
  tableCol: {
    textAlign: 'left',
    paddingLeft: 4,
    fontSize: 7.5,
  },
  tableColCenter: {
    textAlign: 'center',
    fontSize: 7.5,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
    paddingRight: 10,
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    marginRight: 10,
  },
  totalVal: {
    fontWeight: 'bold',
    fontSize: 9,
    color: '#002B49',
  },
  notaWarning: {
    fontSize: 7.5,
    color: '#cc3300',
    backgroundColor: '#fff5f0',
    borderWidth: 0.5,
    borderColor: '#ffcccc',
    padding: 6,
    borderRadius: 3,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 35,
    right: 35,
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  signatureBox: {
    width: '40%',
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
    color: '#555555',
    textAlign: 'center',
  },
  signatureName: {
    fontWeight: 'bold',
    fontSize: 8,
    textAlign: 'center',
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
    dni: string;
    codigoIBM: string;
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

  // Sumar horas no lectivas
  const totalHorasNoLectivas = cargaNoLectiva.reduce((acc, n) => acc + n.horasSemanales, 0);

  // Suma total
  const sumaTotalHoras = totalHorasLectivas + totalHorasNoLectivas;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabecera Oficial */}
        <View style={styles.header}>
          <Text style={styles.university}>Universidad Nacional de Trujillo</Text>
          <Text style={styles.title}>FORMATO N° 1 - DECLARACIÓN DE LA CARGA HORARIA ASIGNADA</Text>
          <Text style={styles.subtitle}>Semestre Académico: {periodo.anio} - {periodo.ciclo}</Text>
        </View>

        {/* Datos Personales del Docente */}
        <Text style={styles.sectionTitle}>I. Datos del Docente</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Apellidos:</Text>
            <Text style={styles.metaValue}>{docente.apellidos}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Nombres:</Text>
            <Text style={styles.metaValue}>{docente.nombres}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>D.N.I.:</Text>
            <Text style={styles.metaValue}>{docente.dni}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Código IBM:</Text>
            <Text style={styles.metaValue}>{docente.codigoIBM || 'No Registrado'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Departamento:</Text>
            <Text style={styles.metaValue}>{docente.departamento}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Facultad:</Text>
            <Text style={styles.metaValue}>{docente.facultad}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Categoría:</Text>
            <Text style={styles.metaValue}>{docente.categoria}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Dedicación:</Text>
            <Text style={styles.metaValue}>{docente.modalidad} ({docente.dedicacion_horas} Horas)</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Condición:</Text>
            <Text style={styles.metaValue}>{docente.condicion}</Text>
          </View>
        </View>

        {/* Carga Lectiva */}
        <Text style={styles.sectionTitle}>II. Carga Lectiva Asignada</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColHeader, { width: '10%' }]}>Código</Text>
            <Text style={[styles.tableColHeader, { width: '30%' }]}>Asignatura / Curso</Text>
            <Text style={[styles.tableColHeader, { width: '22%' }]}>Escuela Profesional</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>Ciclo</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>Sec.</Text>
            <Text style={[styles.tableColHeader, { width: '8%' }]}>N° Alum.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.T.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.P.</Text>
            <Text style={[styles.tableColHeader, { width: '6%' }]}>H.L.</Text>
          </View>
          {cargaLectiva.length > 0 ? (
            cargaLectiva.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableColCenter, { width: '10%' }]}>{item.codigo}</Text>
                <Text style={[styles.tableCol, { width: '30%', fontWeight: 'bold' }]}>{item.nombre}</Text>
                <Text style={[styles.tableCol, { width: '22%' }]}>{item.escuela}</Text>
                <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.ciclo}</Text>
                <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.seccion}</Text>
                <Text style={[styles.tableColCenter, { width: '8%' }]}>{item.n_alumnos}</Text>
                <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_teoria}</Text>
                <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_practica}</Text>
                <Text style={[styles.tableColCenter, { width: '6%' }]}>{item.horas_laboratorio}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableColCenter, { width: '100%', paddingVertical: 4 }]}>No tiene carga lectiva asignada para este periodo.</Text>
            </View>
          )}
          {/* Fila de Totales de Carga Lectiva */}
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCol, { width: '68%', fontWeight: 'bold', textAlign: 'right', paddingRight: 10 }]}>
              Subtotal Horas Lectivas:
            </Text>
            <Text style={[styles.tableColCenter, { width: '8%', fontWeight: 'bold' }]}>-</Text>
            <Text style={[styles.tableColCenter, { width: '8%', fontWeight: 'bold' }]}>
              {cargaLectiva.reduce((acc, c) => acc + c.horas_teoria, 0)}
            </Text>
            <Text style={[styles.tableColCenter, { width: '8%', fontWeight: 'bold' }]}>
              {cargaLectiva.reduce((acc, c) => acc + c.horas_practica, 0)}
            </Text>
            <Text style={[styles.tableColCenter, { width: '8%', fontWeight: 'bold' }]}>
              {cargaLectiva.reduce((acc, c) => acc + c.horas_laboratorio, 0)}
            </Text>
          </View>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>TOTAL HORAS LECTIVAS:</Text>
          <Text style={styles.totalVal}>{totalHorasLectivas} Horas Semanales</Text>
        </View>

        {/* Carga No Lectiva */}
        <Text style={styles.sectionTitle}>III. Carga No Lectiva Declarada</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColHeader, { width: '60%' }]}>Rubro / Actividad No Lectiva</Text>
            <Text style={[styles.tableColHeader, { width: '40%' }]}>Horas Semanales Asignadas</Text>
          </View>
          {cargaNoLectiva.length > 0 ? (
            cargaNoLectiva.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { width: '60%', fontWeight: 'bold' }]}>{item.tipoActividad}</Text>
                <Text style={[styles.tableColCenter, { width: '40%' }]}>{item.horasSemanales} Horas</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableColCenter, { width: '100%', paddingVertical: 4 }]}>No tiene carga no lectiva declarada para este periodo.</Text>
            </View>
          )}
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>TOTAL HORAS NO LECTIVAS:</Text>
          <Text style={styles.totalVal}>{totalHorasNoLectivas} Horas Semanales</Text>
        </View>

        {/* Resumen Final de Carga Horaria */}
        <Text style={styles.sectionTitle}>IV. Resumen de Carga Horaria</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCol, { width: '60%', fontWeight: 'bold' }]}>Suma Carga Lectiva Semanal</Text>
            <Text style={[styles.tableColCenter, { width: '40%', fontWeight: 'bold' }]}>{totalHorasLectivas} h</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCol, { width: '60%', fontWeight: 'bold' }]}>Suma Carga No Lectiva Semanal</Text>
            <Text style={[styles.tableColCenter, { width: '40%', fontWeight: 'bold' }]}>{totalHorasNoLectivas} h</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCol, { width: '60%', fontWeight: 'bold', color: '#002B49' }]}>CARGA HORARIA TOTAL SEMANAL</Text>
            <Text style={[styles.tableColCenter, { width: '40%', fontWeight: 'bold', color: '#002B49', fontSize: 9 }]}>
              {sumaTotalHoras} h / {docente.dedicacion_horas} h
            </Text>
          </View>
        </View>

        {/* Advertencias de Reglas de Negocio en la parte inferior */}
        {notaValidacion && (
          <View style={styles.notaWarning}>
            <Text>● {notaValidacion}</Text>
          </View>
        )}

        {/* Firmas Oficiales */}
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{docente.nombres} {docente.apellidos}</Text>
            <Text style={styles.signatureTitle}>Docente Declarante</Text>
            <Text style={styles.signatureTitle}>DNI: {docente.dni}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Director de Departamento</Text>
            <Text style={styles.signatureTitle}>Dpto. Académico de {docente.departamento}</Text>
            <Text style={styles.signatureTitle}>Universidad Nacional de Trujillo</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
