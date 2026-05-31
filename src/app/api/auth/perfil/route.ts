import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';

const updatePerfilSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellidos: z.string().min(1, 'Los apellidos son requeridos'),
  telefono: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  telegramId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request);
    if (authResult) return authResult;

    const tokenUser = (request as any).user;

    const usuario = await prisma.usuario.findUnique({
      where: { id: tokenUser.userId },
      include: {
        docente: true,
      },
    });

    if (!usuario) {
      return createErrorResponse('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    }

    // No retornar el hash de la contraseña por seguridad
    const { password, ...usuarioSinPassword } = usuario;

    return createSuccessResponse({ usuario: usuarioSinPassword });
  } catch (error: any) {
    console.error('Error al obtener perfil:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al obtener perfil', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await withAuth(request);
    if (authResult) return authResult;

    const tokenUser = (request as any).user;
    const body = await request.json();

    const validation = updatePerfilSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Datos inválidos',
        400,
        validation.error.errors
      );
    }

    const { nombre, apellidos, telefono, whatsapp, telegramId } = validation.data;

    // Verificar si el usuario tiene un registro docente
    const docenteExistente = await prisma.docente.findUnique({
      where: { usuarioId: tokenUser.userId },
    });

    if (docenteExistente) {
      // Usar una transacción para actualizar ambos
      await prisma.$transaction([
        prisma.usuario.update({
          where: { id: tokenUser.userId },
          data: { nombre, apellidos },
        }),
        prisma.docente.update({
          where: { usuarioId: tokenUser.userId },
          data: {
            telefono: telefono || null,
            whatsapp: whatsapp || null,
            telegramId: telegramId || null,
          },
        }),
      ]);
    } else {
      // Solo actualizar el usuario
      await prisma.usuario.update({
        where: { id: tokenUser.userId },
        data: { nombre, apellidos },
      });
    }

    // Obtener el perfil actualizado para responder
    const usuarioActualizado = await prisma.usuario.findUnique({
      where: { id: tokenUser.userId },
      include: {
        docente: true,
      },
    });

    if (!usuarioActualizado) {
      return createErrorResponse('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    }

    const { password, ...usuarioSinPassword } = usuarioActualizado;

    return createSuccessResponse({
      message: 'Perfil actualizado exitosamente',
      usuario: usuarioSinPassword,
    });
  } catch (error: any) {
    console.error('Error al actualizar perfil:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al actualizar perfil', 500);
  }
}
