import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const planes = await prisma.planEstudio.findMany({
      orderBy: { anio: 'desc' },
      select: {
        id: true,
        nombre: true,
        anio: true,
        activo: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: planes,
    });
  } catch (error: any) {
    console.error('Error fetching planes de estudio:', error);
    return NextResponse.json(
      { success: false, message: 'Error al obtener los planes de estudio' },
      { status: 500 }
    );
  }
}
