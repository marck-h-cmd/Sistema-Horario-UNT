import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthService } from '@/services/auth/AuthService';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';

const authService = new AuthService();

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Contraseña actual requerida'),
  nuevaPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request);
    if (authResult) return authResult;

    const user = (request as any).user;
    const body = await request.json();
    
    const validation = cambiarPasswordSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Datos inválidos',
        400,
        validation.error.errors
      );
    }

    const { passwordActual, nuevaPassword } = validation.data;

    await authService.cambiarPassword(user.userId, passwordActual, nuevaPassword);

    return createSuccessResponse({ message: 'Contraseña actualizada exitosamente' });
  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    console.error('Error cambiando password:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al cambiar contraseña', 500);
  }
}