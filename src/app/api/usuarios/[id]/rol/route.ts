import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { Rol } from '@prisma/client';
import { CategoriaDocente, DedicacionDocente } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult.error) {
    return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
  }

  const userId = params.id;
  
  if (!userId) {
    return NextResponse.json({ success: false, message: 'ID de usuario es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { rol, docenteData } = body;

    if (!rol || !Object.values(Rol).includes(rol)) {
      return NextResponse.json({ success: false, message: 'Rol inválido o ausente' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId }, include: { docente: true } });
    if (!usuario) {
      return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
    }

    // Begin transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update the user's role
      const user = await tx.usuario.update({
        where: { id: userId },
        data: { rol },
        include: { docente: true }
      });

      // If the new role is DOCENTE, manage the Docente profile
      if (rol === Rol.DOCENTE && docenteData) {
        if (user.docente) {
          // Update existing
          await tx.docente.update({
            where: { id: user.docente.id },
            data: {
              codigo: docenteData.codigo,
              categoria: docenteData.categoria as CategoriaDocente,
              dedicacion: docenteData.dedicacion as DedicacionDocente,
              dni: docenteData.dni,
              departamentoId: Number(docenteData.departamentoId),
            }
          });
        } else {
          // Create new
          await tx.docente.create({
            data: {
              usuarioId: userId,
              codigo: docenteData.codigo,
              categoria: docenteData.categoria as CategoriaDocente,
              dedicacion: docenteData.dedicacion as DedicacionDocente,
              dni: docenteData.dni,
              departamentoId: Number(docenteData.departamentoId),
            }
          });
        }
      }
      
      // Fetch the full updated user with docente
      return await tx.usuario.findUnique({
        where: { id: userId },
        include: { docente: true }
      });
    });

    return NextResponse.json({ success: true, data: updatedUser, message: 'Rol actualizado exitosamente' });
  } catch (error: any) {
    console.error('Error actualizando rol de usuario:', error);
    
    // Check for Prisma unique constraint violation (e.g., duplicate DNI or Codigo)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, message: 'Ya existe un docente con ese DNI o Código' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Error interno del servidor al actualizar rol' },
      { status: 500 }
    );
  }
}
