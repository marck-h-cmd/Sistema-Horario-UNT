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

// Estilos de la Declaración Jurada
const styles = StyleSheet.create({
  page: {
    padding: 45,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.6,
    color: '#000000',
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
    textAlign: 'center',
  },
  logoPlaceholder: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#002B49',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#111111',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    textAlign: 'justify',
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
    textIndent: 25,
  },
  paragraphNoIndent: {
    marginBottom: 12,
    textAlign: 'justify',
  },
  boldText: {
    fontWeight: 'bold',
  },
  authorizationBlock: {
    marginTop: 15,
    marginBottom: 15,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#000000',
    backgroundColor: '#f9f9f9',
    textAlign: 'justify',
    fontWeight: 'bold',
  },
  datePlace: {
    marginTop: 30,
    textAlign: 'right',
    fontSize: 9.5,
    marginBottom: 50,
  },
  signatureContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  signatureBox: {
    width: '50%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 0.8,
    borderTopColor: '#000000',
    marginBottom: 4,
  },
  signatureTitle: {
    fontSize: 8.5,
    color: '#333333',
    textAlign: 'center',
    marginTop: 2,
  },
  signatureName: {
    fontWeight: 'bold',
    fontSize: 9,
    textAlign: 'center',
  },
  note: {
    position: 'absolute',
    bottom: 40,
    left: 45,
    right: 45,
    fontSize: 7.5,
    color: '#555555',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 4,
    textAlign: 'justify',
  }
});

interface DeclaracionJuradaCentralProps {
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
  };
}

export function DeclaracionJuradaCentral({ docente, periodo }: DeclaracionJuradaCentralProps) {
  const nombreCompleto = `${docente.nombres} ${docente.apellidos}`.toUpperCase();

  // Determinar la frase de modalidad según la dedicación del docente
  let fraseDedicacion = '';
  const modalidadLower = (docente.modalidad || '').toLowerCase();
  
  if (modalidadLower.includes('exclusiva') || docente.dedicacion_horas === 40) {
    if (modalidadLower.includes('exclusiva')) {
      fraseDedicacion = `Soy docente Nombrado, a Dedicación Exclusiva y NO desempeño cargo público o privado en horas que coincidan con el horario establecido en la Universidad Nacional de Trujillo (De conformidad con los artículos 270ro y 277ro del Estatuto Institucional vigente).`;
    } else {
      fraseDedicacion = `Soy docente Nombrado, a Tiempo Completo 40 H y NO desempeño cargo público o privado en horas que coincidan con el horario establecido en la Universidad Nacional de Trujillo (De conformidad con los artículos 270ro y 277ro del Estatuto Institucional vigente).`;
    }
  } else {
    fraseDedicacion = `Soy docente ${docente.condicion}, a Tiempo Parcial ${docente.dedicacion_horas} H y NO desempeño cargo público o privado en horas que coincidan con el horario establecido en la Universidad Nacional de Trujillo.`;
  }

  // Formatear la fecha actual de Trujillo
  const fecha = new Date();
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const fechaTexto = `Trujillo, ${fecha.getDate()} de ${meses[fecha.getMonth()]} del ${fecha.getFullYear()}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.logoPlaceholder}>Universidad Nacional de Trujillo</Text>
          <Text style={styles.title}>FORMATO N° 2</Text>
          <Text style={styles.subtitle}>DECLARACIÓN JURADA DE NO ESTAR INCURSO EN CAUSALES DE INCOMPATIBILIDAD O IMPEDIMENTO LABORAL</Text>
        </View>

        {/* Cuerpo de la Declaración Jurada */}
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            Yo, <Text style={styles.boldText}>{nombreCompleto}</Text> identificado con DNI. Nro <Text style={styles.boldText}>{docente.dni}</Text> con Código IBM Nro <Text style={styles.boldText}>{docente.codigoIBM || 'No Registrado'}</Text> del Departamento Académico <Text style={styles.boldText}>{docente.departamento}</Text> Facultad de <Text style={styles.boldText}>{docente.facultad}</Text>; en el marco del programa de Homologación de la remuneración de los docentes universitarios, dispuesto por el D.U. Nro 033-2006 y D.S. Nro 019-2006-EF, <Text style={styles.boldText}>DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD</Text>, que:
          </Text>

          <Text style={styles.paragraph}>
            <Text style={styles.boldText}>NO ESTOY INCURSO</Text> en causales de incompatibilidad laboral y <Text style={styles.boldText}>NO TENGO</Text> impedimento para ejercer la docencia en la Universidad Nacional de Trujillo, de conformidad con lo previsto en el capítulo VII de las Incompatibilidades e Impedimentos, del Título VI: Los Profesores, del Estatuto Institucional vigente.
          </Text>

          <Text style={styles.paragraph}>
            {fraseDedicacion}
          </Text>

          <Text style={styles.paragraphNoIndent}>
            <Text style={styles.boldText}>EN CASO DE FALTAR A LA VERDAD ME SOMETO A LAS SANCIONES QUE SEAN APLICABLES DE ACUERDO A LEY; ASIMISMO, DE ENCONTRARME INCURSO EN SITUACION DE INCOMPATIBILIDAD O IMPEDIMENTO PARA EJERCER LA DOCENCIA EN LA U.N.T., ME SOMETO A LAS SANCIONES PREVISTAS POR SU ESTATUTO,</Text>
          </Text>

          {/* Bloque Especial de Autorización de Descuento Obligatoria */}
          <View style={styles.authorizationBlock}>
            <Text style={styles.boldText}>
              Y AUTORIZO AL FUNCIONARIO COMPETENTE DISPONGA EL DESCUENTO DE MI PLANILLA DE HABERES, DEL MONTO QUE LA UNIDAD DE REMUNERACIONES LIQUIDE COMO PAGOS INDEBIDOS POR EL LAPSO DE TIEMPO LABORADO ILEGALMENTE.
            </Text>
          </View>
        </View>

        {/* Lugar y Fecha */}
        <Text style={styles.datePlace}>{fechaTexto}</Text>

        {/* Zona de Firma */}
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{nombreCompleto}</Text>
            <Text style={styles.signatureTitle}>FIRMA DEL DECLARANTE</Text>
            <Text style={styles.signatureTitle}>DNI: {docente.dni}</Text>
          </View>
        </View>

        {/* Nota del Pie */}
        <Text style={styles.note}>
          Nota: Los docentes deben suscribir de forma obligatoria el presente formato en cada Semestre Académico, en el reverso de la Declaración de Carga Horaria Asignada.
        </Text>
      </Page>
    </Document>
  );
}
