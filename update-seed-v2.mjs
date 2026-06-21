import fs from 'fs';

let content = fs.readFileSync('scripts/seed.ts', 'utf8');

// 1. Uncomment grupo delete
content = content.replace(/\/\/\s*await prisma\.grupo\.deleteMany\(\);/g, 'await prisma.grupo.deleteMany();');

// 2. Remove duplicate planEstudio
content = content.replace(/const planEstudio = await prisma\.planEstudio\.create\([\s\S]*?\}\);/g, (match, offset, string) => {
  // If it's the second match (after the first one), remove it
  if (offset > 1000) return "";
  return match;
});

// 3. Fix Curso create inside cursosMap loop
const regexCursosMap = /const curso = await prisma\.curso\.create\(\{\s*data: \{\s*codigo: cursoInfo\.codigo,[\s\S]*?\}\s*\}\);/g;
content = content.replace(regexCursosMap, (match) => {
  return `const curso = await prisma.curso.create({
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
    });`;
});

// 4. Update the push to include gruposList etc
content = content.replace(/cursos\.push\(curso\);/g, "cursos.push({ ...curso, gruposList: uniqueGroups, planEstudioCursoId: planCur.id, ciclo: cursoInfo.ciclo });");

// 5. Fix cursos adicionales (parsedCoursesData loop)
const regexCursosAdic = /curso = await prisma\.curso\.create\(\{\s*data: \{\s*codigo: cData\.codigo,[\s\S]*?\}\s*\}\);\s*\} else \{[\s\S]*?\}/g;
content = content.replace(regexCursosAdic, `curso = await prisma.curso.create({
        data: {
          codigo: cData.codigo,
          nombre: cData.nombre,
        }
      });
    }`);

const regexPlanEstudioAdic = /await prisma\.planEstudioCurso\.create\(\{\s*data: \{\s*planEstudioId: planEstudio\.id,\s*cursoId: curso\.id,\s*ciclo: cData\.ciclo,\s*tipoCurso: cData\.tipoCurso\s*\}\s*\}\);/g;
content = content.replace(regexPlanEstudioAdic, `const tcUpper = cData.tipoCurso?.toUpperCase();
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
    });`);

// 6. Fix Map Iteration errors (TS2802)
content = content.replace(/for \(const \[\_, envInfo\] of ambientesMap\)/g, "for (const envInfo of Array.from(ambientesMap.values()))");
content = content.replace(/for \(const \[codigo, cursoInfo\] of cursosMap\)/g, "for (const cursoInfo of Array.from(cursosMap.values()))");
content = content.replace(/for \(const \[\_, val\] of assignmentsMap\)/g, "for (const val of Array.from(assignmentsMap.values()))");

// 7. Fix CursoDocente & Grupo creation (assignmentsMap)
const assignmentsRegex = /const assignmentsMap = new Map<string, \{ cursoId: string; docenteId: string; horas: number \}>\(\);[\s\S]*?console\.log\(\`✅ \$\{totalAssignments\} asignaciones curso-docente dinámicas creadas\`\);/g;

content = content.replace(assignmentsRegex, `const assignmentsMap = new Map<string, { planEstudioCursoId: string; docenteId: string; grupo: string; horas: number }>();
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
  for (const val of Array.from(assignmentsMap.values())) {
    const cd = await prisma.cursoDocente.create({
      data: {
        planEstudioCursoId: val.planEstudioCursoId,
        docenteId: val.docenteId,
        periodoId: periodo.id,
        horasAsignadas: val.horas || 4,
        grupos: {
          create: [{ nombre: val.grupo, capacidad: 40 }]
        }
      },
      include: { grupos: true }
    });
    // Find the group we just created
    const createdGroup = cd.grupos.find(g => g.nombre === val.grupo);
    cursoDocentesData.push({...val, id: cd.id, grupoId: createdGroup?.id});
    totalAssignments++;
  }

  console.log(\`✅ \${totalAssignments} asignaciones curso-docente y grupos dinámicas creados\`);`);

// 8. Fix Horarios
const horariosRegex = /await prisma\.horario\.create\(\{\s*data: \{\s*cursoDocenteId: cd\.id,\s*periodoId: periodo\.id,\s*ambienteId: ambiente\.id,[\s\S]*?\}\s*\}\);/g;
content = content.replace(horariosRegex, `await prisma.horario.create({
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
      });`);
      
// Ensure we replace it properly even if the original code was not replaced by the previous attempt
const horariosFallbackRegex = /await prisma\.horario\.create\(\{\s*data: \{\s*periodoId: periodo\.id,\s*cursoId: curso\.id,\s*docenteId: docente\.id,\s*grupoId: grupo\.id,\s*ambienteId: ambiente\.id,[\s\S]*?\}\s*\}\);/g;
content = content.replace(horariosFallbackRegex, `await prisma.horario.create({
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
      });`);

// Update the loop for Horarios to use cursoDocentesData
const horariosLoopRegex = /const grupo = curso\?\.grupos\.find\(\(g: any\) => g\.nombre === item\.grupo\);\s*const normEnv = normalizarAmbiente\(item\.ambiente\);\s*const ambiente = ambientes\.find\(a => a\.codigo === normEnv\.codigo\);\s*if \(\!curso \|\| \!docente \|\| \!grupo \|\| \!ambiente\) \{/g;
content = content.replace(horariosLoopRegex, `const cd = cursoDocentesData.find((cdd: any) => cdd.planEstudioCursoId === curso?.planEstudioCursoId && cdd.docenteId === docente?.id && cdd.grupo === item.grupo);
    const normEnv = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === normEnv.codigo);

    if (!curso || !docente || !cd || !ambiente) {`);

// 9. Fix Matriculas
const matriculasRegex = /await prisma\.matricula\.create\(\{\s*data: \{\s*estudianteId: estudiante\.id,\s*cursoId: curso\.id,\s*grupoId: grupo\.id,\s*periodoId: periodo\.id,\s*estado: 'ACTIVO'\s*\}\s*\}\);/g;
content = content.replace(matriculasRegex, `const cd = cursoDocentesData.find((cdd: any) => cdd.planEstudioCursoId === curso.planEstudioCursoId && cdd.grupo === grupo);
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
          }`);

const matriculasLoopFix1 = /if \(curso\.grupos\.length > 0\) \{/g;
content = content.replace(matriculasLoopFix1, `if (curso.gruposList && curso.gruposList.length > 0) {`);

const matriculasLoopFix2 = /const grupo = curso\.grupos\[Math\.floor\(Math\.random\(\) \* curso\.grupos\.length\)\];/g;
content = content.replace(matriculasLoopFix2, `const grupo = curso.gruposList[Math.floor(Math.random() * curso.gruposList.length)];`);

const matriculasTotalFix = /totalMatriculas\+\+;\s*\}/g;
content = content.replace(matriculasTotalFix, `}`);


fs.writeFileSync('scripts/seed.ts', content);
console.log('Done fixing seed.ts!');
