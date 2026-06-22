import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidadorConflictos } from '@/services/horarios/ValidadorConflictos';
import { DiaSemana } from '@prisma/client';

// Mock de Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    horario: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    curso: {
      findUnique: vi.fn().mockResolvedValue({ nombre: 'Curso Test' }),
    },
    docente: {
      findUnique: vi.fn().mockResolvedValue({
        usuario: { nombre: 'Juan', apellidos: 'Pérez' },
      }),
    },
    ambiente: {
      findUnique: vi.fn().mockResolvedValue({
        nombre: 'Aula 101',
        tipo: 'AULA',
        codigo: 'A101',
      }),
    },
    cursoDocenteGrupo: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'grupo-1',
        grupoId: 'static-grupo-1',
        grupo: { nombre: 'A' },
        cursoDocente: {
          docenteId: 'docente-1',
          planEstudioCurso: {
            ciclo: 1,
            curso: { codigo: 'IS-101', nombre: 'Curso Test' }
          }
        }
      }),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('ValidadorConflictos', () => {
  let validador: ValidadorConflictos;

  const opcionesBase = {
    periodoId: 'periodo-1',
    docenteId: 'docente-1',
    cursoId: 'curso-1',
    ambienteId: 'ambiente-1',
    grupoId: 'grupo-1',
    diaSemana: 'LUNES' as DiaSemana,
    horaInicio: '08:00',
    horaFin: '10:00',
  };

  beforeEach(() => {
    validador = new ValidadorConflictos();
    vi.clearAllMocks();
  });

  describe('validarTodo', () => {
    it('debe retornar válido cuando no hay conflictos', async () => {
      // Sin horarios conflictivos (mock default retorna [])
      const resultado = await validador.validarTodo(opcionesBase);

      expect(resultado.valido).toBe(true);
      expect(resultado.totalConflictos).toBe(0);
      expect(resultado.conflictos).toHaveLength(0);
    });

    it('debe detectar cruce de docente en el mismo día y hora', async () => {
      (prisma.horario.findMany as any).mockResolvedValueOnce([
        {
          id: 'horario-conflicto-1',
          curso: { id: 'c2', codigo: 'IS201', nombre: 'Otro Curso' },
          docente: {
            usuario: { nombre: 'Juan', apellidos: 'Pérez' },
          },
          ambiente: {
            id: 'a2', codigo: 'A102', nombre: 'Aula 102', tipo: 'AULA',
          },
          grupo: { id: 'g2', nombre: 'B' },
          diaSemana: 'LUNES',
          horaInicio: '08:00',
          horaFin: '10:00',
        },
      ]);

      const resultado = await validador.validarTodo(opcionesBase);

      expect(resultado.valido).toBe(false);
      expect(resultado.totalConflictos).toBeGreaterThan(0);
      
      const conflictoDocente = resultado.conflictos.find(
        c => c.tipo === 'CRUCE_DOCENTE'
      );
      expect(conflictoDocente).toBeDefined();
      expect(conflictoDocente!.severidad).toBe('ERROR');
      expect(conflictoDocente!.mensaje).toContain('Juan Pérez');
      expect(conflictoDocente!.mensaje).toContain('ya tiene asignado');
    });

    it('debe detectar cruce de aula en el mismo día y hora', async () => {
      // Primera llamada: cruce docente (vacío)
      (prisma.horario.findMany as any)
        .mockResolvedValueOnce([]) // docente
        .mockResolvedValueOnce([   // ambiente
          {
            id: 'hc-2',
            curso: { id: 'c3', codigo: 'IS301', nombre: 'Base de Datos' },
            docente: {
              usuario: { nombre: 'María', apellidos: 'López' },
            },
            ambiente: {
              id: 'a1', codigo: 'A101', nombre: 'Aula 101', tipo: 'AULA',
            },
            grupo: { id: 'g3', nombre: 'A' },
            diaSemana: 'LUNES',
            horaInicio: '08:00',
            horaFin: '10:00',
          },
        ]);

      const resultado = await validador.validarTodo(opcionesBase);

      expect(resultado.valido).toBe(false);
      
      const conflictoAula = resultado.conflictos.find(
        c => c.tipo === 'CRUCE_AULA'
      );
      expect(conflictoAula).toBeDefined();
      expect(conflictoAula!.mensaje).toContain('Aula 101');
      expect(conflictoAula!.mensaje).toContain('ya está ocupado');
    });

    it('debe detectar cruce de laboratorio', async () => {
      const opcionesLab = {
        ...opcionesBase,
        ambienteId: 'lab-1',
      };

      (prisma.ambiente.findUnique as any).mockResolvedValue({
        nombre: 'Lab Cómputo 1',
        tipo: 'LABORATORIO',
        codigo: 'L301',
      });

      (prisma.horario.findMany as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'hc-lab',
            curso: { id: 'c4', codigo: 'IS501', nombre: 'Sistemas Operativos' },
            docente: {
              usuario: { nombre: 'Carlos', apellidos: 'Rodríguez' },
            },
            ambiente: {
              id: 'lab-1', codigo: 'L301', nombre: 'Lab Cómputo 1', tipo: 'LABORATORIO',
            },
            grupo: null,
            diaSemana: 'LUNES',
            horaInicio: '08:00',
            horaFin: '10:00',
          },
        ]);

      const resultado = await validador.validarTodo(opcionesLab);

      const conflictoLab = resultado.conflictos.find(
        c => c.tipo === 'CRUCE_LABORATORIO'
      );
      expect(conflictoLab).toBeDefined();
      expect(conflictoLab!.mensaje).toContain('laboratorio');
    });

    it('debe detectar cruce de grupo/sección', async () => {
      (prisma.horario.findMany as any)
        .mockResolvedValueOnce([]) // docente
        .mockResolvedValueOnce([]) // ambiente
        .mockResolvedValueOnce([   // grupo
          {
            id: 'hc-grupo',
            curso: { id: 'c5', codigo: 'IS601', nombre: 'Redes' },
            docente: {
              usuario: { nombre: 'Ana', apellidos: 'Martínez' },
            },
            ambiente: {
              id: 'a3', codigo: 'A201', nombre: 'Aula 201', tipo: 'AULA',
            },
            grupo: { id: 'grupo-1', nombre: 'A' },
            diaSemana: 'LUNES',
            horaInicio: '08:00',
            horaFin: '10:00',
          },
        ]);

      const resultado = await validador.validarTodo(opcionesBase);

      const conflictoGrupo = resultado.conflictos.find(
        c => c.tipo === 'CRUCE_GRUPO'
      );
      expect(conflictoGrupo).toBeDefined();
      expect(conflictoGrupo!.mensaje).toContain('grupo');
    });

    it('debe excluir el horario propio en ediciones', async () => {
      const resultado = await validador.validarTodo({
        ...opcionesBase,
        horarioIdExcluir: 'horario-propio-1',
      });

      // Verificar que se pasó el filtro de exclusión
      expect(prisma.horario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'horario-propio-1' },
          }),
        })
      );
    });

    it('debe retornar resumen correcto de tipos de conflicto', async () => {
      (prisma.horario.findMany as any)
        .mockResolvedValueOnce([
          { // CRUCE_DOCENTE
            id: 'h1',
            curso: { id: 'c10', codigo: 'X01', nombre: 'Curso X' },
            docente: { usuario: { nombre: 'A', apellidos: 'B' } },
            ambiente: { id: 'ax', codigo: 'AX', nombre: 'AX', tipo: 'AULA' },
            grupo: null,
            diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00',
          },
        ])
        .mockResolvedValueOnce([ // CRUCE_AULA
          {
            id: 'h2',
            curso: { id: 'c11', codigo: 'X02', nombre: 'Curso Y' },
            docente: { usuario: { nombre: 'C', apellidos: 'D' } },
            ambiente: { id: 'a1', codigo: 'A101', nombre: 'A101', tipo: 'AULA' },
            grupo: null,
            diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '10:00',
          },
        ])
        .mockResolvedValueOnce([]);

      const resultado = await validador.validarTodo(opcionesBase);

      expect(resultado.resumen.cruceDocente).toBe(1);
      expect(resultado.resumen.cruceAula).toBe(1);
      expect(resultado.resumen.cruceLaboratorio).toBe(0);
      expect(resultado.resumen.cruceGrupo).toBe(0);
    });
  });

  describe('validarCruceDocente', () => {
    it('debe retornar lista vacía si no hay conflicto', async () => {
      const resultado = await validador.validarTodo({
        ...opcionesBase,
        validarAmbiente: false,
        validarGrupo: false,
      });

      expect(resultado.conflictos.filter(c => c.tipo === 'CRUCE_DOCENTE')).toHaveLength(0);
    });

    it('debe detectar solapamiento parcial (inicio dentro de otro)', async () => {
      (prisma.horario.findMany as any).mockResolvedValueOnce([
        {
          id: 'h-parcial',
          curso: { id: 'c20', codigo: 'Z01', nombre: 'Curso Z' },
          docente: { usuario: { nombre: 'X', apellidos: 'Y' } },
          ambiente: { id: 'az', codigo: 'AZ', nombre: 'AZ', tipo: 'AULA' },
          grupo: null,
          diaSemana: 'LUNES',
          horaInicio: '09:00', // Empieza durante nuestro horario
          horaFin: '11:00',
        },
      ]);

      const resultado = await validador.validarTodo({
        ...opcionesBase,
        validarAmbiente: false,
        validarGrupo: false,
      });

      expect(resultado.conflictos).toHaveLength(1);
    });
  });

  describe('estaLibreDocente', () => {
    it('debe retornar true si el docente está libre', async () => {
      (prisma.horario.count as any).mockResolvedValue(0);

      const libre = await validador.estaLibreDocente(
        'periodo-1', 'docente-1', 'LUNES', '08:00', '10:00'
      );

      expect(libre).toBe(true);
    });

    it('debe retornar false si el docente está ocupado', async () => {
      (prisma.horario.count as any).mockResolvedValue(1);

      const libre = await validador.estaLibreDocente(
        'periodo-1', 'docente-1', 'LUNES', '08:00', '10:00'
      );

      expect(libre).toBe(false);
    });
  });

  describe('estaLibreAmbiente', () => {
    it('debe retornar true si el ambiente está libre', async () => {
      (prisma.horario.count as any).mockResolvedValue(0);

      const libre = await validador.estaLibreAmbiente(
        'periodo-1', 'ambiente-1', 'LUNES', '08:00', '10:00'
      );

      expect(libre).toBe(true);
    });
  });
});