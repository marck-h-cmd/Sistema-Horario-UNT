import { prisma } from '@/lib/prisma';
import { DiaSemana, EstadoHorario, TipoAmbiente } from '@prisma/client';

/**
 * Tipos de conflicto que pueden detectarse
 */
export type TipoConflicto = 
  | 'CRUCE_DOCENTE' 
  | 'CRUCE_AULA' 
  | 'CRUCE_LABORATORIO' 
  | 'CRUCE_GRUPO';

/**
 * Severidad del conflicto
 */
export type SeveridadConflicto = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Representa un conflicto detectado entre dos o más horarios
 */
export interface ConflictoHorario {
  tipo: TipoConflicto;
  severidad: SeveridadConflicto;
  mensaje: string;
  horarioActual: {
    id?: string;
    cursoNombre: string;
    docenteNombre: string;
    ambienteNombre: string;
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
  };
  horarioConflicto: {
    id: string;
    cursoNombre: string;
    docenteNombre: string;
    ambienteNombre: string;
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Resultado de la validación de conflictos
 */
export interface ResultadoValidacionConflictos {
  valido: boolean;
  totalConflictos: number;
  conflictos: ConflictoHorario[];
  resumen: {
    cruceDocente: number;
    cruceAula: number;
    cruceLaboratorio: number;
    cruceGrupo: number;
  };
}

/**
 * Opciones para la validación de conflictos
 */
export interface OpcionesValidacionConflictos {
  periodoId: string;
  docenteId: string;
  cursoId: string;
  ambienteId: string;
  grupoId?: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  /** ID del horario a excluir (para ediciones) */
  horarioIdExcluir?: string;
  /** Si debe validar cada tipo de conflicto */
  validarDocente?: boolean;
  validarAmbiente?: boolean;
  validarGrupo?: boolean;
}

/**
 * Validador especializado en detectar conflictos de cruce de horarios.
 * 
 * Verifica solapamientos en:
 * - Docente: mismo docente no puede estar en dos lugares al mismo tiempo
 * - Aula: misma aula no puede tener dos cursos simultáneos
 * - Laboratorio: mismo laboratorio no puede tener dos cursos simultáneos
 * - Grupo/Sección: mismo grupo no puede tener dos cursos al mismo tiempo
 * 
 * Regla de solapamiento: dos horarios se solapan si comparten día y 
 * [horaInicio1 < horaFin2] Y [horaInicio2 < horaFin1]
 */
export class ValidadorConflictos {
  
  /**
   * Valida todos los tipos de conflicto para una asignación de horario
   */
  async validarTodo(
    opciones: OpcionesValidacionConflictos
  ): Promise<ResultadoValidacionConflictos> {
    const conflictos: ConflictoHorario[] = [];
    
    const {
      periodoId,
      docenteId,
      cursoId,
      ambienteId,
      grupoId,
      diaSemana,
      horaInicio,
      horaFin,
      horarioIdExcluir,
      validarDocente = true,
      validarAmbiente = true,
      validarGrupo = true,
    } = opciones;

    // Obtener información del horario actual para los mensajes
    const [curso, docente, ambiente] = await Promise.all([
      prisma.curso.findUnique({ where: { id: cursoId }, select: { nombre: true } }),
      prisma.docente.findUnique({ 
        where: { id: docenteId }, 
        include: { usuario: { select: { nombre: true, apellidos: true } } } 
      }),
      prisma.ambiente.findUnique({ where: { id: ambienteId }, select: { nombre: true, tipo: true } }),
    ]);

    const horarioActualBase = {
      cursoNombre: curso?.nombre || 'Desconocido',
      docenteNombre: docente ? `${docente.usuario.nombre} ${docente.usuario.apellidos}` : 'Desconocido',
      ambienteNombre: ambiente?.nombre || 'Desconocido',
      diaSemana,
      horaInicio,
      horaFin,
    };

    // 1. Validar cruce de docente
    if (validarDocente) {
      const conflictosDocente = await this.validarCruceDocente(
        periodoId, docenteId, diaSemana, horaInicio, horaFin, horarioActualBase, horarioIdExcluir
      );
      conflictos.push(...conflictosDocente);
    }

    // 2. Validar cruce de ambiente (aula o laboratorio según el tipo)
    if (validarAmbiente) {
      const conflictosAmbiente = await this.validarCruceAmbiente(
        periodoId, ambienteId, diaSemana, horaInicio, horaFin, horarioActualBase, horarioIdExcluir
      );
      conflictos.push(...conflictosAmbiente);
    }

    // 3. Validar cruce de grupo/sección
    if (validarGrupo && grupoId) {
      const conflictosGrupo = await this.validarCruceGrupo(
        periodoId, grupoId, diaSemana, horaInicio, horaFin, horarioActualBase, horarioIdExcluir
      );
      conflictos.push(...conflictosGrupo);
    }

    // Construir resumen
    const resumen = {
      cruceDocente: conflictos.filter(c => c.tipo === 'CRUCE_DOCENTE').length,
      cruceAula: conflictos.filter(c => c.tipo === 'CRUCE_AULA').length,
      cruceLaboratorio: conflictos.filter(c => c.tipo === 'CRUCE_LABORATORIO').length,
      cruceGrupo: conflictos.filter(c => c.tipo === 'CRUCE_GRUPO').length,
    };

    return {
      valido: conflictos.length === 0,
      totalConflictos: conflictos.length,
      conflictos,
      resumen,
    };
  }

  /**
   * Valida cruce de docente: verifica que el docente no tenga otro horario
   * en el mismo día y franja horaria.
   */
  private async validarCruceDocente(
    periodoId: string,
    docenteId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    horarioActual: ConflictoHorario['horarioActual'],
    horarioIdExcluir?: string
  ): Promise<ConflictoHorario[]> {
    const where: any = {
      periodoId,
      docenteId,
      diaSemana,
      estado: { notIn: ['CANCELADO' as EstadoHorario] },
      // Condición de solapamiento: (horaInicio < horaFinOtro) AND (horaFin > horaInicioOtro)
      horaInicio: { lt: horaFin },
      horaFin: { gt: horaInicio },
    };

    // Excluir el propio horario en caso de edición
    if (horarioIdExcluir) {
      where.id = { not: horarioIdExcluir };
    }

    const horariosConflicto = await prisma.horario.findMany({
      where,
      include: {
        curso: { select: { id: true, codigo: true, nombre: true } },
        ambiente: { select: { id: true, codigo: true, nombre: true, tipo: true } },
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    });

    return horariosConflicto.map(hc => ({
      tipo: 'CRUCE_DOCENTE' as TipoConflicto,
      severidad: 'ERROR' as SeveridadConflicto,
      mensaje: `El docente "${horarioActual.docenteNombre}" ya tiene asignado el curso "${hc.curso.nombre}" en el ambiente "${hc.ambiente ? `${hc.ambiente.codigo} - ${hc.ambiente.nombre}` : 'Sin ambiente'}" el día ${this.traducirDia(diaSemana)} de ${hc.horaInicio} a ${hc.horaFin}. No puede estar en dos lugares al mismo tiempo.`,
      horarioActual,
      horarioConflicto: {
        id: hc.id,
        cursoNombre: hc.curso.nombre,
        docenteNombre: `${hc.docente.usuario.nombre} ${hc.docente.usuario.apellidos}`,
        ambienteNombre: hc.ambiente ? `${hc.ambiente.codigo} - ${hc.ambiente.nombre}` : 'Sin ambiente',
        diaSemana: hc.diaSemana!,
        horaInicio: hc.horaInicio!,
        horaFin: hc.horaFin!,
      },
      metadata: {
        horarioConflictoId: hc.id,
        cursoCodigo: hc.curso.codigo,
        ambienteCodigo: hc.ambiente ? hc.ambiente.codigo : undefined,
      },
    }));
  }

  /**
   * Valida cruce de ambiente: verifica que el ambiente no esté ocupado
   * en el mismo día y franja horaria. Diferencia entre AULA y LABORATORIO.
   */
  private async validarCruceAmbiente(
    periodoId: string,
    ambienteId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    horarioActual: ConflictoHorario['horarioActual'],
    horarioIdExcluir?: string
  ): Promise<ConflictoHorario[]> {
    const where: any = {
      periodoId,
      ambienteId,
      diaSemana,
      estado: { notIn: ['CANCELADO' as EstadoHorario] },
      horaInicio: { lt: horaFin },
      horaFin: { gt: horaInicio },
    };

    if (horarioIdExcluir) {
      where.id = { not: horarioIdExcluir };
    }

    const horariosConflicto = await prisma.horario.findMany({
      where,
      include: {
        curso: { select: { id: true, codigo: true, nombre: true } },
        ambiente: { select: { id: true, codigo: true, nombre: true, tipo: true } },
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    });

    return horariosConflicto.map(hc => {
      const tipoAmbiente = hc.ambiente ? hc.ambiente.tipo : 'AULA';
      const tipoConflicto: TipoConflicto = 
        tipoAmbiente === 'LABORATORIO' ? 'CRUCE_LABORATORIO' : 'CRUCE_AULA';

      let caso = '';
      const hcInicio = hc.horaInicio || '';
      const hcFin = hc.horaFin || '';
      if (horaInicio === hcInicio && horaFin === hcFin) {
        caso = '(Duplicado exacto) ';
      } else if ((horaInicio <= hcInicio && horaFin >= hcFin) || (hcInicio <= horaInicio && hcFin >= horaFin)) {
        caso = '(Contención) ';
      } else {
        caso = '(Solapamiento) ';
      }

      const descAmbiente = hc.ambiente 
        ? `${this.traducirTipoAmbiente(tipoAmbiente)} ${hc.ambiente.codigo} - ${hc.ambiente.nombre}`
        : 'Sin ambiente';
      return {
        tipo: tipoConflicto,
        severidad: 'ERROR' as SeveridadConflicto,
        mensaje: `${caso}El ${descAmbiente} ya está ocupado por ${hc.curso.codigo} de ${hc.horaInicio} a ${hc.horaFin}`,
        horarioActual,
        horarioConflicto: {
          id: hc.id,
          cursoNombre: hc.curso.nombre,
          docenteNombre: `${hc.docente.usuario.nombre} ${hc.docente.usuario.apellidos}`,
          ambienteNombre: hc.ambiente ? `${hc.ambiente.codigo} - ${hc.ambiente.nombre}` : 'Sin ambiente',
          diaSemana: hc.diaSemana!,
          horaInicio: hc.horaInicio!,
          horaFin: hc.horaFin!,
        },
        metadata: {
          horarioConflictoId: hc.id,
          cursoCodigo: hc.curso.codigo,
          tipoAmbiente: tipoAmbiente,
        },
      };
    });
  }

  /**
   * Valida cruce de grupo/sección: verifica que el mismo grupo no tenga
   * dos cursos programados en el mismo día y franja horaria.
   */
  private async validarCruceGrupo(
    periodoId: string,
    grupoId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    horarioActual: ConflictoHorario['horarioActual'],
    horarioIdExcluir?: string
  ): Promise<ConflictoHorario[]> {
    const where: any = {
      periodoId,
      grupoId,
      diaSemana,
      estado: { notIn: ['CANCELADO' as EstadoHorario] },
      horaInicio: { lt: horaFin },
      horaFin: { gt: horaInicio },
    };

    if (horarioIdExcluir) {
      where.id = { not: horarioIdExcluir };
    }

    const horariosConflicto = await prisma.horario.findMany({
      where,
      include: {
        curso: { select: { id: true, codigo: true, nombre: true } },
        ambiente: { select: { id: true, codigo: true, nombre: true } },
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    });

    return horariosConflicto.map(hc => ({
      tipo: 'CRUCE_GRUPO' as TipoConflicto,
      severidad: 'ERROR' as SeveridadConflicto,
      mensaje: `El grupo "${hc.grupo?.nombre || 'Desconocido'}" ya tiene programado el curso "${hc.curso.nombre}" el día ${this.traducirDia(diaSemana)} de ${hc.horaInicio} a ${hc.horaFin} en el ambiente "${hc.ambiente ? `${hc.ambiente.codigo} - ${hc.ambiente.nombre}` : 'Sin ambiente'}".`,
      horarioActual,
      horarioConflicto: {
        id: hc.id,
        cursoNombre: hc.curso.nombre,
        docenteNombre: `${hc.docente.usuario.nombre} ${hc.docente.usuario.apellidos}`,
        ambienteNombre: hc.ambiente ? `${hc.ambiente.codigo} - ${hc.ambiente.nombre}` : 'Sin ambiente',
        diaSemana: hc.diaSemana!,
        horaInicio: hc.horaInicio!,
        horaFin: hc.horaFin!,
      },
      metadata: {
        horarioConflictoId: hc.id,
        cursoCodigo: hc.curso.codigo,
        grupoNombre: hc.grupo?.nombre,
      },
    }));
  }

  /**
   * Valida si un rango horario específico está libre para un docente
   */
  async estaLibreDocente(
    periodoId: string,
    docenteId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    horarioIdExcluir?: string
  ): Promise<boolean> {
    const where: any = {
      periodoId,
      docenteId,
      diaSemana,
      estado: { notIn: ['CANCELADO' as EstadoHorario] },
      horaInicio: { lt: horaFin },
      horaFin: { gt: horaInicio },
    };

    if (horarioIdExcluir) {
      where.id = { not: horarioIdExcluir };
    }

    const count = await prisma.horario.count({ where });
    return count === 0;
  }

  /**
   * Valida si un rango horario específico está libre para un ambiente
   */
  async estaLibreAmbiente(
    periodoId: string,
    ambienteId: string,
    diaSemana: DiaSemana,
    horaInicio: string,
    horaFin: string,
    horarioIdExcluir?: string
  ): Promise<boolean> {
    const where: any = {
      periodoId,
      ambienteId,
      diaSemana,
      estado: { notIn: ['CANCELADO' as EstadoHorario] },
      horaInicio: { lt: horaFin },
      horaFin: { gt: horaInicio },
    };

    if (horarioIdExcluir) {
      where.id = { not: horarioIdExcluir };
    }

    const count = await prisma.horario.count({ where });
    return count === 0;
  }

  /**
   * Encuentra todos los conflictos de un docente en un período
   * Útil para reportes y visualización
   */
  async encontrarConflictosDocente(
    periodoId: string,
    docenteId: string
  ): Promise<ConflictoHorario[]> {
    const horarios = await prisma.horario.findMany({
      where: {
        periodoId,
        docenteId,
        estado: { notIn: ['CANCELADO' as EstadoHorario] },
      },
      include: {
        curso: { select: { nombre: true } },
        ambiente: { select: { nombre: true, tipo: true } },
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const conflictos: ConflictoHorario[] = [];
    
    // Filtrar solo los horarios que están programados (no son borradores sin fecha/hora)
    const horariosValidos = horarios.filter(
      (h): h is typeof h & { diaSemana: DiaSemana; horaInicio: string; horaFin: string } =>
        h.diaSemana !== null && h.horaInicio !== null && h.horaFin !== null
    );

    // Comparar cada par de horarios
    for (let i = 0; i < horariosValidos.length; i++) {
      for (let j = i + 1; j < horariosValidos.length; j++) {
        const h1 = horariosValidos[i];
        const h2 = horariosValidos[j];

        if (h1.diaSemana === h2.diaSemana) {
          // Verificar solapamiento
          if (h1.horaInicio < h2.horaFin && h2.horaInicio < h1.horaFin) {
            conflictos.push({
              tipo: 'CRUCE_DOCENTE',
              severidad: 'ERROR',
              mensaje: `Conflicto: "${h1.curso.nombre}" (${h1.horaInicio}-${h1.horaFin}) se solapa con "${h2.curso.nombre}" (${h2.horaInicio}-${h2.horaFin}) el día ${this.traducirDia(h1.diaSemana)}`,
              horarioActual: {
                id: h1.id,
                cursoNombre: h1.curso.nombre,
                docenteNombre: `${h1.docente.usuario.nombre} ${h1.docente.usuario.apellidos}`,
                ambienteNombre: h1.ambiente?.nombre || 'Sin ambiente',
                diaSemana: h1.diaSemana,
                horaInicio: h1.horaInicio,
                horaFin: h1.horaFin,
              },
              horarioConflicto: {
                id: h2.id,
                cursoNombre: h2.curso.nombre,
                docenteNombre: `${h2.docente.usuario.nombre} ${h2.docente.usuario.apellidos}`,
                ambienteNombre: h2.ambiente?.nombre || 'Sin ambiente',
                diaSemana: h2.diaSemana,
                horaInicio: h2.horaInicio,
                horaFin: h2.horaFin,
              },
            });
          }
        }
      }
    }

    return conflictos;
  }

  /**
   * Traduce el día de la semana a español
   */
  private traducirDia(dia: DiaSemana): string {
    const traducciones: Record<DiaSemana, string> = {
      LUNES: 'Lunes',
      MARTES: 'Martes',
      MIERCOLES: 'Miércoles',
      JUEVES: 'Jueves',
      VIERNES: 'Viernes',
      SABADO: 'Sábado',
      DOMINGO: 'Domingo',
    };
    return traducciones[dia] || dia;
  }

  /**
   * Traduce el tipo de ambiente a español
   */
  private traducirTipoAmbiente(tipo: TipoAmbiente): string {
    const traducciones: Record<TipoAmbiente, string> = {
      AULA: 'aula',
      LABORATORIO: 'laboratorio',
      AUDITORIO: 'auditorio',
      SALA_CONFERENCIAS: 'sala de conferencias',
    };
    return traducciones[tipo] || tipo;
  }
}