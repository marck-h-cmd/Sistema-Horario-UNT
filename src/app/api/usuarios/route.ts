import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { Rol } from '@prisma/client';

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult.error) {
    return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidos: true,
        rol: true,
        activo: true,
        docente: {
          select: {
            id: true,
            codigo: true,
            categoria: true,
            dedicacion: true,
            dni: true,
            departamentoId: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return NextResponse.json({ success: true, data: usuarios });
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor al obtener usuarios' },
      { status: 500 }
    );
  }
}
