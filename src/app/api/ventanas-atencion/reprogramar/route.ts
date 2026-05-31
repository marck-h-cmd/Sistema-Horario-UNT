import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GestorNotificaciones } from '@/services/notificaciones/GestorNotificaciones';
import { createSuccessResponse, createErrorResponse } from '@/lib/respuestas';
import { z } from 'zod';

const reprogramarSchema = z.object({
  periodoId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
});

const gestorNotificaciones = new GestorNotificaciones();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = reprogramarSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', 'Datos inválidos', 400, validation.error.errors);
    }

    const { periodoId, date } = validation.data;

    // 1. Obtener todas las ventanas del período con atenciones pendientes (ESPERANDO o EN_ATENCION)
    const ventanasConPendientes = await prisma.ventanaAtencion.findMany({
      where: {
        periodoId,
        atenciones: {
          some: {
            estado: { in: ['ESPERANDO', 'EN_ATENCION'] }
          }
        }
      },
      include: {
        atenciones: {
          where: {
            estado: { in: ['ESPERANDO', 'EN_ATENCION'] }
          },
          include: {
            docente: {
              include: {
                usuario: { select: { id: true, nombre: true, apellidos: true } }
              }
            }
          },
          orderBy: { posicion: 'asc' }
        }
      }
    });

    if (ventanasConPendientes.length === 0) {
      return createSuccessResponse({
        mensaje: 'No se encontraron ventanas con docentes pendientes por reprogramar.',
        cantidad: 0,
      });
    }

    const reprogramadas = [];

    for (const w of ventanasConPendientes) {
      // Formatear tiempos originales
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeInicio = `${pad(w.fechaInicio.getHours())}:${pad(w.fechaInicio.getMinutes())}`;
      const timeFin = `${pad(w.fechaFin.getHours())}:${pad(w.fechaFin.getMinutes())}`;

      const fechaInicio = new Date(`${date}T${timeInicio}:00`);
      const fechaFin = new Date(`${date}T${timeFin}:00`);

      // Crear nueva ventana de continuación
      const nuevaVentana = await prisma.ventanaAtencion.create({
        data: {
          periodoId,
          nombre: `${w.nombre} (Continuación)`,
          categorias: w.categorias as any,
          fechaInicio,
          fechaFin,
          estado: 'PROGRAMADA',
        }
      });

      // Mover los docentes pendientes a la nueva ventana
      for (let i = 0; i < w.atenciones.length; i++) {
        const atencion = w.atenciones[i];

        await prisma.atencionVentana.update({
          where: { id: atencion.id },
          data: {
            ventanaId: nuevaVentana.id,
            posicion: i + 1,
            estado: 'ESPERANDO',
            horaInicio: null,
            horaFin: null,
          }
        });

        // Notificar al docente de su reprogramación
        const nombreDocente = `${atencion.docente.usuario.nombre} ${atencion.docente.usuario.apellidos}`;
        const fechaLegible = new Date(fechaInicio).toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Notificación SISTEMA
        try {
          await gestorNotificaciones.enviarNotificacion({
            usuarioId: atencion.docente.usuario.id,
            tipo: 'VENTANA_ATENCION',
            titulo: 'Horario de Atención Reprogramado',
            mensaje: `Estimado(a) ${nombreDocente}, su turno de atención ha sido reprogramado para el día ${fechaLegible} a las ${timeInicio} en la ventana "${nuevaVentana.nombre}".`,
            prioridad: 'ALTA',
            canal: 'SISTEMA',
          });
        } catch (err) {
          console.error('Error notificando reprogramación por sistema:', err);
        }

        // Notificación CORREO
        try {
          await gestorNotificaciones.enviarNotificacion({
            usuarioId: atencion.docente.usuario.id,
            tipo: 'VENTANA_ATENCION',
            titulo: 'Reprogramación de Turno de Atención',
            mensaje: `Estimado(a) ${nombreDocente},\n\nLe informamos que su turno de atención para registro de horarios ha sido reprogramado:\n\nNueva Ventana: ${nuevaVentana.nombre}\nFecha: ${fechaLegible}\nHora: ${timeInicio} - ${timeFin}\n\nAtentamente,\nEscuela de Ingeniería de Sistemas - UNT`,
            prioridad: 'ALTA',
            canal: 'CORREO',
          });
        } catch (err) {
          console.error('Error notificando reprogramación por correo:', err);
        }
      }

      reprogramadas.push({
        original: w.nombre,
        nueva: nuevaVentana.nombre,
        docentesMovidos: w.atenciones.length,
      });

      // Si la ventana original estaba abierta o en curso, la cerramos ya que sus pendientes se mudaron
      if (w.estado === 'ABIERTA' || w.estado === 'EN_CURSO') {
        await prisma.ventanaAtencion.update({
          where: { id: w.id },
          data: { estado: 'CERRADA' }
        });
      }
    }

    return createSuccessResponse({
      mensaje: `Reprogramación completada para ${reprogramadas.length} ventanas.`,
      detalles: reprogramadas,
    });

  } catch (error: any) {
    console.error('Error reprogramando ventanas:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Error al reprogramar ventanas pendientes', 500);
  }
}
