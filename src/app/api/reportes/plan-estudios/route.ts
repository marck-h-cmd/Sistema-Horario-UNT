import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FormatoPlanEstudios } from '@/components/pdf/FormatoPlanEstudios';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const ciclo = parseInt(searchParams.get('ciclo') || '0');
    const departamentoId = parseInt(searchParams.get('departamentoId') || '0');
    const planEstudioId = searchParams.get('planEstudioId') || undefined;

    // 1. Obtener los datos del Plan de Estudios si se especificó
    let planNombre = 'INGENIERÍA DE SISTEMAS';
    let planAnio = new Date().getFullYear();

    if (planEstudioId) {
      const plan = await prisma.planEstudio.findUnique({
        where: { id: planEstudioId }
      });
      if (plan) {
        planNombre = plan.nombre;
        planAnio = plan.anio;
      }
    }

    // 2. Construir la consulta de Cursos (similar a ServicioCurso)
    const where: any = {
      planEstudio: { activo: true }
    };

    if (search) {
      where.curso = {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
        ]
      };
    }

    if (ciclo > 0) where.ciclo = ciclo;
    if (departamentoId > 0) where.departamentoId = departamentoId;
    if (planEstudioId) {
      where.planEstudioId = planEstudioId;
      delete where.planEstudio;
    }

    const cursosDb = await prisma.planEstudioCurso.findMany({
      where,
      orderBy: [
        { ciclo: 'asc' },
        { curso: { codigo: 'asc' } }
      ],
      include: {
        curso: true,
        departamento: true,
      }
    });

    // 3. Mapear al formato requerido por el PDF
    const cursosRow = cursosDb.map(c => ({
      codigo: c.curso.codigo,
      ciclo: c.ciclo,
      tipoCurso: c.tipoCurso,
      nombre: c.curso.nombre,
      horasTeoria: c.horasTeoria,
      horasPractica: c.horasPractica,
      horasLaboratorio: c.horasLaboratorio,
      creditos: c.creditos,
      departamento: c.departamento?.nombre || 'Sin dpto.'
    }));

    // 4. Generar el PDF
    const pdfElement = React.createElement(FormatoPlanEstudios, {
      planNombre,
      planAnio,
      cursos: cursosRow
    });

    const buffer = await renderToBuffer(pdfElement as any);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Plan_Estudios_${planAnio}.pdf"`,
      },
    });

  } catch (err: any) {
    console.error('Error al generar PDF de Plan de Estudios:', err);
    return NextResponse.json(
      { success: false, message: `Error del servidor al generar el PDF: ${err.message}` },
      { status: 500 }
    );
  }
}
