// @ts-nocheck
import { google } from '@ai-sdk/google';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

// Limitar historial para no exceder tokens gratuitos
const MAX_HISTORY_MESSAGES = 6;

export async function POST(req: Request) {
  try {
    const { messages: allMessages } = await req.json();

    // Tomar solo los últimos N mensajes para reducir tokens enviados
    const messages = allMessages.slice(-MAX_HISTORY_MESSAGES);

    const result = await generateText({
      model: google('gemini-2.0-flash-lite'),
      maxSteps: 3,
      system: `Eres asistente del Sistema de Horarios de la UNT - Ingeniería de Sistemas. Responde breve y claramente en español. Usa las herramientas para consultar datos reales. Siempre genera texto de respuesta tras usar una herramienta.`,
      messages,
      tools: {
        buscarAmbientesLibres: tool({
          description: 'Busca ambientes (laboratorios/aulas) libres en un día y rango de horas.',
          parameters: z.object({
            diaSemana: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']),
            horaInicio: z.string().describe('HH:MM'),
            horaFin: z.string().describe('HH:MM'),
            tipoAmbiente: z.enum(['AULA', 'LABORATORIO', 'AUDITORIO']).optional(),
          }),
          execute: async ({ diaSemana, horaInicio, horaFin, tipoAmbiente }) => {
            try {
              const ambientes = await prisma.ambiente.findMany({
                where: { activo: true, ...(tipoAmbiente ? { tipo: tipoAmbiente } : {}) },
                include: {
                  horarios: { where: { diaSemana, estado: { not: 'CANCELADO' } } }
                }
              });

              const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
              const s = toMin(horaInicio), e = toMin(horaFin);

              const libres = ambientes.filter(a =>
                !a.horarios.some(h => h.horaInicio && h.horaFin && Math.max(s, toMin(h.horaInicio)) < Math.min(e, toMin(h.horaFin)))
              );

              return {
                dia: diaSemana, de: horaInicio, a: horaFin,
                total: libres.length,
                ambientes: libres.slice(0, 10).map(l => `${l.nombre} (${l.tipo}, cap:${l.capacidad})`)
              };
            } catch (e: any) {
              return { error: e.message };
            }
          },
        }),

        consultarDocente: tool({
          description: 'Busca información o el horario de un docente por nombre o apellidos.',
          parameters: z.object({
            nombre: z.string().describe('Nombre o apellidos del docente'),
            incluirHorario: z.boolean().default(true).describe('Si se debe incluir el horario de clases'),
          }),
          execute: async ({ nombre, incluirHorario }) => {
            try {
              const docentes = await prisma.docente.findMany({
                where: {
                  usuario: {
                    OR: [
                      { nombre: { contains: nombre, mode: 'insensitive' } },
                      { apellidos: { contains: nombre, mode: 'insensitive' } }
                    ]
                  }
                },
                include: {
                  usuario: true,
                  departamento: true,
                  ...(incluirHorario ? {
                    horarios: {
                      include: { curso: true, ambiente: true },
                      orderBy: { diaSemana: 'asc' },
                      take: 15
                    }
                  } : {})
                },
                take: 2
              });

              if (docentes.length === 0) return { encontrado: false, mensaje: `No existe docente con nombre "${nombre}"` };

              return docentes.map(d => ({
                nombre: `${d.usuario.nombre} ${d.usuario.apellidos}`,
                email: d.usuario.email,
                categoria: d.categoria,
                dedicacion: d.dedicacion,
                departamento: d.departamento?.nombre ?? 'No asignado',
                horarios: incluirHorario ? (d.horarios ?? []).map(h => ({
                  dia: h.diaSemana,
                  de: h.horaInicio,
                  a: h.horaFin,
                  curso: h.curso?.nombre ?? '-',
                  aula: h.ambiente?.nombre ?? '-',
                  estado: h.estado
                })) : undefined
              }));
            } catch (e: any) {
              return { error: e.message };
            }
          }
        }),
      }
    });

    // Extraer texto del resultado (incluyendo pasos intermedios)
    let finalText = result.text ?? '';
    if (!finalText.trim()) {
      for (let i = result.steps.length - 1; i >= 0; i--) {
        if (result.steps[i]?.text?.trim()) {
          finalText = result.steps[i].text;
          break;
        }
      }
    }

    if (!finalText.trim()) {
      finalText = 'Lo siento, no pude generar una respuesta. Por favor intenta de nuevo con otra pregunta.';
    }

    return Response.json({ text: finalText });

  } catch (error: any) {
    console.error('[Chat API] Error:', error.message);

    // Detectar error de cuota y dar mensaje amigable
    if (error.message?.includes('quota') || error.message?.includes('rate') || error.message?.includes('429')) {
      return Response.json({
        text: '⏳ El servicio de IA está temporalmente limitado por cuota. Por favor espera unos segundos y vuelve a intentarlo.'
      }, { status: 200 }); // Retornar 200 para que el frontend lo muestre como mensaje normal
    }

    return Response.json({ text: `Error: ${error.message}` }, { status: 500 });
  }
}
