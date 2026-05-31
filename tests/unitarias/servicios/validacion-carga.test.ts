import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CargaNoLectivaService } from '@/services/cargaNoLectivaService';
import { ValidacionHorarioService } from '@/services/validacionHorarioService';
import { DedicacionDocente, TipoActividadNoLectiva, TipoComponente } from '@prisma/client';

// Mock de Prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn().mockImplementation((cb) => cb(mockPrisma)),
    docente: {
      findUnique: vi.fn(),
    },
    periodoAcademico: {
      findUnique: vi.fn(),
    },
    horario: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    cursoDocente: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    declaracionNoLectiva: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    declaracionNoLectivaItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    registroAuditoria: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@/lib/prisma';

describe('CargaNoLectivaService', () => {
  let service: CargaNoLectivaService;

  beforeEach(() => {
    service = new CargaNoLectivaService();
    vi.clearAllMocks();
  });

  describe('validarActividad rules', () => {
    it('debe lanzar error si horas de preparacion superan el 50% de horas lectivas', async () => {
      const docenteMock = {
        id: 'docente-1',
        dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
        usuarioId: 'u1',
      };
      
      const asignacionesLectivasMock = [
        { id: 'cd-1', horasAsignadas: 8 }, // 8 horas lectivas
      ];

      (prisma.docente.findUnique as any).mockResolvedValue(docenteMock);
      (prisma.cursoDocente.findMany as any).mockResolvedValue(asignacionesLectivasMock);

      // 5 horas de preparacion para 8 horas lectivas (limite es 50% = 4 horas)
      const items = [
        {
          tipoActividad: TipoActividadNoLectiva.PREPARACION_Y_EVALUACION,
          horasSemanales: 5,
          descripcion: 'Prep',
        },
      ];

      await expect(
        service.guardarDeclaracion('docente-1', 'periodo-1', items)
      ).rejects.toThrow('exceden el límite reglamentario');
    });

    it('debe permitir preparacion dentro del limite', async () => {
      const docenteMock = {
        id: 'docente-1',
        dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
        usuarioId: 'u1',
      };
      
      const asignacionesLectivasMock = [
        { id: 'cd-1', horasAsignadas: 8 }, // 8 horas lectivas -> limite 4 horas
      ];

      (prisma.docente.findUnique as any).mockResolvedValue(docenteMock);
      (prisma.cursoDocente.findMany as any).mockResolvedValue(asignacionesLectivasMock);
      (prisma.declaracionNoLectiva.findUnique as any).mockResolvedValue(null);
      (prisma.declaracionNoLectiva.create as any).mockResolvedValue({ id: 'dec-1' });

      const items = [
        {
          tipoActividad: TipoActividadNoLectiva.PREPARACION_Y_EVALUACION,
          horasSemanales: 4,
          descripcion: 'Prep',
        },
      ];

      const res = await service.guardarDeclaracion('docente-1', 'periodo-1', items);
      expect(res).toBeDefined();
    });
  });
});

describe('ValidacionHorarioService', () => {
  let validador: ValidacionHorarioService;

  beforeEach(() => {
    validador = new ValidacionHorarioService();
    vi.clearAllMocks();
  });

  it('debe detectar incompatibilidad de becas de estudio', async () => {
    const docenteMock = {
      id: 'docente-1',
      dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
      cargos: [],
      becas: [{ id: 'b1', tipoBeca: 'MAESTRIA', activo: true }],
      comisiones: [],
    };
    const periodoMock = { id: 'p1', fechaInicio: new Date(), fechaFin: new Date() };
    const cdAsignacionesMock = [{ id: 'cd-1', horasAsignadas: 8 }]; // tiene carga lectiva

    (prisma.docente.findUnique as any).mockResolvedValue(docenteMock);
    (prisma.periodoAcademico.findUnique as any).mockResolvedValue(periodoMock);
    (prisma.cursoDocente.findMany as any).mockResolvedValue(cdAsignacionesMock);

    const res = await validador.ejecutarValidaciones('docente-1', 'p1');
    expect(res.valido).toBe(false);
    const checkBeca = res.resultados.find(r => r.tipoRegla === 'INCOMPATIBILIDAD_BECA');
    expect(checkBeca?.cumple).toBe(false);
  });
});
