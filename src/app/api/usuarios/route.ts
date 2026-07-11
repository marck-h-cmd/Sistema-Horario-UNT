import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult) return authResult;

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

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, [Rol.ADMINISTRADOR]);
  if (authResult) return authResult;

  try {
    const body = await request.json();
    const { nombre, apellidos, email, rol, activo, docenteData } = body;

    if (!nombre || !apellidos || !email || !rol) {
      return NextResponse.json({ success: false, message: 'Faltan campos obligatorios' }, { status: 400 });
    }

    if (!Object.values(Rol).includes(rol)) {
      return NextResponse.json({ success: false, message: 'Rol inválido' }, { status: 400 });
    }

    const existingUser = await prisma.usuario.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'El correo electrónico ya está registrado' }, { status: 400 });
    }

    const defaultPassword = 'unt123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          nombre,
          apellidos,
          email,
          rol,
          activo: activo !== false,
          password: passwordHash
        }
      });

      if (rol === Rol.DOCENTE && docenteData) {
        await tx.docente.create({
          data: {
            usuarioId: user.id,
            codigo: docenteData.codigo,
            categoria: docenteData.categoria,
            dedicacion: docenteData.dedicacion,
            dni: docenteData.dni,
            departamentoId: Number(docenteData.departamentoId)
          }
        });
      }
      return user;
    });

    return NextResponse.json({ success: true, data: newUser, message: 'Usuario creado exitosamente' }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear usuario:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, message: 'DNI o código de docente ya registrado' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Error interno del servidor' }, { status: 500 });
  }
}
