import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';
import { ValidadorConflictos } from '@/services/horarios/ValidadorConflictos';
import { MotorAsignacion } from '@/services/horarios/MotorAsignacion';
import { DiaSemana } from '@prisma/client';

// Mock de Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    horario: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    curso: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'curso-1',
        codigo: 'IS101',
        nombre: 'Introducción a la Programación',
        creditos: 4,
        horasTeoria: 2,
        horasPractica: 4,
        horasLaboratorio: 0,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    docente: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'docente-1',
        codigo: 'DOC001',
        categoria: 'PRINCIPAL',
        usuario: { id: 'user-1', nombre: 'Juan', apellidos: 'Pérez' },
      }),
    },
    ambiente: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ambiente-1',
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
        docenteId: 'docente-1',
        horasAsignadas: 6,
      }),
      findFirst: vi.fn().mockResolvedValue({
        cursoId: 'curso-1',
        docenteId: 'docente-1',
        horasAsignadas: 6,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    grupo: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    configuracionPeriodo: {
      findUnique: vi.fn().mockResolvedValue({
        horasMaxDiariasDocente: 8,
        horasMaxContinuas: 4,
        descansoMinEntreHoras: 1,
      }),
    },
    disponibilidadDocente: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    mantenimientoAmbiente: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    diaNoLaborable: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    validacionHorario: {
      create: vi.fn().mockResolvedValue({}),
    },
    planEstudioCurso: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'curso-1',
        horasLaboratorio: 0,
        horasTeoria: 2,
        horasPractica: 4,
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'curso-1',
        horasLaboratorio: 0,
        horasTeoria: 2,
        horasPractica: 4,
      }),
    },
    cursoDocenteGrupo: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'cdg-1',
        cursoDocente: {
          docenteId: 'docente-1',
          planEstudioCurso: {
            cursoId: 'curso-1',
          }
        }
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'cdg-1',
        cursoDocente: {
          docenteId: 'docente-1',
          planEstudioCurso: {
            cursoId: 'curso-1',
          }
        }
      }),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('ServicioHorario - Integración', () => {
  let servicio: ServicioHorario;

  beforeEach(() => {
    servicio = new ServicioHorario();
    vi.clearAllMocks();
  });

  describe('listar', () => {
    it('debe listar horarios con paginación', async () => {
      (prisma.horario.findMany as any).mockResolvedValueOnce([
        {
          id: 'h1',
          diaSemana: 'LUNES',
          horaInicio: '08:00',
          horaFin: '10:00',
          estado: 'CONFIRMADO',
          cursoDocenteGrupo: {
            grupo: { id: 'g1', nombre: 'A' },
            cursoDocente: {
              docente: {
                id: 'doc-1',
                usuario: { id: 'u1', nombre: 'Juan', apellidos: 'Pérez' },
              },
              planEstudioCurso: {
                ciclo: 1,
                horasTeoria: 2,
                horasPractica: 4,
                horasLaboratorio: 0,
                creditos: 4,
                curso: { id: 'c1', codigo: 'IS101', nombre: 'Programación' }
              }
            }
          },
          ambiente: { id: 'a1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
          periodo: { id: 'p1', nombre: '2024-II' },
        },
      ]);
      (prisma.horario.count as any).mockResolvedValueOnce(1);

      const resultado = await servicio.listar(
        { periodoId: 'periodo-1' },
        { page: 1, limit: 20 }
      );

      expect(resultado.data).toHaveLength(1);
      expect(resultado.meta.total).toBe(1);
      expect(resultado.data[0].curso.nombre).toBe('Programación');
    });

    it('debe aplicar filtros correctamente', async () => {
      (prisma.horario.findMany as any).mockResolvedValueOnce([]);
      (prisma.horario.count as any).mockResolvedValueOnce(0);

      await servicio.listar(
        {
          periodoId: 'periodo-1',
          docenteId: 'docente-1',
          diaSemana: 'LUNES' as DiaSemana,
          estado: 'CONFIRMADO' as any,
        },
        { page: 1, limit: 20 }
      );

      expect(prisma.horario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodoId: 'periodo-1',
            cursoDocenteGrupo: {
              cursoDocente: {
                docenteId: 'docente-1',
              },
            },
            diaSemana: 'LUNES',
            estado: 'CONFIRMADO',
          }),
        })
      );
    });
  });

  describe('crear', () => {
    const datosCrear = {
      periodoId: 'periodo-1',
      cursoId: 'curso-1',
      docenteId: 'docente-1',
      cursoDocenteGrupoId: 'cdg-1',
      ambienteId: 'ambiente-1',
      diaSemana: 'LUNES' as DiaSemana,
      horaInicio: '08:00',
      horaFin: '10:00',
    };

    it('debe crear horario exitosamente', async () => {
      (prisma.horario.create as any).mockResolvedValueOnce({
        id: 'horario-nuevo',
        ...datosCrear,
        estado: 'BORRADOR',
        curso: { codigo: 'IS101', nombre: 'Programación' },
        docente: {
          usuario: { nombre: 'Juan', apellidos: 'Pérez' },
        },
        grupo: null,
        ambiente: { codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        periodo: { nombre: '2024-II' },
      });

      const horario = await servicio.crear(datosCrear, 'user-admin');

      expect(horario).toBeDefined();
      expect(horario.id).toBe('horario-nuevo');
      expect(horario.estado).toBe('BORRADOR');
    });

    it('debe rechazar si el período no está activo', async () => {
      (prisma.periodoAcademico.findUnique as any).mockResolvedValueOnce({
        id: 'periodo-1',
        estado: 'FINALIZADO',
      });

      await expect(
        servicio.crear(datosCrear, 'user-admin')
      ).rejects.toThrow('El período no está activo');
    });

    it('debe rechazar si el docente no tiene el curso asignado', async () => {
      (prisma.cursoDocenteGrupo.findUnique as any).mockResolvedValueOnce({
        id: 'cdg-1',
        cursoDocente: {
          docenteId: 'otro-docente',
          planEstudioCurso: {
            cursoId: 'curso-1',
          }
        }
      });

      await expect(
        servicio.crear(datosCrear, 'user-admin')
      ).rejects.toThrow('El docente no está asignado a este grupo');
    });

    it('debe rechazar si el ambiente no existe', async () => {
      (prisma.ambiente.findUnique as any).mockResolvedValueOnce(null);

      await expect(
        servicio.crear(datosCrear, 'user-admin')
      ).rejects.toThrow('Ambiente no encontrado');
    });
  });

  describe('obtenerPorDocente', () => {
    it('debe retornar horarios ordenados de un docente', async () => {
      (prisma.horario.findMany as any).mockResolvedValueOnce([
        {
          id: 'h1',
          diaSemana: 'LUNES',
          horaInicio: '08:00',
          horaFin: '10:00',
          curso: { id: 'c1', codigo: 'IS101', nombre: 'Programación', creditos: 4 },
          grupo: { id: 'g1', nombre: 'A' },
          ambiente: { id: 'a1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        },
        {
          id: 'h2',
          diaSemana: 'LUNES',
          horaInicio: '10:00',
          horaFin: '12:00',
          curso: { id: 'c2', codigo: 'IS201', nombre: 'Estructuras', creditos: 4 },
          grupo: { id: 'g2', nombre: 'B' },
          ambiente: { id: 'a2', codigo: 'A102', nombre: 'Aula 102', tipo: 'AULA' },
        },
      ]);

      const horarios = await servicio.obtenerPorDocente('docente-1', 'periodo-1');

      expect(horarios).toHaveLength(2);
      expect(horarios[0].horaInicio).toBe('08:00');
      expect(horarios[1].horaInicio).toBe('10:00');
    });
  });
});

describe('MotorAsignacion - Integración', () => {
  let motor: MotorAsignacion;

  beforeEach(() => {
    motor = new MotorAsignacion();
    vi.clearAllMocks();
  });

  describe('asignarHorario', () => {
    const solicitud = {
      periodoId: 'periodo-1',
      cursoId: 'curso-1',
      docenteId: 'docente-1',
      grupoId: 'grupo-1',
      diaSemana: 'LUNES' as DiaSemana,
      horaInicio: '08:00',
      horaFin: '10:00',
    };

    it('debe asignar horario cuando no hay conflictos', async () => {
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'docente-1',
      });

      (prisma.ambiente.findMany as any).mockResolvedValueOnce([
        { id: 'amb-1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA', capacidad: 40 },
      ]);

      (prisma.horario.count as any).mockResolvedValue(0); // Sin conflictos
      (prisma.horario.create as any).mockResolvedValueOnce({
        id: 'horario-asignado',
        curso: { codigo: 'IS101', nombre: 'Programación' },
        docente: { usuario: { nombre: 'Juan', apellidos: 'Pérez' } },
        ambiente: { codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        grupo: null,
      });

      const resultado = await motor.asignarHorario(solicitud);

      expect(resultado.exitoso).toBe(true);
      expect(resultado.horarioId).toBeDefined();
      expect(resultado.mensaje).toContain('Horario asignado exitosamente');
    });

    it('debe buscar mejor docente cuando no se especifica', async () => {
      const solicitudSinDocente = { ...solicitud, docenteId: undefined };

      (prisma.cursoDocente.findMany as any).mockResolvedValueOnce([
        {
          docente: {
            id: 'doc-1',
            codigo: 'DOC001',
            categoria: 'PRINCIPAL',
            usuario: { id: 'u1', nombre: 'Juan', apellidos: 'Pérez' },
          },
        },
      ]);

      (prisma.horario.count as any).mockResolvedValue(0);
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'doc-1',
      });
      (prisma.ambiente.findMany as any).mockResolvedValueOnce([
        { id: 'amb-1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA', capacidad: 40 },
      ]);
      (prisma.horario.create as any).mockResolvedValueOnce({
        id: 'h1',
        curso: { codigo: 'IS101', nombre: 'Programación' },
        docente: { usuario: { nombre: 'Juan', apellidos: 'Pérez' } },
        ambiente: { codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA' },
        grupo: null,
      });

      const resultado = await motor.asignarHorario(solicitudSinDocente);

      expect(resultado.exitoso).toBe(true);
    });

    it('debe retornar conflicto cuando no hay disponibilidad de ambiente', async () => {
      (prisma.cursoDocente.findUnique as any).mockResolvedValueOnce({
        cursoId: 'curso-1',
        docenteId: 'docente-1',
      });

      // No hay ambientes disponibles
      (prisma.ambiente.findMany as any).mockResolvedValueOnce([]);

      const resultado = await motor.asignarHorario(solicitud);

      expect(resultado.exitoso).toBe(false);
      expect(resultado.conflicto).toBeDefined();
      expect(resultado.conflicto!.tipo).toBe('CRUCE_AULA');
      expect(resultado.mensaje).toContain('No se encontró ningún aula disponible');
    });
  });
});