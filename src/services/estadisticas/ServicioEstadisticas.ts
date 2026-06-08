import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CACHE } from '@/lib/constantes';

export class ServicioEstadisticas {
  async obtenerResumen(periodoId: string) {
    const cacheKey = `estadisticas:resumen:${periodoId}`;
    
    // Intentar obtener de caché
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [
      totalDocentes,
      totalCursos,
      totalAmbientes,
      totalHorarios,
      horariosPorEstado,
      horariosPorDia,
    ] = await Promise.all([
      prisma.docente.count({ where: { usuario: { activo: true } } }),
      prisma.curso.count({ where: { activo: true } }),
      prisma.ambiente.count({ where: { activo: true } }),
      prisma.horario.count({ where: { periodoId, estado: { not: 'CANCELADO' } } }),
      prisma.horario.groupBy({
        by: ['estado'],
        where: { periodoId },
        _count: true,
      }),
      prisma.horario.groupBy({
        by: ['diaSemana'],
        where: { periodoId, estado: { not: 'CANCELADO' } },
        _count: true,
      }),
    ]);

    const resumen = {
      totalDocentes,
      totalCursos,
      totalAmbientes,
      totalHorarios,
      horariosPorEstado: Object.fromEntries(
        horariosPorEstado.map(h => [h.estado, h._count])
      ),
      horariosPorDia: Object.fromEntries(
        horariosPorDia.map(h => [h.diaSemana, h._count])
      ),
      timestamp: new Date().toISOString(),
    };

    // Guardar en caché
    await redis.setex(cacheKey, CACHE.TTL_ESTADISTICAS, JSON.stringify(resumen));

    return resumen;
  }

  async obtenerAvanceCategoria(periodoId: string) {
    const docentes = await prisma.docente.findMany({
      where: { usuario: { activo: true } },
      include: {
        cursos: {
          where: { activo: true },
          include: { curso: true },
        },
        horarios: {
          where: { periodoId, estado: { not: 'CANCELADO' } },
        },
      },
    });

    const porCategoria: Record<string, any> = {};

    for (const docente of docentes) {
      if (!porCategoria[docente.categoria]) {
        porCategoria[docente.categoria] = {
          totalDocentes: 0,
          totalCursosAsignados: 0,
          totalHorariosAsignados: 0,
          horasAsignadas: 0,
          horasRequeridas: 0,
          porcentajeAvance: 0,
        };
      }

      const cat = porCategoria[docente.categoria];
      cat.totalDocentes++;
      cat.totalCursosAsignados += docente.cursos.length;
      cat.totalHorariosAsignados += docente.horarios.length;

      for (const cursoDocente of docente.cursos) {
        cat.horasRequeridas += cursoDocente.horasAsignadas || 
          (cursoDocente.curso.horasTeoria + cursoDocente.curso.horasPractica + cursoDocente.curso.horasLaboratorio);
      }

      for (const horario of docente.horarios) {
        if (horario.horaInicio && horario.horaFin) {
          const [hInicio, mInicio] = horario.horaInicio.split(':').map(Number);
          const [hFin, mFin] = horario.horaFin.split(':').map(Number);
          cat.horasAsignadas += (hFin + mFin / 60) - (hInicio + mInicio / 60);
        }
      }
    }

    // Calcular porcentajes
    for (const categoria of Object.values(porCategoria)) {
      if (categoria.horasRequeridas > 0) {
        categoria.porcentajeAvance = Math.round(
          (categoria.horasAsignadas / categoria.horasRequeridas) * 100
        );
      }
    }

    return porCategoria;
  }

  async obtenerOcupacionAmbientes(periodoId: string) {
    const ambientes = await prisma.ambiente.findMany({
      where: { activo: true },
      include: {
        horarios: {
          where: { periodoId, estado: { not: 'CANCELADO' } },
        },
      },
    });

    const franjasPorDia = 12; // 8am a 8pm
    const diasLaborables = 5;

    const ocupacion = ambientes.map(ambiente => {
      const totalFranjas = ambiente.horarios.length;
      const maxFranjas = franjasPorDia * diasLaborables;
      const porcentaje = maxFranjas > 0 ? Math.round((totalFranjas / maxFranjas) * 100) : 0;

      return {
        ambienteId: ambiente.id,
        codigo: ambiente.codigo,
        nombre: ambiente.nombre,
        tipo: ambiente.tipo,
        capacidad: ambiente.capacidad,
        horariosOcupados: totalFranjas,
        totalFranjasDisponibles: maxFranjas,
        porcentajeOcupacion: porcentaje,
      };
    });

    return ocupacion.sort((a, b) => b.porcentajeOcupacion - a.porcentajeOcupacion);
  }

  async obtenerMapaCalor(periodoId: string) {
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      select: {
        diaSemana: true,
        horaInicio: true,
        ambienteId: true,
      },
    });

    const mapaCalor: Record<string, Record<string, number>> = {};
    const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

    for (const dia of dias) {
      mapaCalor[dia] = {};
      for (let h = 8; h < 20; h++) {
        mapaCalor[dia][`${h}:00`] = 0;
      }
    }

    for (const horario of horarios) {
      if (horario.horaInicio && horario.diaSemana) {
        const hora = parseInt(horario.horaInicio.split(':')[0]);
        if (hora >= 8 && hora < 20 && mapaCalor[horario.diaSemana]) {
          mapaCalor[horario.diaSemana][`${hora}:00`]++;
        }
      }
    }

    return mapaCalor;
  }
}