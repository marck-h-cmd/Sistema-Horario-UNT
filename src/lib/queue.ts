import { Queue, Worker, QueueEvents } from 'bullmq';
import { ReporteService } from '@/services/reporteService';
import { GestorNotificaciones } from '@/services/notificaciones/GestorNotificaciones';

// Parse Redis connection
const getRedisConnection = () => {
  const urlStr = process.env.REDIS_URL;
  if (urlStr) {
    try {
      const url = new URL(urlStr);
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password ? decodeURIComponent(url.password) : undefined,
        maxRetriesPerRequest: null,
      };
    } catch (e) {
      console.error('Error parsing REDIS_URL for BullMQ:', e);
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
};

const connection = getRedisConnection();

// Global types to prevent double instantiation in Next.js dev server
const globalForQueue = globalThis as unknown as {
  pdfQueue: Queue | undefined;
  notificationQueue: Queue | undefined;
  pdfWorker: Worker | undefined;
  notifWorker: Worker | undefined;
};

// 1. Queues
export const pdfGenerationQueue = globalForQueue.pdfQueue ?? new Queue('pdfGenerationQueue', { connection });
export const notificationQueue = globalForQueue.notificationQueue ?? new Queue('notificationQueue', { connection });

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.pdfQueue = pdfGenerationQueue;
  globalForQueue.notificationQueue = notificationQueue;
}

// 2. Worker Logic
const inicializarWorkers = () => {
  if (globalForQueue.pdfWorker && globalForQueue.notifWorker) {
    return;
  }

  console.log('👷 Iniciando Workers de BullMQ...');

  // Worker para Generación de PDFs
  const pdfWorker = new Worker(
    'pdfGenerationQueue',
    async (job) => {
      console.log(`[Job ${job.id}] Procesando lote de PDFs...`);
      const { periodoId, docenteIds } = job.data;
      const service = new ReporteService();
      await service.procesarLoteGeneracion(periodoId, docenteIds, job.id!);
      console.log(`[Job ${job.id}] Generación de lote completada.`);
    },
    { connection, concurrency: 2 }
  );

  pdfWorker.on('failed', (job, err) => {
    console.error(`[Job ${job?.id}] Falló:`, err);
  });

  // Worker para Notificaciones
  const notifWorker = new Worker(
    'notificationQueue',
    async (job) => {
      console.log(`[Job ${job.id}] Enviando notificación...`);
      const { usuarioId, tipo, titulo, mensaje, prioridad, canal, metadata } = job.data;
      const gestor = new GestorNotificaciones();
      await gestor.enviarNotificacion({
        usuarioId,
        tipo,
        titulo,
        mensaje,
        prioridad,
        canal,
        metadata,
      });
      console.log(`[Job ${job.id}] Notificación enviada con éxito.`);
    },
    { connection, concurrency: 5 }
  );

  notifWorker.on('failed', (job, err) => {
    console.error(`[Job ${job?.id}] Envío fallido:`, err);
  });

  globalForQueue.pdfWorker = pdfWorker;
  globalForQueue.notifWorker = notifWorker;
};

// Start workers immediately on import
inicializarWorkers();
