import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export interface VentanaStatus {
  ventanaId: string;
  nombre: string;
  categorias: string[];
  estado: string;
  progreso: {
    total: number;
    atendidos: number;
    enEspera: number;
    enAtencion: number;
    ausentes: number;
    porcentajeCompletado: number;
  };
  docenteActual: {
    nombre: string;
    codigo: string;
    tiempoRestante: number;
  } | null;
  tiempoPromedioAtencion: number;
}

export class MonitorVentanasService {
  private readonly CACHE_TTL = 30; // 30 segundos

  /**
   * Obtiene el estado actual de todas las ventanas activas
   */
  async getVentanasActivas(): Promise<VentanaStatus[]> {
    const cacheKey = 'monitor:ventanas:activas';
    
    // Intentar obtener de caché
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const ventanas = await prisma.ventanaAtencion.findMany({
      where: {
        estado: { in: ['ABIERTA', 'EN_CURSO'] },
      },
      include: {
        periodo: {
          select: { nombre: true },
        },
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

    const estados: VentanaStatus[] = ventanas.map(ventana => {
      const atendidos = ventana.atenciones.filter(a => a.estado === 'ATENDIDO').length;
      const enEspera = ventana.atenciones.filter(a => a.estado === 'ESPERANDO').length;
      const enAtencion = ventana.atenciones.filter(a => a.estado === 'EN_ATENCION');
      const ausentes = ventana.atenciones.filter(a => a.estado === 'AUSENTE').length;
      const total = ventana.atenciones.length;

      const docenteActual = enAtencion[0] 
        ? {
            nombre: `${enAtencion[0].docente.usuario.nombre} ${enAtencion[0].docente.usuario.apellidos}`,
            codigo: enAtencion[0].docente.codigo,
            tiempoRestante: 0, // Se actualizaría con el temporizador
          }
        : null;

      return {
        ventanaId: ventana.id,
        nombre: ventana.nombre,
        categorias: ventana.categorias as string[],
        estado: ventana.estado,
        progreso: {
          total,
          atendidos,
          enEspera,
          enAtencion: enAtencion.length,
          ausentes,
          porcentajeCompletado: total > 0 ? Math.round(((atendidos + ausentes) / total) * 100) : 0,
        },
        docenteActual,
        tiempoPromedioAtencion: 0, // Se calcularía con datos históricos
      };
    });

    // Guardar en caché
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(estados));

    return estados;
  }

  /**
   * Obtiene métricas en tiempo real de una ventana
   */
  async getMetricasVentana(ventanaId: string): Promise<{
    tiempoPromedioEspera: number;
    tasaAtencion: number;
    docentesPorHora: number;
    tiempoEstimadoFinalizacion: Date | null;
  }> {
    const atenciones = await prisma.atencionVentana.findMany({
      where: { ventanaId },
      orderBy: { posicion: 'asc' },
    });

    const atendidos = atenciones.filter(a => a.estado === 'ATENDIDO' && a.horaInicio && a.horaFin);
    const enEspera = atenciones.filter(a => a.estado === 'ESPERANDO').length;

    // Calcular tiempo promedio de espera (simplificado)
    let tiempoPromedioEspera = 0;
    if (atendidos.length > 0) {
      const tiemposEspera = atendidos.map(a => {
        const inicio = new Date(a.horaInicio!).getTime();
        const fin = new Date(a.horaFin!).getTime();
        return (fin - inicio) / 60000;
      });
      tiempoPromedioEspera = Math.round(tiemposEspera.reduce((a, b) => a + b, 0) / tiemposEspera.length);
    }

    // Calcular tasa de atención (docentes por hora)
    const primeraAtencion = atendidos[0];
    const ultimaAtencion = atendidos[atendidos.length - 1];
    let docentesPorHora = 0;

    if (primeraAtencion && ultimaAtencion && atendidos.length > 1) {
      const tiempoTotal = new Date(ultimaAtencion.horaFin!).getTime() - 
                         new Date(primeraAtencion.horaInicio!).getTime();
      const horas = tiempoTotal / 3600000;
      docentesPorHora = horas > 0 ? Math.round(atendidos.length / horas) : 0;
    }

    // Estimar tiempo de finalización
    let tiempoEstimadoFinalizacion: Date | null = null;
    if (docentesPorHora > 0 && enEspera > 0) {
      const horasRestantes = enEspera / docentesPorHora;
      tiempoEstimadoFinalizacion = new Date(Date.now() + horasRestantes * 3600000);
    }

    return {
      tiempoPromedioEspera,
      tasaAtencion: docentesPorHora,
      docentesPorHora,
      tiempoEstimadoFinalizacion,
    };
  }

  /**
   * Notifica cambios en el estado de las ventanas
   */
  async notificarCambio(ventanaId: string, evento: string, datos: any): Promise<void> {
    await redis.publish('ws:ventanas', JSON.stringify({
      type: evento,
      channel: `ventana:${ventanaId}`,
      data: datos,
      timestamp: new Date().toISOString(),
    }));

    // Invalidar caché
    await redis.del('monitor:ventanas:activas');
  }

  /**
   * Obtiene un resumen general de todas las ventanas
   */
  async getResumenGeneral(): Promise<{
    ventanasActivas: number;
    totalDocentesAtendidos: number;
    totalDocentesEnEspera: number;
    ventanas: Array<{
      nombre: string;
      categorias: string[];
      progreso: number;
    }>;
  }> {
    const ventanas = await this.getVentanasActivas();

    return {
      ventanasActivas: ventanas.length,
      totalDocentesAtendidos: ventanas.reduce((sum, v) => sum + v.progreso.atendidos, 0),
      totalDocentesEnEspera: ventanas.reduce((sum, v) => sum + v.progreso.enEspera, 0),
      ventanas: ventanas.map(v => ({
        nombre: v.nombre,
        categorias: v.categorias,
        progreso: v.progreso.porcentajeCompletado,
      })),
    };
  }
}