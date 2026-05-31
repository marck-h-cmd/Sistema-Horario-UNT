import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { GestorNotificaciones } from '../notificaciones/GestorNotificaciones';

export interface TemporizadorConfig {
  ventanaId: string;
  atencionId: string;
  duracionMinutos: number;
  inicio: Date;
}

export class TemporizadorService {
  private readonly PREFIX = 'temporizador:';
  private readonly DEFAULT_DURATION = 15; // minutos

  /**
   * Inicia un temporizador para una atención
   */
  async iniciarTemporizador(config: TemporizadorConfig): Promise<void> {
    const key = `${this.PREFIX}${config.atencionId}`;
    const data = {
      ...config,
      inicio: config.inicio.toISOString(),
      fin: new Date(config.inicio.getTime() + config.duracionMinutos * 60000).toISOString(),
      notificado5min: false,
      notificado1min: false,
    };

    await redis.setex(key, config.duracionMinutos * 60 + 300, JSON.stringify(data));

    // Programar notificaciones
    await this.programarNotificaciones(config);
  }

  /**
   * Programa notificaciones de advertencia
   */
  private async programarNotificaciones(config: TemporizadorConfig): Promise<void> {
    const tiempoTotal = config.duracionMinutos * 60;
    const avisos = [
      { cuando: tiempoTotal - 300, mensaje: 'Quedan 5 minutos de atención' }, // 5 min antes
      { cuando: tiempoTotal - 60, mensaje: 'Queda 1 minuto de atención' },    // 1 min antes
      { cuando: tiempoTotal, mensaje: 'Tiempo de atención finalizado' },       // Al finalizar
    ];

    for (const aviso of avisos) {
      if (aviso.cuando > 0) {
        const ejecutarEn = new Date(config.inicio.getTime() + aviso.cuando * 1000);
        const delay = ejecutarEn.getTime() - Date.now();

        if (delay > 0) {
          // Programar en Redis usando sorted sets
          await redis.zadd('temporizadores:programados', ejecutarEn.getTime(), JSON.stringify({
            atencionId: config.atencionId,
            ventanaId: config.ventanaId,
            mensaje: aviso.mensaje,
            ejecutarEn: ejecutarEn.toISOString(),
          }));
        }
      }
    }
  }

  /**
   * Obtiene el tiempo restante de un temporizador
   */
  async getTiempoRestante(atencionId: string): Promise<{
    minutosRestantes: number;
    segundosRestantes: number;
    porcentajeCompletado: number;
    finalizado: boolean;
  } | null> {
    const key = `${this.PREFIX}${atencionId}`;
    const data = await redis.get(key);

    if (!data) return null;

    const temporizador = JSON.parse(data);
    const fin = new Date(temporizador.fin).getTime();
    const ahora = Date.now();
    const restante = Math.max(0, fin - ahora);

    const total = temporizador.duracionMinutos * 60 * 1000;
    const transcurrido = total - restante;

    return {
      minutosRestantes: Math.ceil(restante / 60000),
      segundosRestantes: Math.ceil(restante / 1000),
      porcentajeCompletado: Math.min(100, Math.round((transcurrido / total) * 100)),
      finalizado: restante <= 0,
    };
  }

  /**
   * Detiene un temporizador
   */
  async detenerTemporizador(atencionId: string): Promise<void> {
    const key = `${this.PREFIX}${atencionId}`;
    await redis.del(key);
  }

  /**
   * Extiende el tiempo de un temporizador
   */
  async extenderTemporizador(atencionId: string, minutosExtra: number): Promise<void> {
    const key = `${this.PREFIX}${atencionId}`;
    const data = await redis.get(key);

    if (!data) return;

    const temporizador = JSON.parse(data);
    temporizador.duracionMinutos += minutosExtra;
    temporizador.fin = new Date(
      new Date(temporizador.fin).getTime() + minutosExtra * 60000
    ).toISOString();

    const ttl = await redis.ttl(key);
    await redis.setex(key, ttl + minutosExtra * 60, JSON.stringify(temporizador));
  }

  /**
   * Procesa temporizadores programados
   */
  async procesarTemporizadoresPendientes(): Promise<void> {
    const ahora = Date.now();
    
    // Obtener temporizadores que deben ejecutarse
    const pendientes = await redis.zrangebyscore(
      'temporizadores:programados',
      0,
      ahora
    );

    for (const pendiente of pendientes) {
      const tarea = JSON.parse(pendiente);
      
      // Publicar evento WebSocket
      await redis.publish('ws:ventanas', JSON.stringify({
        type: 'TEMPORIZADOR_ALERTA',
        channel: `ventana:${tarea.ventanaId}`,
        data: {
          atencionId: tarea.atencionId,
          mensaje: tarea.mensaje,
        },
        timestamp: new Date().toISOString(),
      }));

      // Si el tiempo de atención ha finalizado, marcar en la base de datos como AUSENTE
      if (tarea.mensaje === 'Tiempo de atención finalizado') {
        try {
          const atencion = await prisma.atencionVentana.findUnique({
            where: { id: tarea.atencionId },
            include: {
              docente: {
                include: { preferenciasNotificacion: true }
              }
            }
          });

          if (atencion && atencion.estado === 'EN_ATENCION') {
            // Marcar como ausente
            await prisma.atencionVentana.update({
              where: { id: tarea.atencionId },
              data: { estado: 'AUSENTE' },
            });

            // Enviar notificación de expiración omnicanal
            const gestorNotificaciones = new GestorNotificaciones();
            const prefs = atencion.docente.preferenciasNotificacion;
            const canales: any[] = [];
            if (prefs) {
              if (prefs.correoActivo) canales.push('CORREO');
              if (prefs.whatsappActivo && atencion.docente.whatsapp) canales.push('WHATSAPP');
              if (prefs.telegramActivo && atencion.docente.telegramId) canales.push('TELEGRAM');
              if (prefs.sistemaActivo) canales.push('SISTEMA');
            } else {
              canales.push('SISTEMA');
            }

            for (const canal of canales) {
              try {
                await gestorNotificaciones.enviarNotificacion({
                  usuarioId: atencion.docente.usuarioId,
                  tipo: 'VENTANA_ATENCION',
                  titulo: 'Turno Expirado',
                  mensaje: 'Su tiempo límite de 15 minutos para seleccionar horario ha finalizado y su turno ha sido marcado como ausente.',
                  prioridad: 'ALTA',
                  canal,
                  metadata: {
                    ventanaId: tarea.ventanaId,
                    atencionId: tarea.atencionId,
                  },
                });
              } catch (err) {
                console.error(`Error enviando notificación de turno expirado al docente por canal ${canal}:`, err);
              }
            }

            // WebSocket para notificar el fin de turno en la grilla y cola
            await redis.publish('ws:ventanas', JSON.stringify({
              type: 'TURNO_EXPIRADO',
              channel: `ventana:${tarea.ventanaId}`,
              data: {
                atencionId: tarea.atencionId,
                docenteId: atencion.docenteId,
              },
              timestamp: new Date().toISOString(),
            }));
          }
        } catch (error) {
          console.error('Error procesando expiración de turno en backend:', error);
        }
      }

      // Eliminar de pendientes
      await redis.zrem('temporizadores:programados', pendiente);
    }
  }

  /**
   * Obtiene estadísticas de tiempos de atención
   */
  async getEstadisticasTiempos(ventanaId: string): Promise<{
    promedioAtencion: number;
    atencionMasLarga: number;
    atencionMasCorta: number;
    totalAtendidos: number;
  }> {
    const atenciones = await prisma.atencionVentana.findMany({
      where: {
        ventanaId,
        estado: 'ATENDIDO',
        horaInicio: { not: null },
        horaFin: { not: null },
      },
      select: {
        horaInicio: true,
        horaFin: true,
      },
    });

    if (atenciones.length === 0) {
      return {
        promedioAtencion: 0,
        atencionMasLarga: 0,
        atencionMasCorta: 0,
        totalAtendidos: 0,
      };
    }

    const duraciones = atenciones.map(a => {
      const inicio = new Date(a.horaInicio!).getTime();
      const fin = new Date(a.horaFin!).getTime();
      return Math.round((fin - inicio) / 60000); // en minutos
    });

    return {
      promedioAtencion: Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length),
      atencionMasLarga: Math.max(...duraciones),
      atencionMasCorta: Math.min(...duraciones),
      totalAtendidos: atenciones.length,
    };
  }
}