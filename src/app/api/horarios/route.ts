import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { DiaSemana, EstadoHorario } from '@prisma/client';
import { ROLES } from '@/lib/constantes';

const servicioHorario = new ServicioHorario();

const filtrosSchema = z.object({
  periodoId: z.string().optional(),
  docenteId: z.string().optional(),
  cursoId: z.string().optional(),
  ambienteId: z.string().optional(),
  diaSemana: z.nativeEnum(DiaSemana).optional(),
  estado: z.nativeEnum(EstadoHorario).optional(),
  ciclo: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * @swagger
 * /api/horarios:
 *   get:
 *     summary: Listar horarios con filtros y paginación
 *     tags: [Horarios]
 *     parameters:
 *       - in: query
 *         name: periodoId
 *         schema:
 *           type: string
 *       - in: query
 *         name: docenteId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de horarios
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const validation = filtrosSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Parámetros inválidos', 400, validation.error.errors);
    }

    const { page, limit, sortBy, sortOrder, ciclo, ...filtros } = validation.data;

    const resultado = await servicioHorario.listar(
      {
        ...filtros,
        ciclo: ciclo ? parseInt(ciclo) : undefined,
      },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
      }
    );

    return createPaginatedResponse(
      resultado.data,
      resultado.meta.page,
      resultado.meta.limit,
      resultado.meta.total
    );
  } catch (error: any) {
    console.error('Error listando horarios:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al listar horarios', 500);
  }
}

const crearHorarioSchema = z.object({
  periodoId: z.string().uuid(),
  cursoId: z.string().uuid(),
  docenteId: z.string().uuid(),
  grupoId: z.string().uuid().optional(),
  ambienteId: z.string().uuid(),
  diaSemana: z.nativeEnum(DiaSemana),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
});

/**
 * @swagger
 * /api/horarios:
 *   post:
 *     summary: Crear nuevo horario
 *     tags: [Horarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periodoId:
 *                 type: string
 *                 format: uuid
 *               cursoId:
 *                 type: string
 *                 format: uuid
 *               docenteId:
 *                 type: string
 *                 format: uuid
 *               grupoId:
 *                 type: string
 *                 format: uuid
 *               ambienteId:
 *                 type: string
 *                 format: uuid
 *               diaSemana:
 *                 type: string
 *                 enum: [LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO]
 *               horaInicio:
 *                 type: string
 *                 example: "08:00"
 *               horaFin:
 *                 type: string
 *                 example: "10:00"
 *     responses:
 *       201:
 *         description: Horario creado exitosamente
 */
export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMINISTRADOR,
    ROLES.OPERADOR,
  ]);
  if (authResult) return authResult;

  try {
    const user = request.user!;
    const body = await request.json();

    const validation = crearHorarioSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const { grupoId, ...rest } = validation.data;
    const dto = {
      ...rest,
      cursoDocenteGrupoId: grupoId,
    };

    const horario = await servicioHorario.crear(dto, user.userId);

    return createSuccessResponse(horario, undefined, 201);
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error creando horario:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al crear horario', 500);
  }
}