import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { Rol } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult) return authResult;

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'ID de usuario es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { nombre, apellidos, email, activo } = body;

    const existingUser = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
    }

    if (email && email !== existingUser.email) {
      const emailDup = await prisma.usuario.findUnique({ where: { email } });
      if (emailDup) {
        return NextResponse.json({ success: false, message: 'El correo electrónico ya está en uso' }, { status: 400 });
      }
    }

    const updated = await prisma.usuario.update({
      where: { id: userId },
      data: {
        nombre: nombre ?? undefined,
        apellidos: apellidos ?? undefined,
        email: email ?? undefined,
        activo: activo !== undefined ? activo : undefined,
      },
      include: {
        docente: true
      }
    });

    return NextResponse.json({ success: true, data: updated, message: 'Usuario actualizado exitosamente' });
  } catch (error: any) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json({ success: false, message: 'Error interno al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult) return authResult;

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'ID de usuario es requerido' }, { status: 400 });
  }

  try {
    const existingUser = await prisma.usuario.findUnique({ where: { id: userId }, include: { docente: true } });
    if (!existingUser) {
      return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (existingUser.docente) {
        await tx.docente.delete({ where: { id: existingUser.docente.id } });
      }
      await tx.usuario.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    if (error.code === 'P2003') {
      return NextResponse.json({
        success: false,
        message: 'No se puede eliminar el usuario porque tiene registros vinculados (ej. horarios, disponibilidad o historial)'
      }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Error al intentar eliminar el usuario' }, { status: 500 });
  }
}
