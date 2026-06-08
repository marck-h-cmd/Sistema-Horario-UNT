import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando generación de datos semilla...');

  // Limpiar datos existentes en orden
  await prisma.seleccionTemporal.deleteMany();
  await prisma.envioNotificacion.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.atencionVentana.deleteMany();
  await prisma.ventanaAtencion.deleteMany();
  await prisma.validacionHorario.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.disponibilidadDocente.deleteMany();
  await prisma.restriccionAmbiente.deleteMany();
  await prisma.mantenimientoAmbiente.deleteMany();
  await prisma.preferenciasNotificacion.deleteMany();
  await prisma.cursoDocente.deleteMany();
  await prisma.grupo.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.docente.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.configuracionPeriodo.deleteMany();
  await prisma.diaNoLaborable.deleteMany();
  await prisma.ambiente.deleteMany();
  await prisma.periodoAcademico.deleteMany();
  await prisma.registroAuditoria.deleteMany();

  console.log('✅ Datos anteriores limpiados');

  // Crear usuarios
  const passwordHash = await bcrypt.hash('unt123456', 12);
  
  const adminUser = await prisma.usuario.create({
    data: {
      email: 'admin@unitru.edu.pe',
      password: passwordHash,
      nombre: 'Administrador',
      apellidos: 'Sistema',
      rol: Rol.ADMINISTRADOR,
      verificado: true,
    }
  });

  const operadorUser = await prisma.usuario.create({
    data: {
      email: 'operador@unitru.edu.pe',
      password: passwordHash,
      nombre: 'Operador',
      apellidos: 'Sistema',
      rol: Rol.OPERADOR,
      verificado: true,
    }
  });

  const superAdminUser = await prisma.usuario.create({
    data: {
      email: 'superadmin@unitru.edu.pe',
      password: passwordHash,
      nombre: 'Super',
      apellidos: 'Admin',
      rol: Rol.SUPER_ADMIN,
      verificado: true,
    }
  });

  console.log('✅ Usuarios creados');

  // Crear docentes (40 docentes para cubrir todos los cursos)
  const docentesData = [];
  
  // Nombres y apellidos para generar docentes variados
  const nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'José', 'Patricia', 'Miguel', 'Rosa', 
                   'Javier', 'Isabel', 'Fernando', 'Martha', 'Ricardo', 'Silvia', 'Andrés', 'Verónica', 'Roberto', 'Claudia',
                   'Daniel', 'Elena', 'Pablo', 'Laura', 'Jorge', 'Diana', 'Raúl', 'Mónica', 'Arturo', 'Gloria',
                   'Alberto', 'Lorena', 'Enrique', 'Paola', 'Oscar', 'Teresa', 'Manuel', 'Sofía', 'Rafael', 'Lucía'];
  
  const apellidos = ['Pérez', 'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
                     'Díaz', 'Vásquez', 'Castillo', 'Mendoza', 'Rojas', 'Ortega', 'Jiménez', 'Ruiz', 'Cruz', 'Vega',
                     'Herrera', 'Molina', 'Morales', 'Silva', 'Castro', 'Reyes', 'Gutiérrez', 'Núñez', 'Mejía', 'Acosta'];
  
  const categorias = [CategoriaDocente.PRINCIPAL, CategoriaDocente.ASOCIADO, CategoriaDocente.AUXILIAR, 
                      CategoriaDocente.CONTRATADO, CategoriaDocente.INVITADO];
  
  const departamentos = ['Ingeniería de Sistemas', 'Matemáticas', 'Estadística', 'Física', 'Lengua y Literatura', 
                         'Ciencias Sicológicas', 'Ciencias Sociales', 'Filosofía y Arte', 'Administración', 'Economía',
                         'Ingeniería Industrial', 'Ingeniería Ambiental', 'Derecho', 'Comunicación Social', 'Educación',
                         'Contabilidad y Finanzas'];
  
  for (let i = 1; i <= 40; i++) {
    const nombre = nombres[(i - 1) % nombres.length];
    const apellido1 = apellidos[(i - 1) % apellidos.length];
    const apellido2 = apellidos[(i * 2) % apellidos.length];
    
    docentesData.push({
      email: `${nombre.toLowerCase()}.${apellido1.toLowerCase()}@unitru.edu.pe`,
      nombre: nombre,
      apellidos: `${apellido1} ${apellido2}`,
      codigo: `DOC${i.toString().padStart(3, '0')}`,
      categoria: categorias[i % categorias.length],
      departamento: departamentos[i % departamentos.length],
      telefono: `9${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    });
  }

  const docentes = [];
  for (const docenteData of docentesData) {
    const user = await prisma.usuario.create({
      data: {
        email: docenteData.email,
        password: passwordHash,
        nombre: docenteData.nombre,
        apellidos: docenteData.apellidos,
        rol: Rol.DOCENTE,
        verificado: true,
      }
    });

    const docente = await prisma.docente.create({
      data: {
        usuarioId: user.id,
        codigo: docenteData.codigo,
        categoria: docenteData.categoria,
        dedicacion: docenteData.categoria === CategoriaDocente.PRINCIPAL || docenteData.categoria === CategoriaDocente.ASOCIADO ? 'TIEMPO_COMPLETO_40H' : 'TIEMPO_PARCIAL_20H',
        departamento: docenteData.departamento,
        telefono: docenteData.telefono,
        preferenciasNotificacion: {
          create: {
            correoActivo: true,
            whatsappActivo: true,
            telegramActivo: false,
            sistemaActivo: true,
          }
        }
      }
    });

    docentes.push(docente);
  }

  console.log(`✅ ${docentes.length} docentes creados`);

  // Cursos completos de I a X Ciclo en el formato requerido
  const cursosData = [
    // I Ciclo (10 cursos)
    { codigo: 'EG-101', nombre: 'Desarrollo del Pensamiento Lógico Matemático', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EG-102', nombre: 'Lectura Crítica y Redacción de Textos Académicos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EG-103', nombre: 'Desarrollo Personal', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EG-104', nombre: 'Introducción al Análisis Matemático', creditos: 4, horasTeoria: 3, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EG-105', nombre: 'Estadística General', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 1 },
    { codigo: 'EE-101', nombre: 'Introducción a la Ingeniería de Sistemas', creditos: 2, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EE-102', nombre: 'Introducción a la Programación', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EL-101', nombre: 'Técnicas de comunicación eficaz', creditos: 1, horasTeoria: 1, horasPractica: 0, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EL-102', nombre: 'Taller de Música', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 1 },
    { codigo: 'EL-103', nombre: 'Taller de Liderazgo y trabajo en equipo', creditos: 1, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 0, ciclo: 1 },
    
    // II Ciclo (9 cursos)
    { codigo: 'EG-201', nombre: 'Ética, Convivencia Humana y Ciudadanía', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EG-202', nombre: 'Sociedad, Cultura y Ecología', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EG-203', nombre: 'Cultura Investigativa y Pensamiento Crítico', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EG-204', nombre: 'Análisis Matemático', creditos: 4, horasTeoria: 3, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EG-205', nombre: 'Física General', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 2 },
    { codigo: 'EE-201', nombre: 'Programación Orientada a Objetos I', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 2 },
    { codigo: 'EL-201', nombre: 'Taller de Manejo de TIC', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EL-202', nombre: 'Taller de Danzas Folklóricas', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    { codigo: 'EL-203', nombre: 'Taller de Deporte', creditos: 1, horasTeoria: 0, horasPractica: 2, horasLaboratorio: 0, ciclo: 2 },
    
    // III Ciclo (8 cursos)
    { codigo: 'EP-301', nombre: 'Administración General', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 3 },
    { codigo: 'EE-301', nombre: 'Sistémica', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 3 },
    { codigo: 'EP-302', nombre: 'Estadística Aplicada', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 3 },
    { codigo: 'EP-303', nombre: 'Matemática Aplicada', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 3 },
    { codigo: 'EP-304', nombre: 'Física Electrónica', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 3 },
    { codigo: 'EE-302', nombre: 'Programación Orientada a Objetos II', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 3 },
    { codigo: 'EL-301', nombre: 'Ingeniería Gráfica', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 1, ciclo: 3 },
    { codigo: 'EL-302', nombre: 'Sicología Organizacional', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 3 },
    
    // IV Ciclo (8 cursos)
    { codigo: 'EP-401', nombre: 'Economía General', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 4 },
    { codigo: 'EE-401', nombre: 'Diseño Web', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 1, ciclo: 4 },
    { codigo: 'EP-402', nombre: 'Pensamiento de Diseño', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 4 },
    { codigo: 'EP-403', nombre: 'Gestión por Procesos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 4 },
    { codigo: 'EE-402', nombre: 'Sistemas Digitales', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 4 },
    { codigo: 'EE-403', nombre: 'Estructura de Datos Orientado a Objetos', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 4 },
    { codigo: 'EL-401', nombre: 'Computación Gráfica y Visual', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 1, ciclo: 4 },
    { codigo: 'EL-402', nombre: 'Plataformas Tecnológicas', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 4 },
    
    // V Ciclo (8 cursos)
    { codigo: 'EP-501', nombre: 'Contabilidad Gerencial', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 5 },
    { codigo: 'EE-501', nombre: 'Tecnologías Web', creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 1, ciclo: 5 },
    { codigo: 'EP-502', nombre: 'Investigación de Operaciones', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 5 },
    { codigo: 'EE-502', nombre: 'Ingeniería de Datos I', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 5 },
    { codigo: 'EE-503', nombre: 'Arquitectura y Organización de Computadoras', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 5 },
    { codigo: 'EE-504', nombre: 'Sistemas de Información', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 5 },
    { codigo: 'EL-501', nombre: 'Teleinformática', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 5 },
    { codigo: 'EL-502', nombre: 'Transformación Digital', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 5 },
    
    // VI Ciclo (8 cursos)
    { codigo: 'EP-601', nombre: 'Finanzas Corporativas', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 6 },
    { codigo: 'EE-601', nombre: 'Sistemas Inteligentes', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 6 },
    { codigo: 'EP-602', nombre: 'Ingeniería Económica', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 6 },
    { codigo: 'EE-602', nombre: 'Ingeniería de Datos II', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 6 },
    { codigo: 'EE-603', nombre: 'Sistemas Operativos', creditos: 3, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2, ciclo: 6 },
    { codigo: 'EE-604', nombre: 'Ingeniería de Requerimientos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 6 },
    { codigo: 'EL-601', nombre: 'Ingeniería Ambiental', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 6 },
    { codigo: 'EL-602', nombre: 'Gestión del Talento Humano', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 6 },
    
    // VII Ciclo (8 cursos)
    { codigo: 'EP-701', nombre: 'Cadena de Suministro', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7 },
    { codigo: 'EE-701', nombre: 'Gestión de Servicios de TIC', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7 },
    { codigo: 'EI-701', nombre: 'Metodología de la Investigación Científica', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7 },
    { codigo: 'EE-702', nombre: 'Planeamiento Estratégico de la Información', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7 },
    { codigo: 'EE-703', nombre: 'Redes y Comunicaciones I', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 7 },
    { codigo: 'EE-704', nombre: 'Ingeniería del Software I', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 7 },
    { codigo: 'EL-701', nombre: 'Administración de Base de Datos', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 7 },
    { codigo: 'EL-702', nombre: 'Negocios Electrónicos', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 7 },
    
    // VIII Ciclo (8 cursos)
    { codigo: 'EP-801', nombre: 'Marketing y Medios Sociales', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 8 },
    { codigo: 'EE-801', nombre: 'Seguridad de la Información', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 8 },
    { codigo: 'EE-802', nombre: 'Internet de las Cosas', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 8 },
    { codigo: 'EE-803', nombre: 'Inteligencia de Negocios', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 8 },
    { codigo: 'EE-804', nombre: 'Redes y Comunicaciones II', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 8 },
    { codigo: 'EE-805', nombre: 'Ingeniería del Software II', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 8 },
    { codigo: 'EL-801', nombre: 'Deontología y Derecho Informático', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 8 },
    { codigo: 'EL-802', nombre: 'Arquitectura basada en Microservicios', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 8 },
    
    // IX Ciclo (8 cursos)
    { codigo: 'EE-901', nombre: 'Gestión de Proyectos de TIC', creditos: 1, horasTeoria: 1, horasPractica: 0, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EE-902', nombre: 'Auditoría Informática', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EI-901', nombre: 'Tesis I', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EE-903', nombre: 'Analítica de Negocios', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EE-904', nombre: 'Computación en la Nube', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 9 },
    { codigo: 'EE-905', nombre: 'Ingeniería Web', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EL-901', nombre: 'Emprendedurismo Tecnológico', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 9 },
    { codigo: 'EL-902', nombre: 'Hackeo Ético', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 9 },
    
    // X Ciclo (7 cursos)
    { codigo: 'EE-X01', nombre: 'Sistemas de Información Empresarial', creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 2, ciclo: 10 },
    { codigo: 'EE-X02', nombre: 'Gobierno de TIC', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 10 },
    { codigo: 'EI-X01', nombre: 'Tesis II', creditos: 4, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0, ciclo: 10 },
    { codigo: 'EE-X03', nombre: 'Arquitectura Empresarial', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 10 },
    { codigo: 'EP-X01', nombre: 'Responsabilidad Social Corporativa', creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0, ciclo: 10 },
    { codigo: 'EE-X04', nombre: 'Aplicaciones Móviles', creditos: 3, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 1, ciclo: 10 },
    { codigo: 'EE-X05', nombre: 'Prácticas Pre Profesionales', creditos: 4, horasTeoria: 0, horasPractica: 8, horasLaboratorio: 0, ciclo: 10 },
  ];

  const cursos = [];
  for (const cursoData of cursosData) {
    const curso = await prisma.curso.create({
      data: {
        ...cursoData,
        grupos: {
          create: [
            { nombre: 'A', capacidad: 35 },
            { nombre: 'B', capacidad: 35 },
            { nombre: 'C', capacidad: 35 },
          ]
        }
      }
    });
    cursos.push(curso);
  }

  console.log(`✅ ${cursos.length} cursos creados con 3 grupos cada uno`);

  // Asignar cursos a docentes (cada curso tiene 1-2 docentes)
  const asignaciones = [];
  
  for (let i = 0; i < cursos.length; i++) {
    // Cada curso se asigna a 1 o 2 docentes
    const numDocentes = (i % 3 === 0) ? 2 : 1; // Cada 3 cursos, asignar 2 docentes
    const docente1Index = i % docentes.length;
    const horasAsignadas = cursos[i].creditos * 2; // Horas totales = créditos * 2
    
    asignaciones.push({
      cursoIndex: i,
      docenteIndex: docente1Index,
      horasAsignadas: numDocentes === 2 ? Math.ceil(horasAsignadas / 2) : horasAsignadas
    });
    
    if (numDocentes === 2) {
      const docente2Index = (i + 1) % docentes.length;
      asignaciones.push({
        cursoIndex: i,
        docenteIndex: docente2Index,
        horasAsignadas: Math.floor(horasAsignadas / 2)
      });
    }
  }
  
  for (const asignacion of asignaciones) {
    await prisma.cursoDocente.create({
      data: {
        cursoId: cursos[asignacion.cursoIndex].id,
        docenteId: docentes[asignacion.docenteIndex].id,
        horasAsignadas: asignacion.horasAsignadas,
      }
    });
  }

  console.log(`✅ ${asignaciones.length} asignaciones curso-docente creadas`);

  // Crear ambientes
  const ambientesData = [
    { codigo: 'A101', nombre: 'Aula 101', tipo: TipoAmbiente.AULA, capacidad: 40 },
    { codigo: 'A102', nombre: 'Aula 102', tipo: TipoAmbiente.AULA, capacidad: 40 },
    { codigo: 'A103', nombre: 'Aula 103', tipo: TipoAmbiente.AULA, capacidad: 40 },
    { codigo: 'A104', nombre: 'Aula 104', tipo: TipoAmbiente.AULA, capacidad: 35 },
    { codigo: 'A201', nombre: 'Aula 201', tipo: TipoAmbiente.AULA, capacidad: 35 },
    { codigo: 'A202', nombre: 'Aula 202', tipo: TipoAmbiente.AULA, capacidad: 35 },
    { codigo: 'A203', nombre: 'Aula 203', tipo: TipoAmbiente.AULA, capacidad: 30 },
    { codigo: 'A204', nombre: 'Aula 204', tipo: TipoAmbiente.AULA, capacidad: 30 },
    { codigo: 'L301', nombre: 'Laboratorio de Cómputo 1', tipo: TipoAmbiente.LABORATORIO, capacidad: 30 },
    { codigo: 'L302', nombre: 'Laboratorio de Cómputo 2', tipo: TipoAmbiente.LABORATORIO, capacidad: 30 },
    { codigo: 'L303', nombre: 'Laboratorio de Redes', tipo: TipoAmbiente.LABORATORIO, capacidad: 25 },
    { codigo: 'L304', nombre: 'Laboratorio de Electrónica', tipo: TipoAmbiente.LABORATORIO, capacidad: 25 },
    { codigo: 'L305', nombre: 'Laboratorio de Física', tipo: TipoAmbiente.LABORATORIO, capacidad: 30 },
    { codigo: 'AUD1', nombre: 'Auditorio Principal', tipo: TipoAmbiente.AUDITORIO, capacidad: 150 },
    { codigo: 'AUD2', nombre: 'Auditorio Secundario', tipo: TipoAmbiente.AUDITORIO, capacidad: 80 },
    { codigo: 'SC01', nombre: 'Sala de Conferencias 1', tipo: TipoAmbiente.SALA_CONFERENCIAS, capacidad: 50 },
    { codigo: 'SC02', nombre: 'Sala de Conferencias 2', tipo: TipoAmbiente.SALA_CONFERENCIAS, capacidad: 40 },
    { codigo: 'TALLER1', nombre: 'Taller de Música', tipo: TipoAmbiente.TALLER, capacidad: 30 },
    { codigo: 'TALLER2', nombre: 'Taller de Danza', tipo: TipoAmbiente.TALLER, capacidad: 35 },
    { codigo: 'DEPORTE1', nombre: 'Gimnasio', tipo: TipoAmbiente.AULA, capacidad: 50 },
  ];

  for (const ambienteData of ambientesData) {
    await prisma.ambiente.create({ data: ambienteData });
  }

  console.log(`✅ ${ambientesData.length} ambientes creados`);

  // Crear período académico
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: '2024-II',
      fechaInicio: new Date('2024-09-01'),
      fechaFin: new Date('2025-01-31'),
      estado: 'BORRADOR',
      configuraciones: {
        create: {
          horasMaxDiariasDocente: 8,
          horasMaxContinuas: 4,
          descansoMinEntreHoras: 1,
          ordenCategorias: ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'CONTRATADO', 'INVITADO']
        }
      }
    }
  });

  console.log('✅ Período académico creado');

  // Crear disponibilidad de docentes
  const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  
  for (const docente of docentes) {
    // Cada docente tiene disponibilidad en diferentes horarios según su categoría
    const numDias = docente.categoria === CategoriaDocente.PRINCIPAL ? 5 : 4;
    
    for (let i = 0; i < numDias; i++) {
      const dia = dias[i % dias.length];
      // Diferentes horarios según el día
      let horaInicio, horaFin;
      if (i % 3 === 0) {
        horaInicio = '08:00';
        horaFin = '14:00';
      } else if (i % 3 === 1) {
        horaInicio = '14:00';
        horaFin = '20:00';
      } else {
        horaInicio = '10:00';
        horaFin = '16:00';
      }
      
      await prisma.disponibilidadDocente.create({
        data: {
          docenteId: docente.id,
          diaSemana: dia as any,
          horaInicio: horaInicio,
          horaFin: horaFin,
          prioridad: i === 0 ? 2 : 1
        }
      });
    }
  }

  console.log('✅ Disponibilidad de docentes creada');
  console.log('🎉 Datos semilla generados exitosamente');
  console.log(`📊 Resumen: ${docentes.length} docentes, ${cursos.length} cursos, ${asignaciones.length} asignaciones, ${ambientesData.length} ambientes`);
}

main()
  .catch((e) => {
    console.error('❌ Error generando datos semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });