import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotorAsignacion } from '@/services/horarios/MotorAsignacion';
import { ValidadorConflictos } from '@/services/horarios/ValidadorConflictos';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    horario: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    curso: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'curso-1',
        codigo: 'IS101',
        nombre: 'Programación',
        creditos: 4,
        horasTeoria: 2,
        horasPractica: 4,
        horasLaboratorio: 0,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    docente: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'doc-1',
        codigo: 'DOC001',
        categoria: 'PRINCIPAL',
        activo: true,
        usuario: { id: 'user-1', nombre: 'Juan', apellidos: 'Pérez' },
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ambiente: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'amb-1',
        codigo: 'A101',
        nombre: 'Aula 101',
        tipo: 'AULA',
        capacidad: 40,
        activo: true,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    periodoAcademico: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'periodo-1',
        nombre: '2024-II',
        estado: 'ACTIVO',
        activo: true,
      }),
    },
    cursoDocente: {
      findUnique: vi.fn().mockResolvedValue({
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        horasAsignadas: 6,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    grupo: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    validacionHorario: {
      create: vi.fn().mockResolvedValue({}),
    },
    configuracionPeriodo: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    mantenimientoAmbiente: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    disponibilidadDocente: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    diaNoLaborable: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('Flujo de Asignación de Horario - Integración', () => {
  let motor: MotorAsignacion;

  beforeEach(() => {
    motor = new MotorAsignacion();
    vi.clearAllMocks();
  });

  describe('Flujo exitoso: asignación sin conflictos', () => {
    it('debe completar el flujo completo de asignación', async () => {
      // 1. El docente tiene el curso asignado
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        horasAsignadas: 6,
      });

      // 2. Hay ambiente disponible
      (prisma.ambiente.findMany as any).mockResolvedValueOnce([
        { id: 'amb-1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA', capacidad: 40 },
      ]);

      // 3. No hay conflictos
      (prisma.horario.count as any).mockResolvedValue(0);
      (prisma.horario.findMany as any).mockResolvedValue([]);

      // 4. Se crea el horario exitosamente
      (prisma.horario.create as any).mockResolvedValueOnce({
        id: 'horario-nuevo-1',
        periodoId: 'periodo-1',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        ambienteId: 'amb-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '10:00',
        estado: 'BORRADOR',
        curso: { codigo: 'IS101', nombre: 'Programación' },
        docente: {
          usuario: { nombre: 'Juan', apellidos: 'Pérez' },
        },
        ambiente: { codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        grupo: null,
      });

      const resultado = await motor.asignarHorario({
        periodoId: 'periodo-1',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '10:00',
      });

      expect(resultado.exitoso).toBe(true);
      expect(resultado.horarioId).toBe('horario-nuevo-1');
      expect(resultado.mensaje).toContain('Horario asignado exitosamente');
      expect(prisma.horario.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Flujo con conflicto: docente ocupado', () => {
    it('debe detectar conflicto de docente y retornar alternativa', async () => {
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        horasAsignadas: 6,
      });

      // Ambiente disponible
      (prisma.ambiente.findMany as any).mockResolvedValue([
        { id: 'amb-2', codigo: 'A102', nombre: 'Aula 102', tipo: 'AULA', capacidad: 35 },
      ]);

      // Docente ocupado en ese horario
      (prisma.horario.findMany as any).mockImplementation((args: any) => {
        // Retornar conflicto de docente si se consulta el horario ocupado (LUNES 08:00-10:00)
        if (
          args?.where?.docenteId === 'doc-1' && 
          args?.where?.diaSemana === 'LUNES' && 
          args?.where?.OR?.[0]?.horaInicio?.lt === '10:00'
        ) {
          return Promise.resolve([
            {
              id: 'horario-conflicto',
              curso: { id: 'c-otro', codigo: 'IS201', nombre: 'Otro Curso' },
              docente: {
                usuario: { nombre: 'Juan', apellidos: 'Pérez' },
              },
              ambiente: { id: 'amb-x', codigo: 'A103', nombre: 'Aula 103', tipo: 'AULA' },
              grupo: null,
              diaSemana: 'LUNES',
              horaInicio: '08:00',
              horaFin: '10:00',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      // El ambiente alternativo está libre
      (prisma.horario.count as any).mockResolvedValue(0);

      const resultado = await motor.asignarHorario({
        periodoId: 'periodo-1',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '10:00',
      });

      expect(resultado.exitoso).toBe(false);
      // El conflicto debe existir
      expect(resultado.conflicto).toBeDefined();
      expect(resultado.conflicto!.tipo).toBe('CRUCE_DOCENTE');
      expect(resultado.mensaje).toContain('Conflicto detectado');
    });
  });

  describe('Flujo: asignación automática de docente por jerarquía', () => {
    it('debe seleccionar el mejor docente disponible según jerarquía', async () => {
      // Docentes del curso ordenados por jerarquía
      (prisma.cursoDocente.findMany as any).mockResolvedValueOnce([
        {
          docente: {
            id: 'doc-principal',
            codigo: 'DOC001',
            categoria: 'PRINCIPAL',
            activo: true,
            usuario: { id: 'u1', nombre: 'Juan', apellidos: 'Principal' },
          },
        },
        {
          docente: {
            id: 'doc-asociado',
            codigo: 'DOC002',
            categoria: 'ASOCIADO',
            activo: true,
            usuario: { id: 'u2', nombre: 'María', apellidos: 'Asociado' },
          },
        },
      ]);

      // El principal está libre
      (prisma.horario.count as any)
        .mockResolvedValueOnce(0) // principal libre
        .mockResolvedValue(0);

      // Asignación del curso
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'doc-principal',
      });

      // Ambiente disponible
      (prisma.ambiente.findMany as any).mockResolvedValueOnce([
        { id: 'amb-1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA', capacidad: 40 },
      ]);

      // Crear horario
      (prisma.horario.create as any).mockResolvedValueOnce({
        id: 'horario-jerarquia',
        curso: { codigo: 'IS101', nombre: 'Programación' },
        docente: { usuario: { nombre: 'Juan', apellidos: 'Principal' } },
        ambiente: { codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        grupo: null,
      });

      const resultado = await motor.asignarHorario({
        periodoId: 'periodo-1',
        cursoId: 'curso-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '10:00',
      });

      expect(resultado.exitoso).toBe(true);
    });
  });

  describe('Flujo: sin docentes disponibles', () => {
    it('debe retornar error cuando no hay docentes para el curso', async () => {
      (prisma.cursoDocente.findMany as any).mockResolvedValueOnce([]);

      const resultado = await motor.asignarHorario({
        periodoId: 'periodo-1',
        cursoId: 'curso-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '10:00',
      });

      expect(resultado.exitoso).toBe(false);
      expect(resultado.mensaje).toContain('No se encontró ningún docente disponible');
    });
  });
});