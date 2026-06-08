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
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
        curso: { select: { creditos: true } },
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
      if (!cargaPorDocente[h.docenteId]) {
        cargaPorDocente[h.docenteId] = {
          docenteId: h.docenteId,
          nombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`,
          codigo: h.docente.codigo,
          categoria: h.docente.categoria,
          totalHoras: 0,
          totalCursos: 0,
          horarios: [],
        };
      }

      if (!h.horaInicio || !h.horaFin) continue;

      const [hiH, hiM] = h.horaInicio.split(':').map(Number);
      const [hfH, hfM] = h.horaFin.split(':').map(Number);
      const horas = (hfH + hfM / 60) - (hiH + hiM / 60);

      cargaPorDocente[h.docenteId].totalHoras += horas;
      cargaPorDocente[h.docenteId].horarios.push(h);
    }

    // Contar cursos únicos por docente
    for (const docente of Object.values(cargaPorDocente)) {
      const cursosUnicos = new Set(docente.horarios.map(h => h.cursoId));
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
      docentesConHorarios,
      cursosConHorarios,
    ] = await Promise.all([
      prisma.docente.count({ where: { usuario: { activo: true } } }),
      prisma.curso.count({ where: { activo: true } }),
      prisma.ambiente.count({ where: { activo: true } }),
      prisma.horario.count({
        where: { periodoId, estado: { not: 'CANCELADO' } },
      }),
      prisma.horario.groupBy({
        by: ['docenteId'],
        where: { periodoId, estado: { not: 'CANCELADO' } },
      }),
      prisma.horario.groupBy({
        by: ['cursoId'],
        where: { periodoId, estado: { not: 'CANCELADO' } },
      }),
    ]);

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
      docentesAsignados: docentesConHorarios.length,
      porcentajeDocentesAsignados: totalDocentes > 0
        ? Math.round((docentesConHorarios.length / totalDocentes) * 100)
        : 0,
      totalCursos,
      cursosAsignados: cursosConHorarios.length,
      porcentajeCursosAsignados: totalCursos > 0
        ? Math.round((cursosConHorarios.length / totalCursos) * 100)
        : 0,
      totalAmbientes,
      totalHorarios,
      horasTotales: Math.round(horasTotales * 10) / 10,
      promedioHorasPorDocente: docentesConHorarios.length > 0
        ? Math.round((horasTotales / docentesConHorarios.length) * 10) / 10
        : 0,
    };
  }
}