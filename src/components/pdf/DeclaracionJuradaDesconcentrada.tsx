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

// Estilos de la Declaración Jurada Desconcentrada
const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: 'Helvetica',
    fontSize: 7.8,
    lineHeight: 1.4,
    color: '#000000',
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
    textAlign: 'center',
  },
  logoPlaceholder: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#002B49',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#111111',
  },
  subtitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 5,
    textAlign: 'justify',
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
    textIndent: 20,
  },
  paragraphNoIndent: {
    marginBottom: 8,
    textAlign: 'justify',
    fontWeight: 'bold',
  },
  boldText: {
    fontWeight: 'bold',
  },
  rulesList: {
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 10,
  },
  ruleItem: {
    flexDirection: 'row',
    marginBottom: 4,
    textAlign: 'justify',
  },
  ruleBullet: {
    width: 10,
    fontWeight: 'bold',
  },
  ruleText: {
    flex: 1,
  },
  authorizationBlock: {
    marginTop: 8,
    marginBottom: 8,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#000000',
    backgroundColor: '#f9f9f9',
    textAlign: 'justify',
    fontWeight: 'bold',
  },
  comisionBlock: {
    marginTop: 6,
    marginBottom: 6,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#002B49',
    backgroundColor: '#f0f4f8',
    color: '#002B49',
    fontWeight: 'bold',
    borderRadius: 2,
  },
  datePlace: {
    marginTop: 15,
    textAlign: 'right',
    fontSize: 8,
    marginBottom: 25,
  },
  signatureContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  signatureBox: {
    width: '45%',
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
    color: '#333333',
    textAlign: 'center',
    marginTop: 2,
  },
  signatureName: {
    fontWeight: 'bold',
    fontSize: 8,
    textAlign: 'center',
  },
  note: {
    position: 'absolute',
    bottom: 25,
    left: 35,
    right: 35,
    fontSize: 7,
    color: '#555555',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 3,
    textAlign: 'justify',
  }
});

interface DeclaracionJuradaDesconcentradaProps {
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
  comisionServicio?: {
    activa: boolean;
    sedeDestino: string;
    fechaInicio: string;
    fechaFin: string;
    resolucion: string;
  } | null;
}

export function DeclaracionJuradaDesconcentrada({
  docente,
  periodo,
  comisionServicio,
}: DeclaracionJuradaDesconcentradaProps) {
  const nombreCompleto = `${docente.nombres} ${docente.apellidos}`.toUpperCase();

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
          <Text style={styles.title}>DECLARACION JURADA DE LOS DOCENTES QUE PRESTAN SERVICIOS EN SEDES DESCENTRALIZADAS</Text>
        </View>

        {/* Cuerpo */}
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            Yo, <Text style={styles.boldText}>{nombreCompleto}</Text> identificado con DNI. Nro <Text style={styles.boldText}>{docente.dni}</Text> con Código IBM Nro <Text style={styles.boldText}>{docente.codigoIBM || 'No Registrado'}</Text> del Departamento Académico <Text style={styles.boldText}>{docente.departamento}</Text> Facultad de <Text style={styles.boldText}>{docente.facultad}</Text>; en el marco del reglamento de funcionamiento de Sedes Descentralizadas (RCU Nro 072 CU-COG-2005/UNT) y la Directiva Nro 01-2007-VAC/UNT sobre Racionalización Académica del Personal Docentes que labora en las Sedes descentralizadas (R.C.U. Nro 576-2007/UNT) <Text style={styles.boldText}>DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD QUE:</Text>
          </Text>

          {/* Información Dinámica de Comisión de Servicio */}
          {comisionServicio && comisionServicio.activa ? (
            <View style={styles.comisionBlock}>
              <Text>
                El docente tiene registro de comisión de servicio vigente para la sede descentralizada de {comisionServicio.sedeDestino} (Periodo: {comisionServicio.fechaInicio} al {comisionServicio.fechaFin}) autorizada mediante la resolución {comisionServicio.resolucion}.
              </Text>
            </View>
          ) : null}

          <Text style={styles.paragraphNoIndent}>
            EN MI PRESTACION DE SERVICIOS EN SEDES DESCENTRALIZADAS NO ESTOY INCURSO EN INCOMPATIBILIDAD HORARIA NI CONTRAVENGO LA SIGUIENTE NORMATIVIDAD INSTITUCIONAL:
          </Text>

          {/* Reglas de Normatividad en Sedes Desconcentradas */}
          <View style={styles.rulesList}>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                Los docentes ordinarios a Dedicación Exclusiva y Tiempo Completo solo pueden tener carga horaria máxima de diez (10) horas semanales (num. 1 de la Directiva).
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                Los docentes que ejercen cargos académicos y administrativos de: Jefe de Departamento Académico, Director de Escuela Académico Profesional, Director de Sección de Postgrado, Profesor Secretario de Facultad, Jefe de Oficina General, o cargos Directivos en Centros de Producción o líneas de Rentabilidad pueden asumir carga máxima de 05 horas semanales, siempre que sea en forma excepcional y por no contar con docente de la especialidad habilitada para asumir dicha carga (num. 2 y 3 de la Directiva RCU Nro 005-2009/UNT y art. 23 del Reglamento).
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                Los docentes que ejercen cargo de Decano o Director de Postgrado y aquellos que prestan servicios en Centros de Producción y línea de Rentabilidad no pueden asumir carga horaria en Sedes Descentralizadas (num. 3 de la Directiva y art. 23 del Reglamento).
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                Los docentes beneficiados con becas de estudio de maestría o doctorado o Segunda especialidad solo pueden tener carga horaria máxima de tres (03) horas semanales (num. 4 de la Directiva).
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                El desarrollo de la carga en sede descentralizada no puede interferir con la carga lectiva y no lectiva asignada en la Sede Central; salvo el caso de las Sedes de Cascas, Huamachuco, Tayabamba y Santiago de Chuco en que se debe contar con Licencia por comisión de servicios y carta de compromiso del docente que asumiría la carga horaria en la Sede Central (num. 5 y 7 de la Directiva y art. 23 del Reglamento).
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                Los docentes que asumen carga horaria en las Sedes de Huamachuco, Cascas, Santiago de Chuco y Tayabamba no pueden asumir labores durante el mismo periodo en otra Sede (num. 6 de la Directiva).
              </Text>
            </View>
          </View>

          <Text style={styles.paragraphNoIndent}>
            En caso de faltar a la verdad así como de incurrir en incompatibilidad horaria contraviniendo los dispositivos pre-citados me avengo a las sanciones que correspondan,
          </Text>

          {/* Bloque Especial de Autorización de Descuento en Sedes Desconcentradas */}
          <View style={styles.authorizationBlock}>
            <Text style={styles.boldText}>
              y autorizo al funcionario competente disponga el descuento del pago por mis servicios en Sedes Descentralizadas, conforme al monto que la unidad de remuneraciones liquide como pago indebido por el periodo ilegalmente laborado.
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
          Nota: Los docentes deben suscribir de forma obligatoria el presente formato para prestar servicios en cada Sede Descentralizada, al reverso de la Declaración de la Carga Horaria. FORMATO N° 2
        </Text>
      </Page>
    </Document>
  );
}
