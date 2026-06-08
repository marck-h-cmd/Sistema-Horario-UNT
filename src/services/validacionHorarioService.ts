import { prisma } from '@/lib/prisma';
import { AppError } from '@/services/auth/AuthService';
import { TipoReglaValidacion, EstadoHorario, DedicacionDocente, TipoCargoAdministrativo } from '@prisma/client';

export interface ResultadoValidacionRegla {
  tipoRegla: TipoReglaValidacion;
  cumple: boolean;
  mensaje: string;
  metadata?: any;
}

export class ValidacionHorarioService {
  /**
   * Ejecuta todas las validaciones para las asignaciones de un docente en un período
   */
  async ejecutarValidaciones(docenteId: string, periodoId: string): Promise<{
    valido: boolean;
    resultados: ResultadoValidacionRegla[];
  }> {
    const resultados: ResultadoValidacionRegla[] = [];

    const [docente, periodo, horarios, cdAsignaciones, declaracion] = await Promise.all([
      prisma.docente.findUnique({
        where: { id: docenteId },
        include: {
          cargos: { where: { activo: true } },
          becas: { where: { activo: true } },
          comisiones: { where: { activo: true } },
        },
      }),
      prisma.periodoAcademico.findUnique({
        where: { id: periodoId },
      }),
      prisma.horario.findMany({
        where: {
          periodoId,
          docenteId,
          estado: { not: 'CANCELADO' },
        },
        include: {
          curso: true,
          ambiente: true,
        },
      }),
      prisma.cursoDocente.findMany({
        where: { docenteId, activo: true },
      }),
      prisma.declaracionNoLectiva.findUnique({
        where: {
          docenteId_periodoId: { docenteId, periodoId },
        },
        include: { items: true },
      }),
    ]);

    if (!docente) throw new AppError('Docente no encontrado', 404, 'DOCENTE_NOT_FOUND');
    if (!periodo) throw new AppError('Período académico no encontrado', 404, 'PERIODO_NOT_FOUND');

    const totalLectivas = cdAsignaciones.reduce((sum, cd) => sum + cd.horasAsignadas, 0);
    const totalNoLectivas = declaracion ? declaracion.totalHoras : 0;
    const horasDedicacion = this.obtenerHorasDedicacion(docente.dedicacion);

    // 1. Validar que la suma lectiva + no lectiva = dedicación
    const sumaTotal = totalLectivas + totalNoLectivas;
    const cumpleSuma = sumaTotal === horasDedicacion;
    resultados.push({
      tipoRegla: TipoReglaValidacion.SUPERA_HORAS_MAX_DIARIAS, // Reusado para representar suma horaria
      cumple: cumpleSuma,
      mensaje: cumpleSuma
        ? 'La suma de horas lectivas y no lectivas coincide exactamente con la dedicación del docente.'
        : `La suma de horas (${totalLectivas}h lectivas + ${totalNoLectivas}h no lectivas = ${sumaTotal}h) no coincide con su dedicación (${horasDedicacion}h).`,
      metadata: { totalLectivas, totalNoLectivas, horasDedicacion, sumaTotal },
    });

    // 2. Validar incompatibilidad de becas de estudio (Estudios activos = 0 horas lectivas permitidas)
    const activeBeca = docente.becas.find((b) => b.activo);
    if (activeBeca) {
      const cumpleBeca = totalLectivas === 0;
      resultados.push({
        tipoRegla: TipoReglaValidacion.INCOMPATIBILIDAD_BECA,
        cumple: cumpleBeca,
        mensaje: cumpleBeca
          ? 'El docente cuenta con beca de estudio y su carga lectiva es 0h, conforme al reglamento.'
          : `El docente tiene una Beca de Estudio activa (${activeBeca.tipoBeca}) y no debe tener carga lectiva asignada (tiene ${totalLectivas}h).`,
        metadata: { becaId: activeBeca.id, tipoBeca: activeBeca.tipoBeca, totalLectivas },
      });
    } else {
      resultados.push({
        tipoRegla: TipoReglaValidacion.INCOMPATIBILIDAD_BECA,
        cumple: true,
        mensaje: 'El docente no cuenta con becas de estudio activas que limiten su carga.',
      });
    }

    // 3. Validar incompatibilidad de cargos administrativos (Cargos importantes limitan la carga a max 8h o 12h)
    const activeCargo = docente.cargos.find((c) => c.activo);
    if (activeCargo) {
      // Decano, Director, Jefe de departamento usualmente tienen max 8h
      const esCargoMayor = ([
        TipoCargoAdministrativo.DECANO,
        TipoCargoAdministrativo.DIRECTOR_DE_ESCUELA,
        TipoCargoAdministrativo.DIRECTOR_DE_POSTGRADO,
        TipoCargoAdministrativo.JEFE_DE_DEPARTAMENTO,
      ] as TipoCargoAdministrativo[]).includes(activeCargo.tipoCargo);

      const limiteCargo = esCargoMayor ? 8 : 12;
      const cumpleCargo = totalLectivas <= limiteCargo;

      resultados.push({
        tipoRegla: TipoReglaValidacion.INCOMPATIBILIDAD_CARGO,
        cumple: cumpleCargo,
        mensaje: cumpleCargo
          ? `El docente cuenta con el cargo de ${activeCargo.tipoCargo} y su carga lectiva de ${totalLectivas}h no supera el límite de ${limiteCargo}h.`
          : `El docente tiene el cargo de ${activeCargo.tipoCargo} y su carga lectiva de ${totalLectivas}h excede el límite permitido de ${limiteCargo}h.`,
        metadata: { cargoId: activeCargo.id, tipoCargo: activeCargo.tipoCargo, limiteCargo, totalLectivas },
      });
    } else {
      resultados.push({
        tipoRegla: TipoReglaValidacion.INCOMPATIBILIDAD_CARGO,
        cumple: true,
        mensaje: 'El docente no cuenta con cargos administrativos activos que limiten su carga.',
      });
    }

    // 4. Validar cruces de sedes en el mismo día (Incompatibilidad de Sede Desconcentrada)
    // El docente no puede dictar en dos sedes diferentes el mismo día.
    const horariosProgramados = horarios.filter((h) => h.diaSemana !== null && h.sede !== null);
    const diasConClase = Array.from(new Set(horariosProgramados.map((h) => h.diaSemana!)));

    let cumpleSedes = true;
    const detallesSedes = [];

    for (const dia of diasConClase) {
      const clasesDelDia = horariosProgramados.filter((h) => h.diaSemana === dia);
      const sedesDelDia = Array.from(
        new Set(clasesDelDia.map((h) => (h.sede === 'SEDE_DESCENTRALIZADA' ? h.sedeDescentralizadaRef : 'SEDE_CENTRAL')))
      );

      if (sedesDelDia.length > 1) {
        cumpleSedes = false;
        detallesSedes.push({
          dia,
          sedes: sedesDelDia,
        });
      }
    }

    resultados.push({
      tipoRegla: TipoReglaValidacion.EXCEDE_LIMITE_SEDE_DESCENTRALIZADA,
      cumple: cumpleSedes,
      mensaje: cumpleSedes
        ? 'El docente dicta clases en una única sede por día, cumpliendo las reglas de traslados.'
        : `Incompatibilidad de sede detectada: El docente está programado en múltiples sedes el mismo día: ${detallesSedes
            .map((d) => `${d.dia} (${d.sedes.join(', ')})`)
            .join('; ')}.`,
      metadata: { detallesSedes },
    });

    // 5. Validar que si dicta en una sede desconcentrada, tenga una comisión de servicio registrada
    const comisionesActivas = docente.comisiones.filter((c) => c.activo);
    let cumpleComisiones = true;
    const clasesDesconcentradasSinComision = [];

    for (const h of horariosProgramados) {
      if (h.sede === 'SEDE_DESCENTRALIZADA' && h.sedeDescentralizadaRef) {
        const tieneComision = comisionesActivas.some(
          (c) =>
            c.sedeDestino === h.sedeDescentralizadaRef &&
            c.fechaInicio <= periodo.fechaFin &&
            c.fechaFin >= periodo.fechaInicio
        );

        if (!tieneComision) {
          cumpleComisiones = false;
          clasesDesconcentradasSinComision.push({
            horarioId: h.id,
            curso: h.curso.nombre,
            sede: h.sedeDescentralizadaRef,
          });
        }
      }
    }

    resultados.push({
      tipoRegla: TipoReglaValidacion.FALTA_COMISION_SERVICIO,
      cumple: cumpleComisiones,
      mensaje: cumpleComisiones
        ? 'El docente cuenta con comisiones de servicio vigentes para todos sus cursos en sedes desconcentradas.'
        : `El docente dicta cursos en sedes desconcentradas sin tener una Comisión de Servicio activa para: ${clasesDesconcentradasSinComision
            .map((c) => `${c.curso} en ${c.sede}`)
            .join(', ')}.`,
      metadata: { clasesDesconcentradasSinComision },
    });

    const valido = resultados.every((r) => r.cumple);

    return {
      valido,
      resultados,
    };
  }

  /**
   * Confirma la carga de un docente. Corre validaciones y, si pasa, actualiza los horarios
   */
  async confirmarCargaLectiva(docenteId: string, periodoId: string, usuarioId: string) {
    // 1. Ejecutar validaciones
    const { valido, resultados } = await this.ejecutarValidaciones(docenteId, periodoId);

    // 2. Si no es válido, lanzar error con listado de fallas
    if (!valido) {
      const fallas = resultados.filter((r) => !r.cumple).map((r) => r.mensaje);
      const err = new AppError(
        `No se pudo confirmar la carga lectiva debido a las siguientes restricciones: ${fallas.join(' | ')}`,
        400,
        'VALIDATION_FAILED'
      );
      (err as any).details = resultados;
      throw err;
    }

    // 3. Confirmar horarios en base de datos
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId,
        estado: { not: 'CANCELADO' },
      },
    });

    await prisma.$transaction(async (tx) => {
      // Confirmar todos los horarios
      await tx.horario.updateMany({
        where: {
          periodoId,
          docenteId,
          estado: { in: [EstadoHorario.BORRADOR, EstadoHorario.SELECCION_TEMPORAL] },
        },
        data: {
          estado: EstadoHorario.CONFIRMADO,
          confirmadoPor: usuarioId,
          fechaConfirmacion: new Date(),
        },
      });

      // Eliminar validaciones previas de estos horarios
      const horarioIds = horarios.map((h) => h.id);
      await tx.validacionHorario.deleteMany({
        where: {
          horarioId: { in: horarioIds },
        },
      });

      // Guardar registros de validaciones pasadas en ValidacionHorario
      for (const h of horarios) {
        for (const res of resultados) {
          await tx.validacionHorario.create({
            data: {
              horarioId: h.id,
              tipoRegla: res.tipoRegla,
              cumple: res.cumple,
              mensaje: res.mensaje,
              metadata: res.metadata || {},
            },
          });
        }
      }

      // Registrar auditoría
      await tx.registroAuditoria.create({
        data: {
          usuarioId,
          accion: 'CONFIRMAR_CARGA_LECTIVA_DOCENTE',
          entidad: 'Docente',
          entidadId: docenteId,
          datos: {
            periodoId,
            horariosConfirmados: horarioIds.length,
          },
        },
      });
    });

    return {
      message: 'Carga horaria lectiva confirmada exitosamente',
      resultados,
    };
  }

  private obtenerHorasDedicacion(dedicacion: DedicacionDocente): number {
    switch (dedicacion) {
      case DedicacionDocente.TIEMPO_COMPLETO_40H:
      case DedicacionDocente.DEDICACION_EXCLUSIVA:
        return 40;
      case DedicacionDocente.TIEMPO_PARCIAL_20H:
        return 20;
      default:
        return 40;
    }
  }
}
