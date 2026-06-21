import fs from 'fs';

let content = fs.readFileSync('scripts/seed.ts', 'utf8');

// Update imports
content = content.replace(
  "import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario } from '@prisma/client';",
  "import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario, TipoCursoUNT } from '@prisma/client';"
);

// Update cleanup
content = content.replace(
  "await prisma.cursoDocente.deleteMany();\n  await prisma.grupo.deleteMany();\n  await prisma.curso.deleteMany();",
  "await prisma.cursoDocente.deleteMany();\n  await prisma.curso.deleteMany();"
);

// Move PeriodoAcademico up
content = content.replace(
  "  // ==================== CURSOS Y GRUPOS DINÁMICOS ====================",
  `  // ==================== PERÍODO ACADÉMICO ====================
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
  });

  // ==================== CURSOS Y GRUPOS DINÁMICOS ====================`
);

// Replace the old PeriodoAcademico and PlanEstudio creation further down
const periodAndPlanToRemove = `  // ==================== PERÍODO ACADÉMICO ====================
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

  console.log('✅ Período académico 2026-I creado');`;

const planEstudioToRemove = `    // ==================== CREACION DE PLAN DE ESTUDIOS Y CURSOS ADICIONALES ====================
  const planEstudio = await prisma.planEstudio.create({
    data: {
      nombre: 'PLAN DE ESTUDIOS DE INGENIERIA DE SISTEMAS 2018',
      anio: 2018,
      activo: true,
    }
  });`;

content = content.replace(periodAndPlanToRemove, "");
content = content.replace(planEstudioToRemove, "    // ==================== CURSOS ADICIONALES ====================");


// Replace Cursos Dinamicos creation
const cursosDinamicosOld = `    const curso = await prisma.curso.create({
      data: {
        codigo: cursoInfo.codigo,
        nombre: cursoInfo.nombre,
        ciclo: cursoInfo.ciclo,
        creditos: metadatos.creditos,
        horasTeoria: metadatos.horasTeoria,
        horasPractica: metadatos.horasPractica,
        horasLaboratorio: metadatos.horasLaboratorio,
        grupos: {
          create: gruposData
        }
      },
      include: {
        grupos: true
      }
    });
    cursos.push(curso);`;

const cursosDinamicosNew = `    const curso = await prisma.curso.create({
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
    cursos.push({ ...curso, gruposList: uniqueGroups, planEstudioCursoId: planCur.id, ciclo: cursoInfo.ciclo });`;

content = content.replace(cursosDinamicosOld, cursosDinamicosNew);

const uniqueGroupsLine = `const gruposData = uniqueGroups.map(g => ({ nombre: g, capacidad: 40 }));`;
content = content.replace(uniqueGroupsLine, "");


// Replace Cursos Adicionales logic
const cursosAdicionalesOld = `    if (!curso) {
      curso = await prisma.curso.create({
        data: {
          codigo: cData.codigo,
          nombre: cData.nombre,
          ciclo: cData.ciclo,
          tipoCurso: cData.tipoCurso,
          horasTeoria: cData.t,
          horasPractica: cData.p,
          horasLaboratorio: cData.l,
          creditos: cData.c,
          departamentoId: deptMap[cData.departamento]
        }
      });
    } else {
      // Update existing course to have the department just in case
      curso = await prisma.curso.update({
        where: { id: curso.id },
        data: { departamentoId: deptMap[cData.departamento] }
      });
    }

    await prisma.planEstudioCurso.create({
      data: {
        planEstudioId: planEstudio.id,
        cursoId: curso.id,
        ciclo: cData.ciclo,
        tipoCurso: cData.tipoCurso
      }
    });`;

const cursosAdicionalesNew = `    if (!curso) {
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
    });`;

content = content.replace(cursosAdicionalesOld, cursosAdicionalesNew);

// Replace Asignaciones
const asignacionesOld = `  // ==================== ASIGNACIONES CURSO-DOCENTE ====================
  const assignmentsMap = new Map<string, { cursoId: string; docenteId: string; horas: number }>();
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(\`\${d.nombre} \${d.apellidos}\`) === cleanStringForMatch(item.docente));
    if (curso && docente) {
      const key = \`\${curso.id}_\${docente.id}\`;
      const horas = calcularHoras(item.inicio, item.fin);
      if (assignmentsMap.has(key)) {
        assignmentsMap.get(key)!.horas += horas;
      } else {
        assignmentsMap.set(key, { cursoId: curso.id, docenteId: docente.id, horas });
      }
    }
  }

  let totalAssignments = 0;
  for (const [_, val] of assignmentsMap) {
    await prisma.cursoDocente.create({
      data: {
        cursoId: val.cursoId,
        docenteId: val.docenteId,
        horasAsignadas: val.horas || 4,
      }
    });
    totalAssignments++;
  }

  console.log(\`✅ \${totalAssignments} asignaciones curso-docente dinámicas creadas\`);`;

const asignacionesNew = `  // ==================== ASIGNACIONES CURSO-DOCENTE ====================
  const assignmentsMap = new Map<string, { planEstudioCursoId: string; docenteId: string; grupo: string; horas: number }>();
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(\`\${d.nombre} \${d.apellidos}\`) === cleanStringForMatch(item.docente));
    if (curso && docente && item.grupo) {
      const key = \`\${curso.planEstudioCursoId}_\${docente.id}_\${item.grupo}\`;
      const horas = calcularHoras(item.inicio, item.fin);
      if (assignmentsMap.has(key)) {
        assignmentsMap.get(key)!.horas += horas;
      } else {
        assignmentsMap.set(key, { planEstudioCursoId: curso.planEstudioCursoId, docenteId: docente.id, grupo: item.grupo, horas });
      }
    }
  }

  let totalAssignments = 0;
  const cursoDocentesData: any[] = [];
  for (const [_, val] of assignmentsMap) {
    const cd = await prisma.cursoDocente.create({
      data: {
        planEstudioCursoId: val.planEstudioCursoId,
        docenteId: val.docenteId,
        periodoId: periodo.id,
        grupo: val.grupo,
        horasAsignadas: val.horas || 4,
      }
    });
    cursoDocentesData.push({...val, id: cd.id});
    totalAssignments++;
  }

  console.log(\`✅ \${totalAssignments} asignaciones curso-docente dinámicas creadas\`);`;

content = content.replace(asignacionesOld, asignacionesNew);

// Replace Horarios
const horariosOld = `  // ==================== HORARIOS REALES (ESTADO CONFIRMADO) ====================
  let totalHorariosCreados = 0;
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(\`\${d.nombre} \${d.apellidos}\`) === cleanStringForMatch(item.docente));
    const grupo = curso?.grupos.find((g: any) => g.nombre === item.grupo);
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
      });`;

const horariosNew = `  // ==================== HORARIOS REALES (ESTADO CONFIRMADO) ====================
  let totalHorariosCreados = 0;
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(\`\${d.nombre} \${d.apellidos}\`) === cleanStringForMatch(item.docente));
    const cd = cursoDocentesData.find(cdd => cdd.planEstudioCursoId === curso?.planEstudioCursoId && cdd.docenteId === docente?.id && cdd.grupo === item.grupo);
    const normEnv = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === normEnv.codigo);

    if (!curso || !docente || !cd || !ambiente) {
      console.warn(\`⚠️ Omisión de registro por inconsistencia en: Curso=\${item.codigoCurso}, Docente=\${item.docente}, Grupo=\${item.grupo}, Ambiente=\${item.ambiente}\`);
      continue;
    }

    try {
      await prisma.horario.create({
        data: {
          cursoDocenteId: cd.id,
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
      });`;

content = content.replace(horariosOld, horariosNew);

// Replace Matriculas
const matriculasOld = `  let totalMatriculas = 0;
  for (const estudiante of estudiantes) {
    const cursosDelCiclo = cursos.filter(c => c.ciclo === estudiante.ciclo);

    for (const curso of cursosDelCiclo) {
      if (curso.grupos.length > 0) {
        const grupo = curso.grupos[Math.floor(Math.random() * curso.grupos.length)];
        await prisma.matricula.create({
          data: {
            estudianteId: estudiante.id,
            cursoId: curso.id,
            grupoId: grupo.id,
            periodoId: periodo.id,
            estado: 'ACTIVO'
          }
        });
        totalMatriculas++;
      }
    }
  }`;

const matriculasNew = `  let totalMatriculas = 0;
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
              cursoDocenteId: cd.id,
              periodoId: periodo.id,
              estado: 'ACTIVO'
            }
          });
          totalMatriculas++;
        }
      }
    }
  }`;

content = content.replace(matriculasOld, matriculasNew);

fs.writeFileSync('scripts/seed.ts', content);
console.log('Done!');
