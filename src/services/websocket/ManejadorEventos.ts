import { ServidorWebSocket } from './ServidorWebSocket';

export type EventoHandler = (datos: any, servidor: ServidorWebSocket) => void;

export class ManejadorEventos {
  private handlers: Map<string, EventoHandler[]> = new Map();
  private servidorWS: ServidorWebSocket;

  constructor(servidorWS: ServidorWebSocket) {
    this.servidorWS = servidorWS;
    this.registrarHandlersPorDefecto();
  }

  /**
   * Registra un handler para un tipo de evento
   */
  on(evento: string, handler: EventoHandler): void {
    if (!this.handlers.has(evento)) {
      this.handlers.set(evento, []);
    }
    this.handlers.get(evento)!.push(handler);
  }

  /**
   * Emite un evento a los handlers registrados
   */
  emit(evento: string, datos: any): void {
    const handlers = this.handlers.get(evento);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(datos, this.servidorWS);
        } catch (error) {
          console.error(`Error en handler de evento ${evento}:`, error);
        }
      }
    }
  }

  /**
   * Registra handlers por defecto del sistema
   */
  private registrarHandlersPorDefecto(): void {
    // Evento de disponibilidad actualizada
    this.on('disponibilidad:actualizada', (datos, servidor) => {
      servidor.enviarACanal('disponibilidad', {
        type: 'disponibilidad:actualizada',
        data: datos,
        timestamp: new Date().toISOString(),
      });
    });

    // Evento de horario creado
    this.on('horario:creado', (datos, servidor) => {
      servidor.enviarARol('SECRETARIA', {
        type: 'horario:creado',
        data: datos,
        timestamp: new Date().toISOString(),
      });

      if (datos.docenteId) {
        servidor.enviarAUsuario(datos.docenteId, {
          type: 'horario:creado',
          data: datos,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Evento de ventana actualizada
    this.on('ventana:actualizada', (datos, servidor) => {
      servidor.enviarACanal('ventanas', {
        type: 'ventana:actualizada',
        data: datos,
        timestamp: new Date().toISOString(),
      });
    });

    // Evento de notificación
    this.on('notificacion:enviada', (datos, servidor) => {
      if (datos.usuarioId) {
        servidor.enviarAUsuario(datos.usuarioId, {
          type: 'notificacion',
          data: datos,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}