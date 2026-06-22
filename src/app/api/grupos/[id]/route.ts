import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';

const updateGrupoSchema = z.object({
  cursoDocenteId: z.string().uuid().optional(),
  nombre: z.string().min(1).max(50).optional(),
  capacidad: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cdg = await prisma.cursoDocenteGrupo.findUnique({
      where: { id: params.id },
      include: {
        grupo: true,
        cursoDocente: {
          include: { planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } } }
        },
        _count: {
          select: { horarios: true },
        },
      },
    });

    if (!cdg) {
      return createErrorResponse('NOT_FOUND', 'Grupo no encontrado', 404);
    }

    const responseGrupo = {
      id: cdg.id,
      nombre: cdg.grupo.nombre,
      capacidad: cdg.capacidad,
      activo: cdg.activo,
      cursoDocenteId: cdg.cursoDocenteId,
      grupoId: cdg.grupoId,
      curso: cdg.cursoDocente?.planEstudioCurso?.curso,
      _count: cdg._count,
    };

    return createSuccessResponse(responseGrupo);
  } catch (error: any) {
    console.error('Error obteniendo grupo:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener grupo', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = updateGrupoSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const updateData: any = {};
    if (validation.data.cursoDocenteId !== undefined) {
      updateData.cursoDocenteId = validation.data.cursoDocenteId;
    }
    if (validation.data.capacidad !== undefined) {
      updateData.capacidad = validation.data.capacidad;
    }
    if (validation.data.activo !== undefined) {
      updateData.activo = validation.data.activo;
    }
    if (validation.data.nombre !== undefined) {
      let staticGrupo = await prisma.grupo.findUnique({
        where: { nombre: validation.data.nombre },
      });
      if (!staticGrupo) {
        staticGrupo = await prisma.grupo.create({
          data: { nombre: validation.data.nombre }
        });
      }
      updateData.grupoId = staticGrupo.id;
    }

    const cdg = await prisma.cursoDocenteGrupo.update({
      where: { id: params.id },
      data: updateData,
      include: {
        grupo: true,
        cursoDocente: {
          include: { planEstudioCurso: { include: { curso: { select: { id: true, codigo: true, nombre: true } } } } }
        },
        _count: {
          select: { horarios: true },
        },
      },
    });

    const responseGrupo = {
      id: cdg.id,
      nombre: cdg.grupo.nombre,
      capacidad: cdg.capacidad,
      activo: cdg.activo,
      cursoDocenteId: cdg.cursoDocenteId,
      grupoId: cdg.grupoId,
      curso: cdg.cursoDocente?.planEstudioCurso?.curso,
      _count: cdg._count,
    };

    return createSuccessResponse(responseGrupo);
  } catch (error: any) {
    console.error('Error actualizando grupo:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar grupo', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.cursoDocenteGrupo.update({
      where: { id: params.id },
      data: { activo: false },
    });

    return createSuccessResponse({ message: 'Grupo desactivado exitosamente' });
  } catch (error: any) {
    console.error('Error eliminando grupo:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al eliminar grupo', 500);
  }
}
