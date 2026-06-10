// @ts-nocheck
import { google } from '@ai-sdk/google';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await generateText({
      model: google('gemini-2.0-flash'),
      maxSteps: 5,
      system: `Eres un asistente virtual inteligente y amigable para el Sistema de Gestión de Horarios de la Escuela de Ingeniería de Sistemas de la Universidad Nacional de Trujillo (UNT).
Tu objetivo es ayudar a estudiantes, docentes y administrativos respondiendo sus dudas con voz amable, profesional y concisa.
Debes priorizar y dar detalles completos cuando te pregunten sobre docentes, sus horarios, o sobre laboratorios/aulas libres.
SIEMPRE usa las herramientas disponibles para consultar la base de datos antes de responder sobre disponibilidades y horarios.
SIEMPRE genera un texto de respuesta después de usar una herramienta, explicando los datos obtenidos al usuario de manera clara.
Si una herramienta retorna error o lista vacía, comunícalo amablemente al usuario.`,
      messages,
      tools: {
        buscarAmbientesLibres: tool({
          description: 'Busca qué laboratorios o aulas están libres en un día y rango de horas específico.',
          parameters: z.object({
            diaSemana: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']),
            horaInicio: z.string().describe('Hora de inicio en formato HH:MM (ej. 15:00)'),
            horaFin: z.string().describe('Hora de fin en formato HH:MM (ej. 18:00)'),
            tipoAmbiente: z.enum(['AULA', 'LABORATORIO', 'AUDITORIO']).optional(),
          }),
          execute: async ({ diaSemana, horaInicio, horaFin, tipoAmbiente }) => {
            try {
              const ambientes = await prisma.ambiente.findMany({
                where: { activo: true, ...(tipoAmbiente ? { tipo: tipoAmbiente } : {}) },
                include: {
                  horarios: {
                    where: { diaSemana, estado: { not: 'CANCELADO' } }
                  }
                }
              });

              const timeToMin = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + (m || 0);
              };

              const startMin = timeToMin(horaInicio);
              const endMin = timeToMin(horaFin);

              const libres = ambientes.filter(amb =>
                !amb.horarios.some(h => {
                  if (!h.horaInicio || !h.horaFin) return false;
                  return Math.max(startMin, timeToMin(h.horaInicio)) < Math.min(endMin, timeToMin(h.horaFin));
                })
              );

              console.log(`[Chat Tool] buscarAmbientesLibres: ${libres.length} libres de ${ambientes.length} totales`);
              return {
                totalAmbientes: ambientes.length,
                libres: libres.length,
                lista: libres.map(l => ({ nombre: l.nombre, tipo: l.tipo, capacidad: l.capacidad }))
              };
            } catch (e: any) {
              console.error('[Chat Tool] buscarAmbientesLibres error:', e.message);
              return { error: e.message };
            }
          },
        }),

        consultarInfoDocente: tool({
          description: 'Consulta información general de un docente: departamento, categoría, correo, dedicación.',
          parameters: z.object({
            nombre: z.string().describe('Nombre o apellidos del docente'),
          }),
          execute: async ({ nombre }) => {
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
                include: { usuario: true, departamento: true },
                take: 5
              });

              console.log(`[Chat Tool] consultarInfoDocente "${nombre}": ${docentes.length} encontrados`);
              if (docentes.length === 0) return { encontrados: 0, mensaje: `No se encontró ningún docente con el nombre "${nombre}"` };

              return {
                encontrados: docentes.length,
                docentes: docentes.map(d => ({
                  nombre: `${d.usuario.nombre} ${d.usuario.apellidos}`,
                  email: d.usuario.email,
                  categoria: d.categoria,
                  dedicacion: d.dedicacion,
                  departamento: d.departamento?.nombre || 'No asignado'
                }))
              };
            } catch (e: any) {
              console.error('[Chat Tool] consultarInfoDocente error:', e.message);
              return { error: e.message };
            }
          }
        }),

        consultarHorarioDocente: tool({
          description: 'Consulta el horario de clases de un docente: días, horas, cursos y aulas asignadas.',
          parameters: z.object({
            nombre: z.string().describe('Nombre o apellidos del docente'),
          }),
          execute: async ({ nombre }) => {
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
                  horarios: {
                    include: { curso: true, ambiente: true },
                    orderBy: { diaSemana: 'asc' }
                  }
                },
                take: 1
              });

              console.log(`[Chat Tool] consultarHorarioDocente "${nombre}": ${docentes.length} encontrados`);
              if (docentes.length === 0) return { encontrado: false, mensaje: `No se encontró al docente "${nombre}" en el sistema` };

              const d = docentes[0];
              const horarios = d.horarios.map(h => ({
                curso: h.curso?.nombre ?? 'Sin curso',
                dia: h.diaSemana,
                inicio: h.horaInicio,
                fin: h.horaFin,
                ambiente: h.ambiente?.nombre ?? 'Sin ambiente',
                estado: h.estado
              }));

              console.log(`[Chat Tool] Horarios de ${d.usuario.nombre} ${d.usuario.apellidos}: ${horarios.length} registros`);
              return {
                encontrado: true,
                docente: `${d.usuario.nombre} ${d.usuario.apellidos}`,
                totalHorarios: horarios.length,
                horarios
              };
            } catch (e: any) {
              console.error('[Chat Tool] consultarHorarioDocente error:', e.message);
              return { error: e.message };
            }
          }
        }),
      }
    });

    // Debug: loguear todos los pasos para diagnosticar qué pasó
    console.log('[Chat API] finishReason:', result.finishReason);
    console.log('[Chat API] text length:', result.text?.length ?? 0);
    console.log('[Chat API] steps:', result.steps.map((s, i) => ({
      step: i,
      finishReason: s.finishReason,
      textLength: s.text?.length ?? 0,
      toolCalls: s.toolCalls?.length ?? 0
    })));

    // Intentar obtener texto de cualquier paso que lo tenga
    let finalText = result.text ?? '';

    if (!finalText.trim()) {
      // Buscar texto en pasos anteriores (de atrás hacia adelante)
      for (let i = result.steps.length - 1; i >= 0; i--) {
        if (result.steps[i]?.text?.trim()) {
          finalText = result.steps[i].text;
          console.log(`[Chat API] Texto recuperado del paso ${i}`);
          break;
        }
      }
    }

    if (!finalText.trim()) {
      console.warn('[Chat API] No se generó texto. Steps:', JSON.stringify(result.steps.map(s => ({
        finishReason: s.finishReason,
        text: s.text,
        toolResults: s.toolResults
      })), null, 2));
      return Response.json({
        text: 'Lo siento, no pude generar una respuesta en este momento. Por favor intenta de nuevo.'
      });
    }

    return Response.json({ text: finalText });

  } catch (error: any) {
    console.error('[Chat API] Error fatal:', error);
    return Response.json(
      { text: `Error del servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
