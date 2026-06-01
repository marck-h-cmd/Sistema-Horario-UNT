import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';

// Mock de Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ventanaAtencion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    atencionVentana: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    periodoAcademico: {
      findUnique: vi.fn(),
    },
    docente: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    publish: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(1800),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    incr: vi.fn().mockResolvedValue(1),
    lpush: vi.fn().mockResolvedValue(1),
    rpop: vi.fn().mockResolvedValue(null),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zcard: vi.fn().mockResolvedValue(0),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => ({
      lpush: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

describe('GestorVentanasAtencion', () => {
  let gestor: GestorVentanasAtencion;

  // Datos mock completos para findUnique con include
  const ventanaCompletaMock = {
    id: 'ventana-1',
    periodoId: 'periodo-1',
    nombre: 'Ventana Test',
    categoria: 'PRINCIPAL',
    fechaInicio: new Date('2024-09-01'),
    fechaFin: new Date('2024-09-15'),
    estado: 'PROGRAMADA',
    ordenAtencion: ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR'],
    createdAt: new Date(),
    updatedAt: new Date(),
    periodo: {
      id: 'periodo-1',
      nombre: '2024-II',
    },
    atenciones: [],
  };

  const ventanaAbiertaMock = {
    ...ventanaCompletaMock,
    estado: 'ABIERTA',
  };

  const ventanaEnCursoMock = {
    ...ventanaCompletaMock,
    estado: 'EN_CURSO',
  };

  const atencionMock = {
    id: 'atencion-1',
    ventanaId: 'ventana-1',
    docenteId: 'doc-1',
    posicion: 1,
    estado: 'ESPERANDO',
    horaInicio: null,
    horaFin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    docente: {
      id: 'doc-1',
      codigo: 'DOC001',
      categoria: 'PRINCIPAL',
      departamento: 'Ingeniería',
      usuario: {
        id: 'user-1',
        nombre: 'Juan',
        apellidos: 'Pérez García',
        email: 'juan.perez@unitru.edu.pe',
      },
      preferenciasNotificacion: {
        sistemaActivo: true,
        correoActivo: true,
        whatsappActivo: false,
        telegramActivo: false,
      },
    },
  };

  beforeEach(() => {
    gestor = new GestorVentanasAtencion();
    vi.clearAllMocks();
  });

  describe('listarVentanas', () => {
    it('debe listar ventanas sin filtros', async () => {
      (prisma.ventanaAtencion.findMany as any).mockResolvedValueOnce([
        {
          id: 'v1',
          nombre: 'Ventana Principal',
          categoria: 'PRINCIPAL',
          estado: 'PROGRAMADA',
          fechaInicio: new Date(),
          fechaFin: new Date(),
          periodo: { id: 'p1', nombre: '2024-II' },
          _count: { atenciones: 0 },
        },
      ]);

      const ventanas = await gestor.listarVentanas();

      expect(ventanas).toHaveLength(1);
      expect(ventanas[0].nombre).toBe('Ventana Principal');
    });

    it('debe filtrar por período', async () => {
      (prisma.ventanaAtencion.findMany as any).mockResolvedValueOnce([]);

      await gestor.listarVentanas('periodo-1');

      expect(prisma.ventanaAtencion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ periodoId: 'periodo-1' }),
        })
      );
    });

    it('debe filtrar por estado', async () => {
      (prisma.ventanaAtencion.findMany as any).mockResolvedValueOnce([]);

      await gestor.listarVentanas(undefined, 'ABIERTA');

      expect(prisma.ventanaAtencion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'ABIERTA' }),
        })
      );
    });
  });

  describe('crearVentana', () => {
    const datosCrear = {
      periodoId: 'periodo-1',
      nombre: 'Ventana Principal 2024-II',
      categoria: 'PRINCIPAL' as const,
      fechaInicio: '2024-09-01',
      fechaFin: '2024-09-15',
      ordenAtencion: ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR'],
    };

    it('debe crear una ventana exitosamente', async () => {
      (prisma.periodoAcademico.findUnique as any).mockResolvedValueOnce({
        id: 'periodo-1',
        nombre: '2024-II',
        estado: 'ACTIVO',
      });

      (prisma.ventanaAtencion.findFirst as any).mockResolvedValueOnce(null);

      (prisma.ventanaAtencion.create as any).mockResolvedValueOnce({
        id: 'ventana-nueva',
        ...datosCrear,
        fechaInicio: new Date(datosCrear.fechaInicio),
        fechaFin: new Date(datosCrear.fechaFin),
        estado: 'PROGRAMADA',
        ordenAtencion: datosCrear.ordenAtencion,
        periodo: { id: 'periodo-1', nombre: '2024-II' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ventana = await gestor.crearVentana(datosCrear);

      expect(ventana).toBeDefined();
      expect(ventana.id).toBe('ventana-nueva');
      expect(ventana.nombre).toBe('Ventana Principal 2024-II');
      expect(prisma.ventanaAtencion.create).toHaveBeenCalled();
    });

    it('debe rechazar si el período no existe', async () => {
      (prisma.periodoAcademico.findUnique as any).mockResolvedValueOnce(null);

      await expect(gestor.crearVentana(datosCrear)).rejects.toThrow('Período no encontrado');
    });

    it('debe rechazar si ya existe ventana activa para la misma categoría', async () => {
      (prisma.periodoAcademico.findUnique as any).mockResolvedValueOnce({
        id: 'periodo-1',
        nombre: '2024-II',
      });

      (prisma.ventanaAtencion.findFirst as any).mockResolvedValueOnce({
        id: 'ventana-existente',
        estado: 'ABIERTA',
      });

      await expect(gestor.crearVentana(datosCrear)).rejects.toThrow('Ya existe una ventana activa');
    });
  });

  describe('obtenerVentana', () => {
    it('debe retornar ventana con sus relaciones', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce(ventanaCompletaMock);

      const ventana = await gestor.obtenerVentana('ventana-1');

      expect(ventana).toBeDefined();
      expect(ventana.id).toBe('ventana-1');
      expect(ventana.periodo.nombre).toBe('2024-II');
    });

    it('debe lanzar error si no existe', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce(null);

      await expect(gestor.obtenerVentana('no-existe')).rejects.toThrow('Ventana de atención no encontrada');
    });
  });

  describe('abrirVentana', () => {
    it('debe abrir una ventana programada y generar cola de docentes', async () => {
      // Mock findUnique para obtenerVentana (llamado internamente)
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValue(ventanaCompletaMock);

      // Mock docentes de la categoría
      (prisma.docente.findMany as any).mockResolvedValueOnce([
        { id: 'doc-1', categoria: 'PRINCIPAL', activo: true, usuario: { activo: true } },
        { id: 'doc-2', categoria: 'PRINCIPAL', activo: true, usuario: { activo: true } },
      ]);

      // Mock createMany de atenciones
      (prisma.atencionVentana.createMany as any).mockResolvedValueOnce({ count: 2 });

      // Mock update para cambiar estado
      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaCompletaMock,
        estado: 'ABIERTA',
        atenciones: [
          { ...atencionMock, posicion: 1 },
          { ...atencionMock, id: 'atencion-2', posicion: 2, docenteId: 'doc-2' },
        ],
      });

      const resultado = await gestor.abrirVentana('ventana-1');

      expect(resultado).toBeDefined();
      expect(resultado.estado).toBe('ABIERTA');
      expect(prisma.docente.findMany).toHaveBeenCalled();
      expect(prisma.atencionVentana.createMany).toHaveBeenCalled();
      expect(prisma.ventanaAtencion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ventana-1' },
          data: { estado: 'ABIERTA' },
        })
      );
    });

    it('debe rechazar si la ventana no está programada', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce({
        ...ventanaCompletaMock,
        estado: 'ABIERTA',
      });

      await expect(gestor.abrirVentana('ventana-1')).rejects.toThrow('no está programada');
    });
  });

  describe('cerrarVentana', () => {
    it('debe cerrar una ventana abierta y marcar docentes como ausentes', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValue(ventanaAbiertaMock);

      (prisma.atencionVentana.updateMany as any).mockResolvedValueOnce({ count: 3 });

      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaAbiertaMock,
        estado: 'CERRADA',
      });

      const resultado = await gestor.cerrarVentana('ventana-1');

      expect(resultado).toBeDefined();
      expect(resultado.estado).toBe('CERRADA');
      expect(prisma.atencionVentana.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ventanaId: 'ventana-1',
            estado: { in: ['ESPERANDO', 'EN_ATENCION'] },
          },
          data: { estado: 'AUSENTE' },
        })
      );
    });

    it('debe rechazar si la ventana no está abierta', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce({
        ...ventanaCompletaMock,
        estado: 'PROGRAMADA',
      });

      await expect(gestor.cerrarVentana('ventana-1')).rejects.toThrow('no está abierta');
    });
  });

  describe('llamarSiguienteDocente', () => {
    it('debe llamar al siguiente docente en espera', async () => {
      // Ventana en estado ABIERTA
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValue(ventanaAbiertaMock);

      // Siguiente docente en espera
      (prisma.atencionVentana.findFirst as any).mockResolvedValueOnce(atencionMock);

      // Actualizar atención a EN_ATENCION
      (prisma.atencionVentana.update as any).mockResolvedValueOnce({
        ...atencionMock,
        estado: 'EN_ATENCION',
        horaInicio: new Date(),
      });

      // Actualizar ventana a EN_CURSO
      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaAbiertaMock,
        estado: 'EN_CURSO',
      });

      const resultado = await gestor.llamarSiguienteDocente('ventana-1');

      expect(resultado.ventanaCerrada).toBe(false);
      expect(resultado.mensaje).toContain('Docente llamado exitosamente');
      expect(resultado.atencion).toBeDefined();
      expect(resultado.atencion.docente.usuario.nombre).toBe('Juan');
      expect(prisma.atencionVentana.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'atencion-1' },
          data: expect.objectContaining({
            estado: 'EN_ATENCION',
          }),
        })
      );
    });

    it('debe cerrar ventana si no hay más docentes en espera', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValue(ventanaEnCursoMock);

      // No hay docentes en espera
      (prisma.atencionVentana.findFirst as any).mockResolvedValueOnce(null);

      // Mock del cierre
      (prisma.atencionVentana.updateMany as any).mockResolvedValueOnce({ count: 0 });
      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaEnCursoMock,
        estado: 'CERRADA',
      });

      const resultado = await gestor.llamarSiguienteDocente('ventana-1');

      expect(resultado.ventanaCerrada).toBe(true);
      expect(resultado.mensaje).toContain('No hay más docentes');
    });

    it('debe notificar vía WebSocket al llamar docente', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValue(ventanaAbiertaMock);
      (prisma.atencionVentana.findFirst as any).mockResolvedValueOnce(atencionMock);
      (prisma.atencionVentana.update as any).mockResolvedValueOnce({
        ...atencionMock,
        estado: 'EN_ATENCION',
      });
      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaAbiertaMock,
        estado: 'EN_CURSO',
      });

      await gestor.llamarSiguienteDocente('ventana-1');

      // Verificar que se publicó en WebSocket
      expect(redis.publish).toHaveBeenCalledWith(
        'ws:ventanas',
        expect.stringContaining('LLAMANDO_DOCENTE')
      );
    });
  });

  describe('obtenerCola', () => {
    it('debe retornar la cola con estadísticas', async () => {
      (prisma.atencionVentana.findMany as any).mockResolvedValueOnce([
        { ...atencionMock, estado: 'ATENDIDO', posicion: 1 },
        { ...atencionMock, id: 'at-2', estado: 'EN_ATENCION', posicion: 2 },
        { ...atencionMock, id: 'at-3', estado: 'ESPERANDO', posicion: 3 },
        { ...atencionMock, id: 'at-4', estado: 'ESPERANDO', posicion: 4 },
        { ...atencionMock, id: 'at-5', estado: 'AUSENTE', posicion: 5 },
      ]);

      const cola = await gestor.obtenerCola('ventana-1');

      expect(cola.total).toBe(5);
      expect(cola.enEspera).toBe(2);
      expect(cola.enAtencion).toBe(1);
      expect(cola.atendidos).toBe(1);
      expect(cola.ausentes).toBe(1);
    });
  });

  describe('saltarTurno', () => {
    it('debe saltar el turno correctamente restando deltaSeconds a updatedAt', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce({
        ...ventanaAbiertaMock,
        updatedAt: new Date('2026-06-01T12:00:00Z'),
      });

      (prisma.ventanaAtencion.update as any).mockResolvedValueOnce({
        ...ventanaAbiertaMock,
        updatedAt: new Date('2026-06-01T11:45:00Z'),
      });

      const resultado = await gestor.saltarTurno('ventana-1', 900);

      expect(resultado).toBeDefined();
      expect(prisma.ventanaAtencion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ventana-1' },
          data: expect.objectContaining({
            updatedAt: expect.any(Date),
          }),
        })
      );
      expect(redis.publish).toHaveBeenCalledWith(
        'ws:ventanas',
        expect.stringContaining('VENTANA_SHIFTED')
      );
    });

    it('debe rechazar si la ventana no está activa', async () => {
      (prisma.ventanaAtencion.findUnique as any).mockResolvedValueOnce({
        ...ventanaCompletaMock,
        estado: 'PROGRAMADA',
      });

      await expect(gestor.saltarTurno('ventana-1', 900)).rejects.toThrow('La ventana no está activa');
    });
  });
});