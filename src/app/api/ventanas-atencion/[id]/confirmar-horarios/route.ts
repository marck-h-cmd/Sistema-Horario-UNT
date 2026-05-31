import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ServicioHorario } from '@/services/horarios/ServicioHorario';
import { GestorNotificaciones } from '@/services/notificaciones/GestorNotificaciones';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';

const servicioHorario = new ServicioHorario();
const gestorNotificaciones = new GestorNotificaciones();

const confirmarSchema = z.object({
  docenteId: z.string().uuid(),
  periodoId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = confirmarSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const { docenteId, periodoId } = validation.data;

    // Buscar horarios en BORRADOR para el docente y período
    const horariosBorrador = await prisma.horario.findMany({
      where: {
        docenteId,
        periodoId,
        estado: 'BORRADOR',
      },
    });

    if (horariosBorrador.length === 0) {
      return createSuccessResponse({
        message: 'No hay horarios en borrador para confirmar.',
        cantidad: 0,
      });
    }

    const user = { userId: 'sistema-operador' };
    
    // Obtener información del docente y usuario
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: { select: { id: true, nombre: true, apellidos: true, email: true } },
      },
    });

    if (!docente) {
      return createErrorResponse('DOCENTE_NOT_FOUND', 'Docente no encontrado', 404);
    }

    const horariosConfirmados = [];
    for (const h of horariosBorrador) {
      const hc = await servicioHorario.confirmar(h.id, user.userId);
      horariosConfirmados.push(hc);
    }

    const nombreDocente = `${docente.usuario.nombre} ${docente.usuario.apellidos}`;
    const detallesCursos = horariosConfirmados
      .map(hc => `- ${hc.curso.nombre} (Día: ${hc.diaSemana || 'Desconocido'}, Hora: ${hc.horaInicio || '--:--'} - ${hc.horaFin || '--:--'}, Ambiente: ${hc.ambiente ? hc.ambiente.nombre : 'Sin ambiente'})`)
      .join('\n');

    // Enviar notificación consolidada por CORREO
    try {
      await gestorNotificaciones.enviarNotificacion({
        usuarioId: docente.usuario.id,
        tipo: 'CONFIRMACION_HORARIO',
        titulo: 'Horarios Confirmados - Registro Exitoso',
        mensaje: `Estimado(a) ${nombreDocente},\n\nLe informamos que sus horarios han sido registrados y confirmados exitosamente en el sistema:\n\n${detallesCursos}\n\nAtentamente,\nEscuela de Ingeniería de Sistemas - UNT`,
        prioridad: 'ALTA',
        canal: 'CORREO',
      });
    } catch (error) {
      console.error('Error enviando notificación de confirmación consolidada por correo:', error);
    }

    // Enviar notificación consolidada por SISTEMA
    try {
      await gestorNotificaciones.enviarNotificacion({
        usuarioId: docente.usuario.id,
        tipo: 'CONFIRMACION_HORARIO',
        titulo: 'Horarios Confirmados',
        mensaje: `Se han confirmado exitosamente sus ${horariosConfirmados.length} bloques horarios programados.`,
        prioridad: 'ALTA',
        canal: 'SISTEMA',
      });
    } catch (error) {
      console.error('Error enviando notificación de confirmación consolidada por sistema:', error);
    }

    return createSuccessResponse({
      message: 'Horarios confirmados exitosamente.',
      cantidad: horariosConfirmados.length,
      horarios: horariosConfirmados,
    });
  } catch (error: any) {
    console.error('Error confirmando horarios:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al confirmar horarios', 500);
  }
}
