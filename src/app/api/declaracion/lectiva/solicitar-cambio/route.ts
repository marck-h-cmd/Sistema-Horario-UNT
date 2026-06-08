import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';
import { TipoNotificacion, PrioridadNotificacion, CanalNotificacion } from '@prisma/client';

const requestSchema = z.object({
  periodoId: z.string().uuid(),
  motivo: z.string().min(5, 'El motivo de cambio debe tener al menos 5 caracteres'),
});

export async function POST(request: NextRequest) {
  const authResult = await withAuth(request, ['DOCENTE']);
  if (authResult) return authResult;

  const user = (request as any).user;

  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos de solicitud inválidos', 400, validation.error.errors);
    }

    const { periodoId, motivo } = validation.data;

    // Buscar docente
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: user.userId },
      include: {
        usuario: { select: { nombre: true, apellidos: true } },
      },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'No se encontró un docente asociado a este usuario', 404);
    }

    // Buscar período
    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo) {
      return createErrorResponse('PERIOD_NOT_FOUND', 'No se encontró el período académico especificado', 404);
    }

    // Buscar administradores y superadministradores
    const administradores = await prisma.usuario.findMany({
      where: {
        rol: { in: ['ADMINISTRADOR', 'SUPER_ADMIN'] },
        activo: true,
      },
      select: { id: true },
    });

    if (administradores.length === 0) {
      return createErrorResponse('NO_ADMINS', 'No hay administradores registrados en el sistema para recibir la solicitud', 404);
    }

    const teacherName = `${docente.usuario.nombre} ${docente.usuario.apellidos}`;
    const titulo = `Solicitud de modificación de carga - ${teacherName}`;
    const mensaje = `El docente ${teacherName} (Código: ${docente.codigo}) ha solicitado una modificación de su carga académica en el período ${periodo.nombre}. Motivo: ${motivo}`;

    // Crear notificaciones para cada administrador
    await prisma.$transaction(
      administradores.map((admin) =>
        prisma.notificacion.create({
          data: {
            usuarioId: admin.id,
            tipo: TipoNotificacion.CAMBIO_HORARIO,
            titulo,
            mensaje,
            prioridad: PrioridadNotificacion.ALTA,
            canal: CanalNotificacion.SISTEMA,
            estado: 'PENDIENTE',
            metadata: {
              docenteId: docente.id,
              docenteCodigo: docente.codigo,
              docenteNombre: teacherName,
              periodoId,
              periodoNombre: periodo.nombre,
              motivo,
            },
          },
        })
      )
    );

    // Registrar auditoría
    await prisma.registroAuditoria.create({
      data: {
        usuarioId: user.userId,
        accion: 'SOLICITAR_MODIFICACION_CARGA_LECTIVA',
        entidad: 'Docente',
        entidadId: docente.id,
        datos: {
          periodoId,
          motivo,
        },
      },
    });

    return createSuccessResponse(null, 'Solicitud de cambio enviada exitosamente a los administradores');
  } catch (error: any) {
    console.error('Error en POST /api/declaracion/lectiva/solicitar-cambio:', error);
    return createErrorResponse('INTERNAL_ERROR', error.message || 'Error interno del servidor', 500);
  }
}
