import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/services/auth/AuthService';
import { EstadoVentana, EstadoAtencion, CategoriaDocente } from '@prisma/client';
import { TemporizadorService } from './TemporizadorService';
import { GestorNotificaciones } from '../notificaciones/GestorNotificaciones';

export interface CrearVentanaDTO {
  periodoId: string;
  nombre: string;
  categorias: string[];
  fechaInicio: Date | string;
  fechaFin: Date | string;
}

export interface ConfigurarVentanaDTO {
  horaInicio?: string;
  horaFin?: string;
  duracionAtencion?: number; // minutos
  maxDocentesPorDia?: number;
  ordenCategorias?: string[];
}

export class GestorVentanasAtencion {
  private readonly CACHE_TTL = 300; // 5 minutos

  async listarVentanas(periodoId?: string, estado?: EstadoVentana) {
    const where: any = {};
    if (periodoId) where.periodoId = periodoId;
    if (estado) where.estado = estado;

    const ventanas = await prisma.ventanaAtencion.findMany({
      where,
      include: {
        periodo: {
          select: { id: true, nombre: true },
        },
        _count: {
          select: { atenciones: true },
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });

    return ventanas;
  }

  async autoProcesarVentanas() {
    const ahora = new Date();

    // 1. Abrir ventanas PROGRAMADAS cuya fechaInicio ya pasó
    const programadas = await prisma.ventanaAtencion.findMany({
      where: {
        estado: 'PROGRAMADA',
        fechaInicio: { lte: ahora },
      },
    });

    for (const v of programadas) {
      try {
        console.log(`[Auto-Open] Abriendo ventana ${v.nombre} (${v.id})...`);
        await this.abrirVentana(v.id);
      } catch (err) {
        console.error(`Error abriendo ventana automáticamente (${v.id}):`, err);
      }
    }

    // 2. Cerrar ventanas ABIERTAS o EN_CURSO cuya fechaFin ya pasó
    const activas = await prisma.ventanaAtencion.findMany({
      where: {
        estado: { in: ['ABIERTA', 'EN_CURSO'] },
        fechaFin: { lte: ahora },
      },
    });

    for (const v of activas) {
      try {
        console.log(`[Auto-Close] Cerrando ventana ${v.nombre} (${v.id})...`);
        await this.cerrarVentana(v.id);
      } catch (err) {
        console.error(`Error cerrando ventana automáticamente (${v.id}):`, err);
      }
    }
  }

  async obtenerVentana(id: string) {
    const ventana = await prisma.ventanaAtencion.findUnique({
      where: { id },
      include: {
        periodo: {
          select: { id: true, nombre: true },
        },
        atenciones: {
          include: {
            docente: {
              include: {
                usuario: {
                  select: { id: true, nombre: true, apellidos: true, email: true },
                },
              },
            },
          },
          orderBy: { posicion: 'asc' },
        },
      },
    });

    if (!ventana) {
      throw new AppError('Ventana de atención no encontrada', 404, 'VENTANA_NOT_FOUND');
    }

    return ventana;
  }

  async crearVentana(datos: CrearVentanaDTO) {
    // Validar que el período exista
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: datos.periodoId },
    });

    if (!periodo) {
      throw new AppError('Período no encontrado', 404, 'PERIODO_NOT_FOUND');
    }

    // Verificar que no haya otra ventana activa para alguna de las categorías
    const ventanasActivas = await prisma.ventanaAtencion.findMany({
      where: {
        periodoId: datos.periodoId,
        estado: { in: ['PROGRAMADA', 'ABIERTA', 'EN_CURSO'] },
      },
    });

    const catSet = new Set(datos.categorias);
    const overlapping = ventanasActivas.some(v => {
      const vCats = v.categorias as string[];
      return vCats.some(c => catSet.has(c));
    });

    if (overlapping) {
      throw new AppError(
        'Ya existe una ventana activa para alguna de estas categorías',
        409,
        'VENTANA_DUPLICADA'
      );
    }

    const ventana = await prisma.ventanaAtencion.create({
      data: {
        periodoId: datos.periodoId,
        nombre: datos.nombre,
        categorias: datos.categorias,
        fechaInicio: new Date(datos.fechaInicio),
        fechaFin: new Date(datos.fechaFin),
      },
      include: {
        periodo: true,
      },
    });

    return ventana;
  }

  async abrirVentana(id: string) {
    const ventana = await this.obtenerVentana(id);

    if (ventana.estado !== 'PROGRAMADA') {
      throw new AppError('La ventana no está programada', 400, 'VENTANA_NO_PROGRAMADA');
    }

    // Generar cola de docentes por orden de atención
    await this.generarColaDocentes(id);

    const ventanaActualizada = await prisma.ventanaAtencion.update({
      where: { id },
      data: { estado: 'ABIERTA' },
      include: {
        atenciones: {
          include: {
            docente: {
              include: {
                usuario: {
                  select: { nombre: true, apellidos: true },
                },
              },
            },
          },
          orderBy: { posicion: 'asc' },
        },
      },
    });

    // Publicar evento WebSocket
    await redis.publish('ws:ventanas', JSON.stringify({
      type: 'VENTANA_ABIERTA',
      channel: 'ventanas',
      data: ventanaActualizada,
      timestamp: new Date().toISOString(),
    }));

    return ventanaActualizada;
  }

  async cerrarVentana(id: string) {
    const ventana = await this.obtenerVentana(id);

    if (!['ABIERTA', 'EN_CURSO'].includes(ventana.estado)) {
      throw new AppError('La ventana no está abierta', 400, 'VENTANA_NO_ABIERTA');
    }

    // Marcar docentes no atendidos como ausentes
    await prisma.atencionVentana.updateMany({
      where: {
        ventanaId: id,
        estado: { in: ['ESPERANDO', 'EN_ATENCION'] },
      },
      data: { estado: 'AUSENTE' },
    });

    const ventanaActualizada = await prisma.ventanaAtencion.update({
      where: { id },
      data: { estado: 'CERRADA' },
    });

    await redis.publish('ws:ventanas', JSON.stringify({
      type: 'VENTANA_CERRADA',
      channel: 'ventanas',
      data: ventanaActualizada,
      timestamp: new Date().toISOString(),
    }));

    return ventanaActualizada;
  }

  async llamarSiguienteDocente(ventanaId: string) {
    const ventana = await this.obtenerVentana(ventanaId);

    if (!['ABIERTA', 'EN_CURSO'].includes(ventana.estado)) {
      throw new AppError('La ventana no está activa', 400, 'VENTANA_NO_ACTIVA');
    }

    // Buscar el siguiente docente en espera
    const siguiente = await prisma.atencionVentana.findFirst({
      where: {
        ventanaId,
        estado: 'ESPERANDO',
      },
      include: {
        docente: {
          include: {
            usuario: {
              select: { id: true, nombre: true, apellidos: true, email: true },
            },
            preferenciasNotificacion: true,
          },
        },
      },
      orderBy: { posicion: 'asc' },
    });

    if (!siguiente) {
      // No hay más docentes, cerrar ventana
      await this.cerrarVentana(ventanaId);
      return {
        mensaje: 'No hay más docentes en espera. Ventana cerrada.',
        ventanaCerrada: true,
      };
    }

    // Marcar como en atención
    await prisma.atencionVentana.update({
      where: { id: siguiente.id },
      data: {
        estado: 'EN_ATENCION',
        horaInicio: new Date(),
      },
    });

    // Iniciar temporizador en Redis
    const temporizadorService = new TemporizadorService();
    await temporizadorService.iniciarTemporizador({
      ventanaId: ventana.id,
      atencionId: siguiente.id,
      duracionMinutos: 15,
      inicio: new Date(),
    });

    // Enviar notificaciones omnicanal
    const gestorNotificaciones = new GestorNotificaciones();
    const tituloNotif = 'Es su turno de atención';
    const mensajeNotif = `Por favor, acérquese a la ${ventana.nombre} para seleccionar su horario. Dispone de 15 minutos.`;
    const prefs = siguiente.docente.preferenciasNotificacion;
    
    // Canales habilitados para el envío
    const canales: any[] = [];
    if (prefs) {
      if (prefs.correoActivo) canales.push('CORREO');
      if (prefs.whatsappActivo && siguiente.docente.whatsapp) canales.push('WHATSAPP');
      if (prefs.telegramActivo && siguiente.docente.telegramId) canales.push('TELEGRAM');
      if (prefs.sistemaActivo) canales.push('SISTEMA');
    } else {
      canales.push('SISTEMA');
    }

    for (const canal of canales) {
      try {
        await gestorNotificaciones.enviarNotificacion({
          usuarioId: siguiente.docente.usuarioId,
          tipo: 'VENTANA_ATENCION',
          titulo: tituloNotif,
          mensaje: mensajeNotif,
          prioridad: 'URGENTE',
          canal,
          metadata: {
            ventanaId,
            atencionId: siguiente.id,
            tiempoLimiteSegundos: 900,
          },
        });
      } catch (err) {
        console.error(`Error enviando notificación de turno al docente por canal ${canal}:`, err);
      }
    }

    // Actualizar estado de la ventana
    if (ventana.estado === 'ABIERTA') {
      await prisma.ventanaAtencion.update({
        where: { id: ventanaId },
        data: { estado: 'EN_CURSO' },
      });
    }

    // Publicar en WebSocket
    await redis.publish('ws:ventanas', JSON.stringify({
      type: 'LLAMANDO_DOCENTE',
      channel: `ventana:${ventanaId}`,
      data: {
        atencionId: siguiente.id,
        docente: siguiente.docente,
        posicion: siguiente.posicion,
      },
      timestamp: new Date().toISOString(),
    }));

    // Notificar al docente
    await redis.publish('ws:notificaciones', JSON.stringify({
      type: 'NOTIFICACION_DOCENTE',
      channel: `notificacion:docente-${siguiente.docente.usuario.id}`,
      data: {
        titulo: 'Es su turno de atención',
        mensaje: `Por favor, acérquese a la ${ventana.nombre}`,
        ventanaId,
        docenteId: siguiente.docenteId,
      },
      timestamp: new Date().toISOString(),
    }));

    return {
      mensaje: 'Docente llamado exitosamente',
      atencion: siguiente,
      ventanaCerrada: false,
    };
  }

  async marcarDocenteAtendido(ventanaId: string, atencionId: string) {
    const atencion = await prisma.atencionVentana.findFirst({
      where: {
        id: atencionId,
        ventanaId,
      },
    });

    if (!atencion) {
      throw new AppError('Atención no encontrada', 404, 'ATENCION_NOT_FOUND');
    }

    if (atencion.estado !== 'EN_ATENCION') {
      throw new AppError('El docente no está siendo atendido', 400, 'DOCENTE_NO_EN_ATENCION');
    }

    const atencionActualizada = await prisma.atencionVentana.update({
      where: { id: atencionId },
      data: {
        estado: 'ATENDIDO',
        horaFin: new Date(),
      },
    });

    // Actualizar caché de disponibilidad
    await redis.del(`disponibilidad:${atencionActualizada.ventanaId}:*`);

    return atencionActualizada;
  }

  async marcarDocenteAusente(ventanaId: string, atencionId: string) {
    const atencion = await prisma.atencionVentana.findFirst({
      where: {
        id: atencionId,
        ventanaId,
      },
    });

    if (!atencion) {
      throw new AppError('Atención no encontrada', 404, 'ATENCION_NOT_FOUND');
    }

    const atencionActualizada = await prisma.atencionVentana.update({
      where: { id: atencionId },
      data: { estado: 'AUSENTE' },
    });

    return atencionActualizada;
  }

  async obtenerCola(ventanaId: string) {
    const cola = await prisma.atencionVentana.findMany({
      where: { ventanaId },
      include: {
        docente: {
          include: {
            usuario: {
              select: { id: true, nombre: true, apellidos: true },
            },
          },
        },
      },
      orderBy: { posicion: 'asc' },
    });

    return {
      ventanaId,
      total: cola.length,
      enEspera: cola.filter(a => a.estado === 'ESPERANDO').length,
      enAtencion: cola.filter(a => a.estado === 'EN_ATENCION').length,
      atendidos: cola.filter(a => a.estado === 'ATENDIDO').length,
      ausentes: cola.filter(a => a.estado === 'AUSENTE').length,
      cola,
    };
  }

  /**
   * Calcula la hora estimada de inicio del turno de un docente en la cola
   * @param ventanaId ID de la ventana de atención
   * @param posicion Posición del docente en la cola (1-indexed)
   * @returns Date con la hora estimada de inicio
   */
  async calcularHoraEstimadaTurno(ventanaId: string, posicion: number): Promise<Date> {
    const ventana = await prisma.ventanaAtencion.findUnique({
      where: { id: ventanaId },
      select: { fechaInicio: true },
    });

    if (!ventana) {
      throw new AppError('Ventana de atención no encontrada', 404, 'VENTANA_NOT_FOUND');
    }

    const DURACION_TURNO_MS = 15 * 60 * 1000; // 15 minutos en milisegundos
    const delay = (posicion - 1) * DURACION_TURNO_MS;
    return new Date(new Date(ventana.fechaInicio).getTime() + delay);
  }

  private async generarColaDocentes(ventanaId: string) {
    const ventana = await this.obtenerVentana(ventanaId);

    const cats = ventana.categorias as CategoriaDocente[];
    // Obtener docentes de las categorías de la ventana
    const docentes = await prisma.docente.findMany({
      where: {
        categoria: { in: cats },
        usuario: { activo: true },
      },
      orderBy: { codigo: 'asc' },
    });

    // Ordenar docentes según el orden de categorias en la ventana, y luego por código
    docentes.sort((a, b) => {
      const idxA = cats.indexOf(a.categoria);
      const idxB = cats.indexOf(b.categoria);
      if (idxA !== idxB) return idxA - idxB;
      return a.codigo.localeCompare(b.codigo);
    });

    // Crear atenciones en orden
    const atenciones = docentes.map((docente, index) => ({
      ventanaId,
      docenteId: docente.id,
      posicion: index + 1,
      estado: 'ESPERANDO' as EstadoAtencion,
    }));

    // Insertar en lotes
    await prisma.atencionVentana.createMany({
      data: atenciones,
    });

    return atenciones;
  }
}