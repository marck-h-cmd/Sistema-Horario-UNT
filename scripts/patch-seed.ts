import * as fs from 'fs';
import * as path from 'path';

const rawCoursesData = `1939 1 S INTRODUCCION A LA INGENIERIA DE SISTEMAS 3 2 0 2 INGENIERIA DE SISTEMAS
2347 1 S INTRODUCCION A LA PROGRAMACION 1 0 2 3 INGENIERIA DE SISTEMAS
1854 1 OB DESARROLLO PERSONAL 2 2 0 3 CIENCIAS PSICOLOGICAS FILOSOFIA Y ARTE
1855 1 OB DESARROLLO DEL PENSAMIENTO LOGICO MATEMATICO 1 4 0 3 MATEMATICAS
1857 1 OB LECTURA CRITICA Y REDACCION DE TEXTOS ACADEMICOS 2 2 0 3 LENGUA NACIONAL Y LITERATURA
1863 1 OB INTRODUCCION AL ANALISIS MATEMATICO 2 4 0 4 MATEMATICAS
1867 1 OP ESTADISTICA GENERAL 2 4 0 4 ESTADISTICA
1883 1 EL TALLER DE TECNICAS DE COMUNICACION EFICAZ 0 2 0 1 COMUNICACION SOCIAL
1884 1 EL TALLER DE MUSICA 0 2 0 1 FILOSOFIA Y ARTE
1908 1 EL TALLER DE LIDERAZGO Y TRABAJO EN EQUIPO 0 2 0 1 CIENCIAS PSICOLOGICAS
2055 1 EL TALLER DE DEPORTE 0 2 0 1 CIENCIAS DE LA EDUCACION
2056 1 EL TALLER DE TEATRO 0 2 0 1 FILOSOFIA Y ARTE
2051 2 S PROGRAMACION ORIENTADO A OBJETOS I 2 0 4 4 INGENIERIA DE SISTEMAS
1858 2 OB SOCIEDAD CULTURA Y ECOLOGIA 1 4 0 3 CIENCIAS SOCIALES
1859 2 OB CULTURA INVESTIGATIVA Y PENSAMIENTO CRITICO 2 2 0 3 CIENCIAS DE LA EDUCACION
1860 2 OB ETICA, CONVIVENCIA HUMANA Y CIUDADANIA 2 2 0 3 FILOSOFIA Y ARTE CIENCIAS PSICOLOGICAS
1861 2 OB ANALISIS MATEMATICO 2 4 0 4 MATEMATICAS
1875 2 OP FISICA GENERAL 2 4 0 4 FISICA
1888 2 EL TALLER DE MANEJO DE TIC 0 2 0 1 INGENIERIA DE SISTEMAS
1889 2 EL TALLER DE DANZAS FOLCLORICAS 0 2 0 1 FILOSOFIA Y ARTE
1890 2 EL TALLER DE DEPORTE 0 2 0 1 CIENCIAS DE LA EDUCACION
2057 2 EL TALLER DE MUSICA 0 2 0 1 FILOSOFIA Y ARTE
2140 3 S ADMINISTRACION GENERAL 2 2 0 3 ADMINISTRACION
2141 3 S SISTEMICA 1 2 2 3 INGENIERIA DE SISTEMAS
2142 3 S ESTADISTICA APLICADA 1 2 2 3 ESTADISTICA
2143 3 S MATEMATICA APLICADA 1 2 2 3 MATEMATICAS
2144 3 S FISICA ELECTRONICA 1 2 2 3 FISICA
2145 3 S PROGRAMACION ORIENTADA A OBJETOS II 2 0 4 4 INGENIERIA DE SISTEMAS
2146 3 EL INGENIERIA GRAFICA 1 1 3 3 INGENIERIA DE SISTEMAS
2147 3 EL SICOLOGIA ORGANIZACIONAL 2 2 0 3 CIENCIAS PSICOLOGICAS
2650 4 S ECONOMIA GENERAL 2 2 0 3 ECONOMIA
2651 4 S DISEÑO WEB 1 1 3 3 INGENIERIA DE SISTEMAS
2652 4 S PENSAMIENTO DE DISEÑO 1 2 2 3 INGENIERIA DE SISTEMAS
2653 4 S GESTIÓN DE PROCESOS 1 2 2 3 INGENIERIA DE SISTEMAS
2654 4 S SISTEMAS DIGITALES 1 2 2 3 INGENIERIA DE SISTEMAS
2655 4 S ESTRUCTURA DE DATOS ORIENTADO A OBJETOS 2 1 3 4 INGENIERIA DE SISTEMAS
2656 4 EL COMPUTACIÓN GRÁFICA Y VISUAL 1 1 3 3 INGENIERIA DE SISTEMAS
2657 4 EL PLATAFORMAS TECNOLÓGICAS 2 0 2 3 INGENIERIA DE SISTEMAS
2689 5 S CONTABILIDAD GERENCIAL 1 2 2 3 CONTABILIDAD Y FINANZAS
2690 5 S TECNOLOGIAS WEB 1 1 3 3 INGENIERIA DE SISTEMAS
2691 5 S INVESTIGACIÓN DE OPERACIONES 1 2 2 3 INGENIERIA DE SISTEMAS INGENIERIA INDUSTRIAL
2692 5 S INGENIERIA DE DATOS I 2 1 3 4 INGENIERIA DE SISTEMAS
2693 5 S ARQUITECTURA Y ORGANIZACIÓN DE COMPUTADORAS 1 2 2 3 INGENIERIA DE SISTEMAS
2694 5 S SISTEMAS DE INFORMACIÓN 2 2 2 4 INGENIERIA DE SISTEMAS
2695 5 EL TELEINFORMÁTICA 1 2 2 3 INGENIERIA DE SISTEMAS
2696 5 EL TRANSFORMACIÓN DIGITAL 2 0 2 3 INGENIERIA DE SISTEMAS
3125 6 S FINANZAS CORPORATIVAS 1 2 2 3 CONTABILIDAD Y FINANZAS
3126 6 S SISTEMAS INTELIGENTES 1 2 2 3 INGENIERIA DE SISTEMAS
3127 6 S INGENIERÍA ECONÓMICA 1 2 2 3 INGENIERIA INDUSTRIAL
3128 6 S INGENIERÍA DE DATOS II 2 1 3 4 INGENIERIA DE SISTEMAS
3129 6 S SISTEMAS OPERATIVOS 1 2 2 3 INGENIERIA DE SISTEMAS
3130 6 S INGENIERÍA DE REQUERIMIENTOS 1 2 2 3 INGENIERIA DE SISTEMAS
3131 6 EL INGENIERÍA AMBIENTAL 2 2 0 3 INGENIERIA QUIMICA INGENIERIA AMBIENTAL
3132 6 EL GESTIÓN DEL TALENTO HUMANO 2 2 0 3 ADMINISTRACION
3444 7 S CADENA DE SUMINISTRO 2 2 0 3 INGENIERIA INDUSTRIAL
3445 7 S GESTIÓN DE SERVICIOS DE TIC 1 2 2 3 INGENIERIA DE SISTEMAS
3446 7 S METODOLOGÍA DE LA INVESTIGACIÓN CIENTÍFICA 2 2 0 3 INGENIERIA DE SISTEMAS
3447 7 S PLANEAMIENTO ESTRATÉGICO DE LA INFORMACIÓN 1 2 2 3 INGENIERIA DE SISTEMAS
3448 7 S REDES Y COMUNICACIONES I 1 1 3 3 INGENIERIA DE SISTEMAS
3449 7 S INGENIERÍA DEL SOFTWARE I 2 1 3 4 INGENIERIA DE SISTEMAS
3450 7 EL ADMINISTRACIÓN DE BASE DE DATOS 1 1 3 3 INGENIERIA DE SISTEMAS
3451 7 EL NEGOCIOS ELECTRÓNICOS 2 0 2 3 INGENIERIA DE SISTEMAS
4482 8 S MARKETING Y MEDIOS SOCIALES 1 2 2 3 INGENIERIA DE SISTEMAS
4483 8 S SEGURIDAD DE LA INFORMACIÓN 1 2 2 3 INGENIERIA DE SISTEMAS
4484 8 S INTERNET DE LAS COSAS 1 1 3 3 INGENIERIA DE SISTEMAS
4485 8 S INTELIGENCIA DE NEGOCIOS 1 2 2 3 INGENIERIA DE SISTEMAS
4486 8 S REDES Y COMUNICACIONES II 1 1 3 3 INGENIERIA DE SISTEMAS
4487 8 S INGENIERÍA DEL SOFTWARE II 2 1 3 4 INGENIERIA DE SISTEMAS
4488 8 EL DEONTOLOGÍA Y DERECHO INFORMÁTICO 2 2 0 3 DERECHO
4489 8 EL ARQUITECTURA BASADA EN MICROSERVICIOS 2 0 2 3 INGENIERIA DE SISTEMAS
4490 9 S GESTIÓN DE PROYECTOS DE TIC 1 2 2 3 INGENIERIA DE SISTEMAS
4491 9 S AUDITORÍA INFORMÁTICA 1 2 2 3 INGENIERIA DE SISTEMAS
4492 9 S TESIS I 2 2 2 4 INGENIERIA DE SISTEMAS
4493 9 S ANALÍTICA DE NEGOCIOS 1 2 2 3 INGENIERIA DE SISTEMAS
4494 9 S COMPUTACIÓN EN LA NUBE 1 1 3 3 INGENIERIA DE SISTEMAS
4495 9 S INGENIERÍA WEB 1 1 3 3 INGENIERIA DE SISTEMAS
4496 9 EL EMPRENDEDURISMO TECNOLÓGICO 2 0 2 3 INGENIERIA DE SISTEMAS
4497 9 EL HACKEO ÉTICO 2 0 2 3 INGENIERIA DE SISTEMAS
4498 10 S SISTEMAS DE INFORMACIÓN EMPRESARIAL 2 1 3 4 INGENIERIA DE SISTEMAS
4499 10 S GOBIERNO DE TIC 1 2 2 3 INGENIERIA DE SISTEMAS
4501 10 S ARQUITECTURA EMPRESARIAL 1 2 2 3 INGENIERIA DE SISTEMAS
4502 10 S RESPONSABILIDAD SOCIAL CORPORATIVA 2 2 0 3 INGENIERIA INDUSTRIAL
4503 10 S APLICACIONES MÓVILES 1 1 3 3 INGENIERIA DE SISTEMAS
4504 10 S PRÁCTICAS PRE PROFESIONALES 2 1 3 4 INGENIERIA DE SISTEMAS
5265 10 S TRABAJO DE INVESTIGACIÓN 2 2 2 4 INGENIERIA DE SISTEMAS`;

function parseCourses() {
  const lines = rawCoursesData.split(/\r?\n/);
  return lines.map(line => {
    const parts = line.split(/\s+/);
    if (parts.length < 9) return null;
    const codigo = parts[0];
    const ciclo = parseInt(parts[1]);
    const tipo = parts[2];
    
    let tIndex = -1;
    for (let i = 3; i < parts.length - 3; i++) {
      if (/^\d+$/.test(parts[i]) && /^\d+$/.test(parts[i+1]) && /^\d+$/.test(parts[i+2]) && /^\d+$/.test(parts[i+3])) {
        tIndex = i;
        break;
      }
    }
    if (tIndex === -1) return null;
    
    const nombre = parts.slice(3, tIndex).join(' ');
    const t = parseInt(parts[tIndex]);
    const p = parseInt(parts[tIndex+1]);
    const l = parseInt(parts[tIndex+2]);
    const c = parseInt(parts[tIndex+3]);
    const departamento = parts.slice(tIndex+4).join(' ');
    
    return {
      codigo, ciclo, tipoCurso: tipo, nombre, t, p, l, c, departamento: departamento || 'INGENIERIA DE SISTEMAS'
    };
  }).filter(c => c !== null);
}

async function run() {
  const seedPath = path.join(__dirname, 'seed.ts');
  let seedContent = fs.readFileSync(seedPath, 'utf8');

  const parsed = parseCourses();
  
  const replacementCode = "  // ==================== CREACION DE PLAN DE ESTUDIOS Y CURSOS ADICIONALES ====================\n" +
  "  const planEstudio = await prisma.planEstudio.create({\n" +
  "    data: {\n" +
  "      nombre: 'PLAN DE ESTUDIOS DE INGENIERIA DE SISTEMAS 2018',\n" +
  "      anio: 2018,\n" +
  "      activo: true,\n" +
  "    }\n" +
  "  });\n\n" +
  "  const parsedCoursesData = " + JSON.stringify(parsed, null, 2) + ";\n" +
  "  const departamentosSet = new Set(parsedCoursesData.map(c => c.departamento));\n" +
  "  const deptMap: Record<string, number> = {};\n\n" +
  "  const fac = await prisma.facultad.findFirst({ where: { nombre: 'Facultad de Ingeniería' } });\n" +
  "  for (const deptName of departamentosSet) {\n" +
  "    let d = await prisma.departamentoAcademico.findFirst({ where: { nombre: deptName } });\n" +
  "    if (!d) {\n" +
  "      d = await prisma.departamentoAcademico.create({\n" +
  "        data: {\n" +
  "          nombre: deptName,\n" +
  "          facultadId: fac.id,\n" +
  "        }\n" +
  "      });\n" +
  "    }\n" +
  "    deptMap[deptName] = d.id;\n" +
  "  }\n\n" +
  "  const cursosCreadosNuevos = [];\n" +
  "  for (const cData of parsedCoursesData) {\n" +
  "    const existingCourse = await prisma.curso.findFirst({ where: { codigo: cData.codigo } });\n" +
  "    let curso = existingCourse;\n" +
  "    if (!curso) {\n" +
  "      curso = await prisma.curso.create({\n" +
  "        data: {\n" +
  "          codigo: cData.codigo,\n" +
  "          nombre: cData.nombre,\n" +
  "          ciclo: cData.ciclo,\n" +
  "          tipoCurso: cData.tipoCurso,\n" +
  "          horasTeoria: cData.t,\n" +
  "          horasPractica: cData.p,\n" +
  "          horasLaboratorio: cData.l,\n" +
  "          creditos: cData.c,\n" +
  "          departamentoId: deptMap[cData.departamento]\n" +
  "        }\n" +
  "      });\n" +
  "    } else {\n" +
  "      // Update existing course to have the department just in case\n" +
  "      curso = await prisma.curso.update({\n" +
  "        where: { id: curso.id },\n" +
  "        data: { departamentoId: deptMap[cData.departamento] }\n" +
  "      });\n" +
  "    }\n\n" +
  "    await prisma.planEstudioCurso.create({\n" +
  "      data: {\n" +
  "        planEstudioId: planEstudio.id,\n" +
  "        cursoId: curso.id,\n" +
  "        ciclo: cData.ciclo,\n" +
  "        tipoCurso: cData.tipoCurso\n" +
  "      }\n" +
  "    });\n\n" +
  "    cursosCreadosNuevos.push(curso);\n" +
  "  }\n" +
  "  console.log('✅ ' + cursosCreadosNuevos.length + ' cursos del plan agregados y vinculados al plan de estudios');\n";

  // We append it right before the "ASIGNACIONES CURSO-DOCENTE" block
  seedContent = seedContent.replace(
    /(\/\/\s*==================== ASIGNACIONES CURSO-DOCENTE ====================)/,
    replacementCode + '\n  $1'
  );

  fs.writeFileSync(seedPath, seedContent, 'utf8');
  console.log('seed.ts has been patched successfully!');
}

run();
