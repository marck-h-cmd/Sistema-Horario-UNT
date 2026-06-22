import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TokenService } from '@/services/auth/TokenService';

const tokenService = new TokenService();

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null;

    // 1. Extraer token de cookies o header Authorization
    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token) {
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (token) {
      try {
        const payload = await tokenService.validateToken(token);
        userId = payload.userId;
      } catch (e) {
        // Continuar como invitado si el token es inválido o expirado
      }
    }

    if (userId) {
      const userExists = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!userExists) {
        userId = null;
      }
    }

    const { searchParams } = new URL(request.url);
    const clientSessionId = searchParams.get('sessionId');

    let session = null;

    if (userId) {
      // Intentar buscar la última sesión activa del usuario
      session = await prisma.chatSesion.findFirst({
        where: { usuarioId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { mensajes: { orderBy: { createdAt: 'asc' } } }
      });

      if (!session) {
        // Crear una nueva sesión para el usuario registrado
        session = await prisma.chatSesion.create({
          data: {
            usuarioId: userId,
            titulo: 'Nueva conversación'
          },
          include: { mensajes: { orderBy: { createdAt: 'asc' } } }
        });
      }
    } else {
      // Flujo de invitado (no autenticado)
      if (clientSessionId) {
        session = await prisma.chatSesion.findUnique({
          where: { id: clientSessionId },
          include: { mensajes: { orderBy: { createdAt: 'asc' } } }
        });
      }

      if (!session) {
        // Crear una nueva sesión de invitado
        session = await prisma.chatSesion.create({
          data: {
            titulo: 'Conversación de invitado'
          },
          include: { mensajes: { orderBy: { createdAt: 'asc' } } }
        });
      }
    }

    return Response.json({
      sessionId: session.id,
      messages: session.mensajes.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.contenido,
        createdAt: m.createdAt
      }))
    });
  } catch (error: any) {
    console.error('[Chat History API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST para forzar una nueva conversación (limpiar historial)
export async function POST(request: NextRequest) {
  try {
    let userId: string | null = null;

    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token) {
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (token) {
      try {
        const payload = await tokenService.validateToken(token);
        userId = payload.userId;
      } catch (e) {}
    }

    if (userId) {
      const userExists = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!userExists) {
        userId = null;
      }
    }

    const session = await prisma.chatSesion.create({
      data: {
        usuarioId: userId,
        titulo: userId ? 'Nueva conversación' : 'Conversación de invitado'
      }
    });

    return Response.json({
      sessionId: session.id,
      messages: []
    });
  } catch (error: any) {
    console.error('[Chat History API Create] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
