import fs from 'fs';
import { execSync } from 'child_process';

const seedPath = 'scripts/seed.ts';

// 1. Restore seed.ts to clean state
console.log('Restoring scripts/seed.ts to clean state...');
execSync('git restore scripts/seed.ts');

let content = fs.readFileSync(seedPath, 'utf8');

// Normalize line endings to LF for consistent indexing
content = content.replace(/\r\n/g, '\n');

// 2. Add TipoCursoUNT to imports
content = content.replace(
  "import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario } from '@prisma/client';",
  "import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario, TipoCursoUNT } from '@prisma/client';"
);

// 3. Remove old cleanups
content = content.replace(
  "await prisma.cursoDocente.deleteMany();\n  await prisma.grupo.deleteMany();\n  await prisma.curso.deleteMany();",
  "await prisma.cursoDocente.deleteMany();\n  await prisma.curso.deleteMany();"
);

// 4. Insert PeriodoAcademico and PlanEstudio right AFTER the database cleanup
const cleanEndMarker = "  console.log('✅ Datos anteriores limpiados');";
const cleanEndReplacement = `  console.log('✅ Datos anteriores limpiados');

  // ==================== PERÍODO ACADÉMICO ====================
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-I',
      fechaInicio: new Date('2026-04-13'),
      fechaFin: new Date('2026-08-08'),
      estado: EstadoPeriodo.ACTIVO,
      activo: true,
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

  console.log('✅ Período académico 2026-I creado');

  // ==================== CREACION DE PLAN DE ESTUDIOS ====================
  const planEstudio = await prisma.planEstudio.create({
    data: {
      nombre: 'PLAN DE ESTUDIOS DE INGENIERIA DE SISTEMAS 2018',
      anio: 2018,
      activo: true,
    }
  });`.replace(/\r\n/g, '\n');

content = content.replace(cleanEndMarker, cleanEndReplacement);

// 5. Remove the old creations of PeriodoAcademico and PlanEstudio from the middle/bottom of the file
const oldPlanEstudioBlock = `  // ==================== CREACION DE PLAN DE ESTUDIOS Y CURSOS ADICIONALES ====================
  const planEstudio = await prisma.planEstudio.create({
    data: {
      nombre: 'PLAN DE ESTUDIOS DE INGENIERIA DE SISTEMAS 2018',
      anio: 2018,
      activo: true,
    }
  });`.replace(/\r\n/g, '\n');

content = content.replace(oldPlanEstudioBlock, '  // ==================== CURSOS ADICIONALES ====================');

// Remove old PeriodoAcademico using lastIndexOf to target the one at the bottom
const oldPeriodStartIdx = content.lastIndexOf('  // ==================== PERÍODO ACADÉMICO ====================');
const oldPeriodEndIdx = content.indexOf("  console.log('✅ Período académico 2026-I creado');", oldPeriodStartIdx);

if (oldPeriodStartIdx !== -1 && oldPeriodEndIdx !== -1) {
  const skipLen = "  console.log('✅ Período académico 2026-I creado');".length;
  // Slice it out directly using substrings to avoid replace matching the first occurrence
  content = content.substring(0, oldPeriodStartIdx) + content.substring(oldPeriodEndIdx + skipLen);
} else {
  console.log('ERROR: Old PeriodoAcademico not found');
}

// 6. Replace Cursos Map iteration & Cursos Dinámicos Creation
const cursosMapStartStr = '  const cursos: any[] = [];';
const cursosMapEndStr = '  console.log(`✅ ${cursos.length} cursos dinámicos creados`);';
const cursosMapStartIdx = content.indexOf(cursosMapStartStr);
const cursosMapEndIdx = content.indexOf(cursosMapEndStr);

if (cursosMapStartIdx !== -1 && cursosMapEndIdx !== -1) {
  const oldCode = content.substring(cursosMapStartIdx, cursosMapEndIdx + cursosMapEndStr.length);
  const newCode = `  const cursos = [];
  for (const cursoInfo of Array.from(cursosMap.values())) {
    const uniqueGroups = Array.from(uniqueGroupsMap.get(cursoInfo.codigo) || new Set(['A']));
    const metadatos = obtenerMetadatosCurso(cursoInfo.nombre);
    
    const curso = await prisma.curso.create({
      data: {
        codigo: cursoInfo.codigo,
        nombre: cursoInfo.nombre,
      }
    });
    const planCur = await prisma.planEstudioCurso.create({
      data: {
        planEstudioId: planEstudio.id,
        cursoId: curso.id,
        ciclo: cursoInfo.ciclo,
        creditos: metadatos.creditos,
        horasTeoria: metadatos.horasTeoria,
        horasPractica: metadatos.horasPractica,
        horasLaboratorio: metadatos.horasLaboratorio,
        tipoCurso: TipoCursoUNT.O
      }
    });
    cursos.push({ ...curso, gruposList: uniqueGroups, planEstudioCursoId: planCur.id, ciclo: cursoInfo.ciclo });
  }

  console.log(\`✅ \${cursos.length} cursos dinámicos creados\`);`.replace(/\r\n/g, '\n');
  content = content.replace(oldCode, newCode);
} else {
  console.log('ERROR: Cursos map index not found');
}

// 7. Replace Cursos Adicionales creation loop (parsedCoursesData loop)
const cursosAdicStartStr = '  const cursosCreadosNuevos = [];';
const cursosAdicEndStr = "  console.log('✅ ' + cursosCreadosNuevos.length + ' cursos del plan agregados y vinculados al plan de estudios');";
const cursosAdicStartIdx = content.indexOf(cursosAdicStartStr);
const cursosAdicEndIdx = content.indexOf(cursosAdicEndStr);

if (cursosAdicStartIdx !== -1 && cursosAdicEndIdx !== -1) {
  const oldCode = content.substring(cursosAdicStartIdx, cursosAdicEndIdx + cursosAdicEndStr.length);
  const newCode = `  const cursosCreadosNuevos = [];
  for (const cData of parsedCoursesData) {
    const existingCourse = await prisma.curso.findFirst({ where: { codigo: cData.codigo } });
    let curso = existingCourse;
    if (!curso) {
      curso = await prisma.curso.create({
        data: {
          codigo: cData.codigo,
          nombre: cData.nombre,
        }
      });
    }

    const tcUpper = cData.tipoCurso?.toUpperCase();
    let mappedTipo = TipoCursoUNT.O;
    if (tcUpper === 'S') mappedTipo = TipoCursoUNT.ES;
    else if (tcUpper === 'EL') mappedTipo = TipoCursoUNT.E;
    else if (tcUpper === 'OP') mappedTipo = TipoCursoUNT.EG_OP;

    await prisma.planEstudioCurso.create({
      data: {
        planEstudioId: planEstudio.id,
        cursoId: curso.id,
        ciclo: cData.ciclo,
        tipoCurso: mappedTipo,
        horasTeoria: cData.t,
        horasPractica: cData.p,
        horasLaboratorio: cData.l,
        creditos: cData.c,
        departamentoId: deptMap[cData.departamento]
      }
    });

    cursosCreadosNuevos.push(curso);
  }
  console.log('✅ ' + cursosCreadosNuevos.length + ' cursos del plan agregados y vinculados al plan de estudios');`.replace(/\r\n/g, '\n');
  content = content.replace(oldCode, newCode);
} else {
  console.log('ERROR: Cursos adic index not found');
}

// 8. Replace assignmentsMap creation (creates CursoDocente + Grupo)
const assignmentsStartIdx = content.indexOf('  // ==================== ASIGNACIONES CURSO-DOCENTE ====================');
const assignmentsEndIdx = content.indexOf('  console.log(`✅ ${totalAssignments} asignaciones curso-docente dinámicas creadas`);');

if (assignmentsStartIdx !== -1 && assignmentsEndIdx !== -1) {
  const oldAssignmentsCode = content.substring(assignmentsStartIdx, assignmentsEndIdx + '  console.log(`✅ ${totalAssignments} asignaciones curso-docente dinámicas creadas`);'.length);
  
  const newAssignmentsCode = `  // ==================== ASIGNACIONES CURSO-DOCENTE ====================
  const assignmentsMap = new Map();
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(\`\${d.nombre} \${d.apellidos}\`) === cleanStringForMatch(item.docente));
    if (curso && docente && item.grupo) {
      const key = \`\${curso.planEstudioCursoId}_\${docente.id}\`;
      const horas = calcularHoras(item.inicio, item.fin);
      if (assignmentsMap.has(key)) {
        const existing = assignmentsMap.get(key);
        existing.horas += horas;
        existing.grupos.add(item.grupo);
      } else {
        assignmentsMap.set(key, { 
          planEstudioCursoId: curso.planEstudioCursoId, 
          docenteId: docente.id, 
          grupos: new Set([item.grupo]), 
          horas 
        });
      }
    }
  }

  let totalAssignments = 0;
  const cursoDocentesData = [];
  for (const val of Array.from(assignmentsMap.values())) {
    const cd = await prisma.cursoDocente.create({
      data: {
        planEstudioCursoId: val.planEstudioCursoId,
        docenteId: val.docenteId,
        periodoId: periodo.id,
        horasAsignadas: val.horas || 4,
        grupos: {
          create: Array.from(val.grupos).map(g => ({ nombre: g, capacidad: 40 }))
        }
      },
      include: { grupos: true }
    });
    for (const g of cd.grupos) {
      cursoDocentesData.push({
        planEstudioCursoId: val.planEstudioCursoId,
        docenteId: val.docenteId,
        grupo: g.nombre,
        id: cd.id,
        grupoId: g.id
      });
    }
    totalAssignments++;
  }

  console.log(\`✅ \${totalAssignments} asignaciones curso-docente y grupos dinámicas creados\`);`.replace(/\r\n/g, '\n');

  content = content.replace(oldAssignmentsCode, newAssignmentsCode);
} else {
  console.log('ERROR: assignments index not found');
}

// 9. Replace Horarios Creation Loop
const oldHorariosLoop = `    const grupo = curso?.grupos.find((g: any) => g.nombre === item.grupo);
    const normEnv = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === normEnv.codigo);

    if (!curso || !docente || !grupo || !ambiente) {
      console.warn(\`⚠️ Omisión de registro por inconsistencia en: Curso=\${item.codigoCurso}, Docente=\${item.docente}, Grupo=\${item.grupo}, Ambiente=\${item.ambiente}\`);
      continue;
    }

    try {
      await prisma.horario.create({
        data: {
          periodoId: periodo.id,
          cursoId: curso.id,
          docenteId: docente.id,
          grupoId: grupo.id,
          ambienteId: ambiente.id,
          diaSemana: mapDia(item.dia),
          horaInicio: mapHora(item.inicio),
          horaFin: mapHora(item.fin),
          tipoComponente: item.tipoComponente,
          estado: EstadoHorario.PUBLICADO,
          publicado: true,
          creadoPor: adminUser.id,
          fechaConfirmacion: new Date(),
          confirmadoPor: adminUser.id,
        }
      });`.replace(/\r\n/g, '\n');

const newHorariosLoop = `    const cd = cursoDocentesData.find(cdd => cdd.planEstudioCursoId === curso?.planEstudioCursoId && cdd.docenteId === docente?.id && cdd.grupo === item.grupo);
    const normEnv = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === normEnv.codigo);

    if (!curso || !docente || !cd || !ambiente) {
      console.warn(\`⚠️ Omisión de registro por inconsistencia en: Curso=\${item.codigoCurso}, Docente=\${item.docente}, Grupo=\${item.grupo}, Ambiente=\${item.ambiente}\`);
      continue;
    }

    try {
      await prisma.horario.create({
        data: {
          grupoId: cd.grupoId,
          periodoId: periodo.id,
          ambienteId: ambiente.id,
          diaSemana: mapDia(item.dia),
          horaInicio: mapHora(item.inicio),
          horaFin: mapHora(item.fin),
          tipoComponente: item.tipoComponente,
          estado: EstadoHorario.PUBLICADO,
          publicado: true,
          creadoPor: adminUser.id,
          fechaConfirmacion: new Date(),
          confirmadoPor: adminUser.id,
        }
      });`.replace(/\r\n/g, '\n');

content = content.replace(oldHorariosLoop, newHorariosLoop);

// 10. Replace Matriculas loop
const matriculaStartIdx = content.indexOf('  let totalMatriculas = 0;');
const actualMatriculaEndIdx = content.indexOf('  console.log(`✅ ${estudiantes.length} estudiantes registrados con ${totalMatriculas} matrículas`);');

if (matriculaStartIdx !== -1 && actualMatriculaEndIdx !== -1) {
  const oldMatCode = content.substring(matriculaStartIdx, actualMatriculaEndIdx + '  console.log(`✅ ${estudiantes.length} estudiantes registrados con ${totalMatriculas} matrículas`);'.length);
  const newMatCode = `  let totalMatriculas = 0;
  for (const estudiante of estudiantes) {
    const cursosDelCiclo = cursos.filter(c => c.ciclo === estudiante.ciclo);

    for (const curso of cursosDelCiclo) {
      if (curso.gruposList && curso.gruposList.length > 0) {
        const grupo = curso.gruposList[Math.floor(Math.random() * curso.gruposList.length)];
        const cd = cursoDocentesData.find(cdd => cdd.planEstudioCursoId === curso.planEstudioCursoId && cdd.grupo === grupo);
        if (cd) {
          await prisma.matricula.create({
            data: {
              estudianteId: estudiante.id,
              grupoId: cd.grupoId,
              periodoId: periodo.id,
              estado: 'ACTIVO'
            }
          });
          totalMatriculas++;
        }
      }
    }
  }

  console.log(\`✅ \${estudiantes.length} estudiantes registrados con \${totalMatriculas} matrículas\`);`.replace(/\r\n/g, '\n');
  content = content.replace(oldMatCode, newMatCode);
} else {
  console.log('ERROR: matricula index not found');
}

// 11. Fix Map iteration error (TS2802) for environments
content = content.replace(
  'for (const [_, envInfo] of ambientesMap)',
  'for (const envInfo of Array.from(ambientesMap.values()))'
);

fs.writeFileSync(seedPath, content, 'utf8');
console.log('Successfully generated clean and correct scripts/seed.ts!');
