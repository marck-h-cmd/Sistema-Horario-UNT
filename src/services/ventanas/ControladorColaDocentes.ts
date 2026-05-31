import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { EstadoAtencion } from '@prisma/client';

export interface DocenteEnCola {
  atencionId: string;
  posicion: number;
  docenteId: string;
  codigo: string;
  nombre: string;
  apellidos: string;
  email: string;
  categoria: string;
  estado: EstadoAtencion;
  horaInicio: Date | null;
  horaFin: Date | null;
  fechaIngreso?: string | null;
}

export class ControladorColaDocentes {
  /**
   * Reordena la cola de docentes en una ventana
   */
  async reordenarCola(ventanaId: string, nuevoOrden: string[]): Promise<void> {
    const atenciones = await prisma.atencionVentana.findMany({
      where: { ventanaId },
    });

    const atencionesMap = new Map(atenciones.map(a => [a.id, a]));

    // Validar que todos los IDs existan
    for (const id of nuevoOrden) {
      if (!atencionesMap.has(id)) {
        throw new AppError(`Atención no encontrada: ${id}`, 404, 'ATENCION_NOT_FOUND');
      }
    }

    // Actualizar posiciones
    const updates = nuevoOrden.map((id, index) =>
      prisma.atencionVentana.update({
        where: { id },
        data: { posicion: index + 1 },
      })
    );

    await prisma.$transaction(updates);

    // Notificar cambio via WebSocket
    await redis.publish('ws:ventanas', JSON.stringify({
      type: 'COLA_REORDENADA',
      channel: `ventana:${ventanaId}`,
      data: { ventanaId, nuevoOrden },
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Agrega un docente a la cola
   */
  async agregarDocente(ventanaId: string, docenteId: string, posicion?: number): Promise<void> {
    // Verificar que el docente no esté ya en la cola
    const existente = await prisma.atencionVentana.findFirst({
      where: {
        ventanaId,
        docenteId,
        estado: { in: ['ESPERANDO', 'EN_ATENCION'] },
      },
    });

    if (existente) {
      throw new AppError('El docente ya está en la cola de esta ventana', 409, 'DOCENTE_DUPLICADO');
    }

    // Determinar posición
    let nuevaPosicion = posicion;
    if (!nuevaPosicion) {
      const ultima = await prisma.atencionVentana.findFirst({
        where: { ventanaId },
        orderBy: { posicion: 'desc' },
      });
      nuevaPosicion = (ultima?.posicion || 0) + 1;
    } else {
      // Desplazar docentes desde la posición indicada
      await prisma.atencionVentana.updateMany({
        where: {
          ventanaId,
          posicion: { gte: nuevaPosicion },
        },
        data: {
          posicion: { increment: 1 },
        },
      });
    }

    await prisma.atencionVentana.create({
      data: {
        ventanaId,
        docenteId,
        posicion: nuevaPosicion,
        estado: 'ESPERANDO',
      },
    });
  }

  /**
   * Elimina un docente de la cola
   */
  async eliminarDocente(ventanaId: string, atencionId: string): Promise<void> {
    const atencion = await prisma.atencionVentana.findFirst({
      where: { id: atencionId, ventanaId },
    });

    if (!atencion) {
      throw new AppError('Atención no encontrada', 404, 'ATENCION_NOT_FOUND');
    }

    if (atencion.estado === 'EN_ATENCION') {
      throw new AppError('No se puede eliminar un docente en atención', 400, 'DOCENTE_EN_ATENCION');
    }

    await prisma.atencionVentana.delete({
      where: { id: atencionId },
    });

    // Reordenar posiciones
    const restantes = await prisma.atencionVentana.findMany({
      where: {
        ventanaId,
        posicion: { gt: atencion.posicion },
      },
      orderBy: { posicion: 'asc' },
    });

    const updates = restantes.map(a =>
      prisma.atencionVentana.update({
        where: { id: a.id },
        data: { posicion: a.posicion - 1 },
      })
    );

    await prisma.$transaction(updates);
  }

  /**
   * Intercambia la posición de dos docentes en la cola
   */
  async intercambiarPosiciones(
    ventanaId: string,
    atencionId1: string,
    atencionId2: string
  ): Promise<void> {
    const [atencion1, atencion2] = await Promise.all([
      prisma.atencionVentana.findFirst({ where: { id: atencionId1, ventanaId } }),
      prisma.atencionVentana.findFirst({ where: { id: atencionId2, ventanaId } }),
    ]);

    if (!atencion1 || !atencion2) {
      throw new AppError('Una o ambas atenciones no encontradas', 404, 'ATENCION_NOT_FOUND');
    }

    await prisma.$transaction([
      prisma.atencionVentana.update({
        where: { id: atencionId1 },
        data: { posicion: atencion2.posicion },
      }),
      prisma.atencionVentana.update({
        where: { id: atencionId2 },
        data: { posicion: atencion1.posicion },
      }),
    ]);
  }

  /**
   * Obtiene la cola formateada para mostrar
   */
  async obtenerColaFormateada(ventanaId: string): Promise<{
    ventanaId: string;
    total: number;
    enEspera: DocenteEnCola[];
    enAtencion: DocenteEnCola | null;
    atendidos: number;
    ausentes: number;
  }> {
    const ORDEN_CATEGORIA: Record<string, number> = {
      PRINCIPAL: 1,
      ASOCIADO: 2,
      AUXILIAR: 3,
      CONTRATADO: 4,
      INVITADO: 5,
    };

    const atenciones = await prisma.atencionVentana.findMany({
      where: { ventanaId },
      include: {
        docente: {
          include: {
            usuario: true,
          },
        },
      },
    });

    atenciones.sort((a: any, b: any) => {
      const catA = ORDEN_CATEGORIA[a.docente.categoria] ?? 99;
      const catB = ORDEN_CATEGORIA[b.docente.categoria] ?? 99;
      if (catA !== catB) return catA - catB;

      const fechaA = a.docente.fechaIngreso
        ? new Date(a.docente.fechaIngreso).getTime()
        : Infinity;
      const fechaB = b.docente.fechaIngreso
        ? new Date(b.docente.fechaIngreso).getTime()
        : Infinity;
      return fechaA - fechaB;
    });

    const enEspera: DocenteEnCola[] = [];
    let enAtencion: DocenteEnCola | null = null;
    let atendidos = 0;
    let ausentes = 0;

    for (let i = 0; i < atenciones.length; i++) {
      const atencion = atenciones[i];
      const docenteEnCola: DocenteEnCola = {
        atencionId: atencion.id,
        posicion: i + 1,
        docenteId: atencion.docenteId,
        codigo: atencion.docente.codigo,
        nombre: atencion.docente.usuario.nombre,
        apellidos: atencion.docente.usuario.apellidos,
        email: atencion.docente.usuario.email,
        categoria: atencion.docente.categoria,
        estado: atencion.estado,
        horaInicio: atencion.horaInicio,
        horaFin: atencion.horaFin,
        fechaIngreso: atencion.docente.fechaIngreso?.toISOString(),
      };

      switch (atencion.estado) {
        case 'ESPERANDO':
          enEspera.push(docenteEnCola);
          break;
        case 'EN_ATENCION':
          enAtencion = docenteEnCola;
          break;
        case 'ATENDIDO':
          atendidos++;
          break;
        case 'AUSENTE':
          ausentes++;
          break;
      }
    }

    return {
      ventanaId,
      total: atenciones.length,
      enEspera,
      enAtencion,
      atendidos,
      ausentes,
    };
  }

  /**
   * Reprograma el turno de un docente ausente o justificado colocándolo al final de la cola activa de espera
   * @param ventanaId ID de la ventana de atención
   * @param docenteId ID del docente a reprogramar
   */
  async reprogramarTurno(ventanaId: string, docenteId: string): Promise<void> {
    const atencion = await prisma.atencionVentana.findFirst({
      where: {
        ventanaId,
        docenteId,
      },
    });

    if (!atencion) {
      throw new AppError('Registro de atención no encontrado para el docente', 404, 'ATENCION_NOT_FOUND');
    }

    if (atencion.estado !== 'AUSENTE') {
      throw new AppError('Solo se pueden reprogramar docentes con estado AUSENTE o JUSTIFICADO', 400, 'DOCENTE_NO_AUSENTE');
    }

    // Obtener la posición máxima actual entre docentes con estado ESPERANDO
    const maxAtencion = await prisma.atencionVentana.findFirst({
      where: {
        ventanaId,
        estado: 'ESPERANDO',
      },
      orderBy: {
        posicion: 'desc',
      },
    });

    const maxPosicion = maxAtencion?.posicion || 0;
    const nuevaPosicion = maxPosicion + 1;

    // Desplazar docentes desde la posición indicada para evitar colisión de posiciones
    await prisma.atencionVentana.updateMany({
      where: {
        ventanaId,
        posicion: { gte: nuevaPosicion },
      },
      data: {
        posicion: { increment: 1 },
      },
    });

    // Actualizar posición y cambiar estado a ESPERANDO
    await prisma.atencionVentana.update({
      where: { id: atencion.id },
      data: {
        posicion: nuevaPosicion,
        estado: 'ESPERANDO',
        horaInicio: null,
        horaFin: null,
      },
    });

    // Registrar log de auditoría
    await prisma.registroAuditoria.create({
      data: {
        accion: 'REPROGRAMAR_TURNO',
        entidad: 'AtencionVentana',
        entidadId: atencion.id,
        datos: {
          docenteId,
          ventanaId,
          posicionAnterior: atencion.posicion,
          posicionNueva: nuevaPosicion,
          motivo: 'Docente reprogramado después de ausencia/justificación',
        },
      },
    });

    // Emitir evento WebSocket "cola:actualizada"
    await redis.publish('ws:ventanas', JSON.stringify({
      type: 'cola:actualizada',
      channel: `ventana:${ventanaId}`,
      data: { ventanaId, docenteId, posicionAnterior: atencion.posicion, posicionNueva: nuevaPosicion },
      timestamp: new Date().toISOString(),
    }));
  }
}