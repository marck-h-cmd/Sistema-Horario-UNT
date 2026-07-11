import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { DiaSemana, TipoAmbiente } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const fechaParam = searchParams.get('fecha'); // Formato: YYYY-MM-DD
    const diaSemanaParam = searchParams.get('diaSemana');
    const tipo = searchParams.get('tipo'); // AULA, LABORATORIO, etc.
    const edificio = searchParams.get('edificio'); // Filtro por pabellón/edificio

    if (!periodoId) {
      return createErrorResponse('VALIDATION_ERROR', 'Se requiere el ID del período', 400);
    }

    // Determinar día de la semana y fecha real de consulta
    let diaSemana: DiaSemana = DiaSemana.LUNES;
    let fechaConsulta = new Date();

    if (fechaParam) {
      fechaConsulta = new Date(fechaParam);
      const weekdays: DiaSemana[] = [
        DiaSemana.DOMINGO,
        DiaSemana.LUNES,
        DiaSemana.MARTES,
        DiaSemana.MIERCOLES,
        DiaSemana.JUEVES,
        DiaSemana.VIERNES,
        DiaSemana.SABADO,
      ];
      diaSemana = weekdays[fechaConsulta.getDay()];
    } else if (diaSemanaParam) {
      diaSemana = diaSemanaParam.toUpperCase() as DiaSemana;
    } else {
      // Por defecto hoy
      const weekdays: DiaSemana[] = [
        DiaSemana.DOMINGO,
        DiaSemana.LUNES,
        DiaSemana.MARTES,
        DiaSemana.MIERCOLES,
        DiaSemana.JUEVES,
        DiaSemana.VIERNES,
        DiaSemana.SABADO,
      ];
      diaSemana = weekdays[fechaConsulta.getDay()];
    }

    // Configurar rangos de fecha de consulta para mantenimientos
    const startOfDay = new Date(fechaConsulta);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(fechaConsulta);
    endOfDay.setHours(23, 59, 59, 999);

    // Obtener ambientes filtrados
    const whereAmbiente: any = { activo: true };
    if (tipo && tipo !== 'TODOS') {
      if (tipo === 'ESPECIALES') {
        whereAmbiente.tipo = { in: [TipoAmbiente.AUDITORIO, TipoAmbiente.SALA_CONFERENCIAS] };
      } else {
        whereAmbiente.tipo = tipo as TipoAmbiente;
      }
    }

    if (edificio) {
      whereAmbiente.OR = [
        { codigo: { contains: edificio, mode: 'insensitive' } },
        { nombre: { contains: edificio, mode: 'insensitive' } },
        { ubicacion: { contains: edificio, mode: 'insensitive' } },
      ];
    }

    const ambientes = await prisma.ambiente.findMany({
      where: whereAmbiente,
      orderBy: { codigo: 'asc' },
    });

    // Obtener horarios ocupados para el día y periodo
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        diaSemana,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: { select: { nombre: true } },
            cursoDocente: {
              include: {
                planEstudioCurso: {
                  include: {
                    curso: { select: { nombre: true, codigo: true } },
                  },
                },
                docente: {
                  include: {
                    usuario: { select: { nombre: true, apellidos: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Obtener mantenimientos del día
    const mantenimientos = await prisma.mantenimientoAmbiente.findMany({
      where: {
        completado: false,
        fechaInicio: { lte: endOfDay },
        fechaFin: { gte: startOfDay },
      },
    });

    // Consolidar disponibilidad por ambiente
    const resultado = ambientes.map((amb) => {
      const horariosAmbiente = horarios
        .filter((h) => h.ambienteId === amb.id)
        .map((h) => {
          const cdg = h.cursoDocenteGrupo;
          const cd = cdg?.cursoDocente;
          const curso = cd?.planEstudioCurso?.curso;
          const docente = cd?.docente?.usuario;
          const grupo = cdg?.grupo;

          return {
            id: h.id,
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            estado: h.estado,
            curso: curso ? { codigo: curso.codigo, nombre: curso.nombre } : null,
            docente: docente ? `${docente.nombre} ${docente.apellidos}` : null,
            grupo: grupo ? grupo.nombre : null,
          };
        });

      const mantenimientosAmbiente = mantenimientos
        .filter((m) => m.ambienteId === amb.id)
        .map((m) => ({
          id: m.id,
          descripcion: m.descripcion,
          fechaInicio: m.fechaInicio,
          fechaFin: m.fechaFin,
        }));

      return {
        id: amb.id,
        codigo: amb.codigo,
        nombre: amb.nombre,
        tipo: amb.tipo,
        capacidad: amb.capacidad,
        ubicacion: amb.ubicacion,
        horarios: horariosAmbiente,
        mantenimientos: mantenimientosAmbiente,
      };
    });

    return createSuccessResponse({
      diaSemana,
      fecha: fechaConsulta.toISOString().split('T')[0],
      ambientes: resultado,
    });
  } catch (error: any) {
    console.error('Error al obtener disponibilidad de ambientes:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error interno al obtener disponibilidad', 500);
  }
}
