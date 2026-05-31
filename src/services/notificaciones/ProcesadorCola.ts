import { redis } from '@/lib/redis';
import { GestorNotificaciones } from './GestorNotificaciones';
import { ServicioCorreo } from './ServicioCorreo';
import { CanalNotificacion } from '@prisma/client';
import { TemporizadorService } from '../ventanas/TemporizadorService';

export class ProcesadorCola {
  private gestorNotificaciones: GestorNotificaciones;
  private intervalo: NodeJS.Timeout | null = null;
  private procesando = false;
  private readonly INTERVALO_PROCESAMIENTO = 5000; // 5 segundos

  constructor() {
    this.gestorNotificaciones = new GestorNotificaciones();
  }

  /**
   * Inicia el procesador de cola
   */
  iniciar(): void {
    if (this.intervalo) return;

    console.log('🔄 Iniciando procesador de cola de notificaciones...');
    
    this.intervalo = setInterval(async () => {
      if (!this.procesando) {
        this.procesando = true;
        try {
          await this.procesarTodasLasColas();
          await this.procesarNotificacionesProgramadas();
          
          // Procesar alertas y vencimientos de temporizadores de atención
          const temporizadorService = new TemporizadorService();
          await temporizadorService.procesarTemporizadoresPendientes();
        } catch (error) {
          console.error('Error en procesador de cola:', error);
        } finally {
          this.procesando = false;
        }
      }
    }, this.INTERVALO_PROCESAMIENTO);
  }

  /**
   * Detiene el procesador de cola
   */
  detener(): void {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
      console.log('⏹️ Procesador de cola detenido');
    }
  }

  /**
   * Procesa todas las colas por prioridad
   */
  private async procesarTodasLasColas(): Promise<void> {
    const colas = ['notificaciones:alta', 'notificaciones:media', 'notificaciones:baja'];

    for (const cola of colas) {
      await this.gestorNotificaciones.procesarCola(cola);
    }
  }

  /**
   * Procesa notificaciones programadas que deben enviarse
   */
  private async procesarNotificacionesProgramadas(): Promise<void> {
    const ahora = Date.now();
    
    // Obtener notificaciones programadas cuyo tiempo ha llegado
    const programadas = await redis.zrangebyscore(
      'notificaciones:programadas',
      0,
      ahora,
      'LIMIT',
      0,
      50
    );

    for (const programada of programadas) {
      try {
        const notificacion = JSON.parse(programada);
        
        // Enviar a la cola correspondiente
        const cola = this.obtenerColaPorPrioridad(notificacion.prioridad);
        await redis.lpush(cola, JSON.stringify(notificacion));

        // Eliminar de programadas
        await redis.zrem('notificaciones:programadas', programada);
      } catch (error) {
        console.error('Error procesando notificación programada:', error);
      }
    }
  }

  /**
   * Reintenta notificaciones fallidas
   */
  async reintentarFallidas(limite: number = 100): Promise<number> {
    const colaFallidas = 'notificaciones:fallidas';
    const reintentos = await redis.lrange(colaFallidas, 0, limite - 1);
    
    let reintentadas = 0;
    for (const reintento of reintentos) {
      const notificacion = JSON.parse(reintento);
      
      if (notificacion.intentos < 3) {
        notificacion.intentos++;
        const cola = this.obtenerColaPorPrioridad(notificacion.prioridad);
        await redis.lpush(cola, JSON.stringify(notificacion));
        reintentadas++;
      }
      
      await redis.lpop(colaFallidas);
    }

    return reintentadas;
  }

  /**
   * Obtiene estadísticas del procesador
   */
  async getEstadisticas(): Promise<{
    estado: string;
    colas: Record<string, number>;
    programadas: number;
    fallidas: number;
  }> {
    const colas = {
      alta: await redis.llen('notificaciones:alta'),
      media: await redis.llen('notificaciones:media'),
      baja: await redis.llen('notificaciones:baja'),
    };

    const programadas = await redis.zcard('notificaciones:programadas');
    const fallidas = await redis.llen('notificaciones:fallidas');

    return {
      estado: this.intervalo ? 'ejecutando' : 'detenido',
      colas,
      programadas,
      fallidas,
    };
  }

  private obtenerColaPorPrioridad(prioridad: string): string {
    switch (prioridad) {
      case 'URGENTE':
      case 'ALTA':
        return 'notificaciones:alta';
      case 'MEDIA':
        return 'notificaciones:media';
      default:
        return 'notificaciones:baja';
    }
  }
}