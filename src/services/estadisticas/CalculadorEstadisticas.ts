import { prisma } from '@/lib/prisma';

export class CalculadorEstadisticas {
  /**
   * Calcula la carga horaria por docente
   */
  async calcularCargaDocente(periodoId: string) {
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: {
                docente: {
                  include: {
                    usuario: { select: { nombre: true, apellidos: true } },
                  },
                },
                planEstudioCurso: { select: { creditos: true, curso: { select: { codigo: true } } } },
              }
            }
          }
        }
      },
    });

    const cargaPorDocente: Record<string, {
      docenteId: string;
      nombre: string;
      codigo: string;
      categoria: string;
      totalHoras: number;
      totalCursos: number;
      horarios: any[];
    }> = {};

    for (const h of horarios) {
      const docente = h.cursoDocenteGrupo.cursoDocente.docente;
      const docenteId = docente.id;
      if (!cargaPorDocente[docenteId]) {
        cargaPorDocente[docenteId] = {
          docenteId: docenteId,
          nombre: `${docente.usuario.nombre} ${docente.usuario.apellidos}`,
          codigo: docente.codigo,
          categoria: docente.categoria,
          totalHoras: 0,
          totalCursos: 0,
          horarios: [],
        };
      }

      if (!h.horaInicio || !h.horaFin) continue;

      const [hiH, hiM] = h.horaInicio.split(':').map(Number);
      const [hfH, hfM] = h.horaFin.split(':').map(Number);
      const horas = (hfH + hfM / 60) - (hiH + hiM / 60);

      cargaPorDocente[docenteId].totalHoras += horas;
      cargaPorDocente[docenteId].horarios.push(h);
    }

    // Contar cursos únicos por docente
    for (const docente of Object.values(cargaPorDocente)) {
      const cursosUnicos = new Set(docente.horarios.map(h => h.cursoDocenteGrupo.cursoDocente.planEstudioCursoId));
      docente.totalCursos = cursosUnicos.size;
    }

    return Object.values(cargaPorDocente).sort((a, b) => b.totalHoras - a.totalHoras);
  }

  /**
   * Calcula distribución de horarios por día
   */
  async calcularDistribucionPorDia(periodoId: string) {
    const horarios = await prisma.horario.groupBy({
      by: ['diaSemana', 'horaInicio'],
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      _count: true,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const distribucion: Record<string, Record<string, number>> = {};
    const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

    for (const dia of dias) {
      distribucion[dia] = {};
      for (let h = 8; h < 20; h++) {
        const hora = `${String(h).padStart(2, '0')}:00`;
        distribucion[dia][hora] = 0;
      }
    }

    for (const h of horarios) {
      if (h.diaSemana && h.horaInicio && distribucion[h.diaSemana]) {
        distribucion[h.diaSemana][h.horaInicio] = h._count;
      }
    }

    return distribucion;
  }

  /**
   * Calcula tasa de ocupación por tipo de ambiente
   */
  async calcularOcupacionPorTipo(periodoId: string) {
    const ambientes = await prisma.ambiente.findMany({
      where: { activo: true },
      include: {
        horarios: {
          where: {
            periodoId,
            estado: { not: 'CANCELADO' },
          },
        },
      },
    });

    const porTipo: Record<string, {
      totalAmbientes: number;
      totalFranjas: number;
      franjasOcupadas: number;
      porcentajeOcupacion: number;
    }> = {};

    const franjasPorDia = 12; // 8am a 8pm
    const diasLaborables = 5;

    for (const ambiente of ambientes) {
      if (!porTipo[ambiente.tipo]) {
        porTipo[ambiente.tipo] = {
          totalAmbientes: 0,
          totalFranjas: 0,
          franjasOcupadas: 0,
          porcentajeOcupacion: 0,
        };
      }

      porTipo[ambiente.tipo].totalAmbientes++;
      porTipo[ambiente.tipo].totalFranjas += franjasPorDia * diasLaborables;
      porTipo[ambiente.tipo].franjasOcupadas += ambiente.horarios.length;
    }

    // Calcular porcentajes
    for (const tipo of Object.values(porTipo)) {
      tipo.porcentajeOcupacion = tipo.totalFranjas > 0
        ? Math.round((tipo.franjasOcupadas / tipo.totalFranjas) * 100)
        : 0;
    }

    return porTipo;
  }

  /**
   * Calcula estadísticas descriptivas generales
   */
  async calcularDescriptivas(periodoId: string) {
    const [
      totalDocentes,
      totalCursos,
      totalAmbientes,
      totalHorarios,
      rawUniqueGrupos,
    ] = await Promise.all([
      prisma.docente.count({ where: { usuario: { activo: true } } }),
      prisma.curso.count({ where: { activo: true } }),
      prisma.ambiente.count({ where: { activo: true } }),
      prisma.horario.count({
        where: { periodoId, estado: { not: 'CANCELADO' } },
      }),
      prisma.horario.findMany({
        where: { periodoId, estado: { not: 'CANCELADO' } },
        distinct: ['cursoDocenteGrupoId'],
        select: {
          cursoDocenteGrupo: {
            select: {
              cursoDocente: {
                select: {
                  docenteId: true,
                  planEstudioCursoId: true,
                }
              }
            }
          }
        }
      }),
    ]);
    
    // Extraer y contar docentes y cursos únicos
    const uniqueDocentes = new Set();
    const uniqueCursos = new Set();
    
    for (const item of rawUniqueGrupos) {
      if (item.cursoDocenteGrupo?.cursoDocente) {
        uniqueDocentes.add(item.cursoDocenteGrupo.cursoDocente.docenteId);
        uniqueCursos.add(item.cursoDocenteGrupo.cursoDocente.planEstudioCursoId);
      }
    }
    
    const docentesConHorariosCount = uniqueDocentes.size;
    const cursosConHorariosCount = uniqueCursos.size;

    // Calcular horas totales
    const horarios = await prisma.horario.findMany({
      where: { periodoId, estado: { not: 'CANCELADO' } },
      select: { horaInicio: true, horaFin: true },
    });

    let horasTotales = 0;
    for (const h of horarios) {
      if (h.horaInicio && h.horaFin) {
        const [hiH, hiM] = h.horaInicio.split(':').map(Number);
        const [hfH, hfM] = h.horaFin.split(':').map(Number);
        horasTotales += (hfH + hfM / 60) - (hiH + hiM / 60);
      }
    }

    return {
      totalDocentes,
      docentesAsignados: docentesConHorariosCount,
      porcentajeDocentesAsignados: totalDocentes > 0
        ? Math.round((docentesConHorariosCount / totalDocentes) * 100)
        : 0,
      totalCursos,
      cursosAsignados: cursosConHorariosCount,
      porcentajeCursosAsignados: totalCursos > 0
        ? Math.round((cursosConHorariosCount / totalCursos) * 100)
        : 0,
      totalAmbientes,
      totalHorarios,
      horasTotales: Math.round(horasTotales * 10) / 10,
      promedioHorasPorDocente: docentesConHorariosCount > 0
        ? Math.round((horasTotales / docentesConHorariosCount) * 10) / 10
        : 0,
    };
  }
}