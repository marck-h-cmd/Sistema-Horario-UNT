import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { GestorVentanasAtencion } from '@/services/ventanas/GestorVentanasAtencion';

const justificarSchema = z.object({
  motivo: z.string().min(10),
  tipo: z.string(),
  documento: z.string().optional(),
});

interface TokenPayload {
  userId: string;
  email: string;
  rol: string;
  tokenVersion: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = justificarSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400);
    }

    const { motivo, tipo, documento } = validation.data;

    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return createErrorResponse('UNAUTHORIZED', 'Token no proporcionado', 401);
    }

    const secret = process.env.JWT_SECRET || 'default-secret';
    const tokenData = jwt.verify(token, secret) as TokenPayload;
    const userId = tokenData.userId;

    const docente = await prisma.docente.findFirst({
      where: { usuarioId: userId },
    });

    if (!docente) {
      return createErrorResponse('NOT_FOUND', 'Docente no encontrado', 404);
    }

    const atencion = await prisma.atencionVentana.findFirst({
      where: { 
        ventanaId: params.id, 
        docenteId: docente.id,
        estado: 'ESPERANDO' 
      },
      include: {
        docente: {
          include: { usuario: true }
        }
      }
    });

    if (!atencion) {
      return createErrorResponse('NOT_FOUND', 'No se encontró atención activa', 404);
    }

    // Calcular hora estimada de inicio del turno
    const gestorVentanas = new GestorVentanasAtencion();
    const horaInicioEstimada = await gestorVentanas.calcularHoraEstimadaTurno(params.id, atencion.posicion);
    const limiteTiempo = 2 * 60 * 60 * 1000; // 2 horas en milisegundos

    if (horaInicioEstimada.getTime() - Date.now() < limiteTiempo) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        `No es posible justificar la ausencia. El plazo permitido ha vencido (debe realizarse al menos 2 horas antes del inicio estimado de su turno, el cual es a las ${horaInicioEstimada.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}).`,
        400
      );
    }

    const docenteNombre = `${atencion.docente.usuario.nombre} ${atencion.docente.usuario.apellidos}`;

    // 🔒 Requiere EstadoAtencion.JUSTIFICADO (pendiente de aprobación de BD)
    // Por ahora usar AUSENTE como fallback temporal
    await prisma.atencionVentana.update({
      where: { id: atencion.id },
      data: { 
        estado: 'AUSENTE'
      } as any,
    });

    const admins = await prisma.usuario.findMany({
      where: { 
        rol: { in: ['ADMINISTRADOR', 'SUPER_ADMIN'] }, 
        activo: true 
      }
    });

    for (const admin of admins) {
      await prisma.notificacion.create({
        data: {
          usuarioId: admin.id,
          tipo: 'SISTEMA',
          titulo: `Ausencia justificada: ${docenteNombre}`,
          mensaje: `Tipo: ${tipo}. Motivo: ${motivo}${documento ? `. Doc: ${documento}` : ''}`,
          prioridad: 'ALTA',
          canal: 'SISTEMA',
          estado: 'PENDIENTE',
          metadata: {
            docenteId: atencion.docenteId,
            ventanaId: params.id,
            atencionId: atencion.id,
            tipo,
            motivo,
            documento: documento || null,
            docenteNombre,
            fecha: new Date().toISOString()
          }
        }
      });
    }

    return createSuccessResponse({
      message: 'Ausencia justificada correctamente',
      atencionId: atencion.id,
    });
  } catch (error) {
    console.error('Error justificando ausencia:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al registrar ausencia', 500);
  }
}
