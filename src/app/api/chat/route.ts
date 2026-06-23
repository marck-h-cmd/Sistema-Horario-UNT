// @ts-nocheck
import { createGroq } from '@ai-sdk/groq';
import { generateText, stepCountIs } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

// Limitar historial para no exceder tokens gratuitos
const MAX_HISTORY_MESSAGES = 6;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

import { TokenService } from '@/services/auth/TokenService';

const tokenService = new TokenService();

export async function POST(req: Request) {
  try {
    const { sessionId, content } = await req.json();

    if (!content || !content.trim()) {
      return Response.json({ error: 'El mensaje no puede estar vacío.' }, { status: 400 });
    }

    let userId: string | null = null;

    // 1. Extraer token de cookies o header Authorization
    let token: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token) {
      // Intentar leer cookies
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookiesMap = Object.fromEntries(
          cookieHeader.split(';').map(c => c.trim().split('='))
        );
        token = cookiesMap['auth_token'] || null;
      }
    }

    if (token) {
      try {
        const payload = await tokenService.validateToken(token);
        userId = payload.userId;
      } catch (e) {}
    }

    if (userId) {
      const userExists = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!userExists) {
        userId = null;
      }
    }

    let session = null;

    if (userId) {
      if (sessionId) {
        session = await prisma.chatSesion.findFirst({
          where: { id: sessionId, usuarioId: userId }
        });
      }
      if (!session) {
        session = await prisma.chatSesion.findFirst({
          where: { usuarioId: userId },
          orderBy: { updatedAt: 'desc' }
        });
      }
      if (!session) {
        session = await prisma.chatSesion.create({
          data: {
            usuarioId: userId,
            titulo: 'Nueva conversación'
          }
        });
      }
    } else {
      if (sessionId) {
        session = await prisma.chatSesion.findUnique({
          where: { id: sessionId }
        });
      }
      if (!session) {
        session = await prisma.chatSesion.create({
          data: {
            titulo: 'Conversación de invitado'
          }
        });
      }
    }

    // 2. Guardar el mensaje del usuario en la base de datos
    await prisma.chatMensaje.create({
      data: {
        sesionId: session.id,
        role: 'user',
        contenido: content.trim()
      }
    });

    // 3. Obtener el historial reciente de la sesión para el modelo
    const dbMessages = await prisma.chatMensaje.findMany({
      where: { sesionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES
    });

    // Reordenar cronológicamente para el prompt
    const messages = dbMessages.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.contenido
    }));

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      stopWhen: stepCountIs(3),
      onStepFinish: (event) => {
        console.log('[DEBUG] Step finished:', {
          text: event.text,
          finishReason: event.finishReason,
          toolCalls: event.toolCalls,
          toolResults: event.toolResults?.map(r => ({
            toolName: r.toolName,
            result: typeof r.result === 'object' ? JSON.stringify(r.result).substring(0, 100) : r.result
          }))
        });
      },
      system: `Eres FelIxA, la asistente virtual del Sistema de Horarios de la UNT - Ingeniería de Sistemas. Responde breve y claramente en español.
Usa las herramientas para consultar datos reales. Siempre genera texto de respuesta tras usar una herramienta.

IMPORTANTE: Cuando llames a las herramientas, debes usar EXACTAMENTE los nombres de parámetros definidos en su esquema en inglés (camelCase):
- Para 'buscarAmbientesLibres', debes usar estrictamente los parámetros: 'diaSemana' (debe ser en mayúsculas: 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'), 'horaInicio' (formato 'HH:MM'), 'horaFin' (formato 'HH:MM'). Opcionalmente 'tipoAmbiente' (si el usuario especifica aula o laboratorio). ¡NO uses 'día', 'dia_semana', 'hora_inicio', ni 'hora_fin'!
- Para 'consultarDocente', debes usar estrictamente los parámetros: 'nombre', 'incluirHorario'.`,
      messages,
      tools: {
        buscarAmbientesLibres: {
          description: 'Busca ambientes (laboratorios/aulas) libres en un día y rango de horas.',
          parameters: z.object({
            diaSemana: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']),
            horaInicio: z.string().describe('HH:MM'),
            horaFin: z.string().describe('HH:MM'),
            tipoAmbiente: z.enum(['AULA', 'LABORATORIO', 'AUDITORIO']).optional(),
          }),
          inputSchema: z.object({
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

              const toMin = (t: string) => { 
                const parts = t.split(':').map(Number);
                return parts[0] * 60 + (parts[1] || 0); 
              };
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
        },

        consultarDocente: {
          description: 'Busca información o el horario de un docente por nombre o apellidos.',
          parameters: z.object({
            nombre: z.string().describe('Nombre o apellidos del docente'),
            incluirHorario: z.boolean().default(true).describe('Si se debe incluir el horario de clases'),
          }),
          inputSchema: z.object({
            nombre: z.string().describe('Nombre o apellidos del docente'),
            incluirHorario: z.boolean().default(true).describe('Si se debe incluir el horario de clases'),
          }),
          execute: async ({ nombre, incluirHorario }) => {
            try {
              console.log('[DEBUG] Tool consultarDocente called with:', { nombre, incluirHorario });
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

              if (docentes.length === 0) {
                console.log('[DEBUG] Tool consultarDocente: No docentes found');
                return { encontrado: false, mensaje: `No existe docente con nombre "${nombre}"` };
              }

              const res = docentes.map(d => ({
                nombre: `${d.usuario.nombre} ${d.usuario.apellidos}`,
                email: d.usuario.email,
                categoria: d.categoria,
                dedicacion: d.dedicacion,
                departamento: d.departamento?.nombre ?? 'No asignado',
                horarios: incluirHorario ? (d.horarios ?? []).map(h => ({
                  dia: h.diaSemana,
                  de: h.horaInicio,
                  a: h.horaFin,
                  curso: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre ?? '-',
                  aula: h.ambiente?.nombre ?? '-',
                  estado: h.estado
                })) : undefined
              }));
              console.log('[DEBUG] Tool consultarDocente result:', JSON.stringify(res));
              return res;
            } catch (e: any) {
              console.error('[DEBUG] Tool consultarDocente error:', e);
              return { error: e.message };
            }
          }
        },
      }
    });

    const finalText = result.text || '';

    // Guardar la respuesta del chatbot en la base de datos
    const assistantMessage = await prisma.chatMensaje.create({
      data: {
        sesionId: session.id,
        role: 'assistant',
        contenido: finalText
      }
    });

    // Actualizar updatedAt de la sesión
    await prisma.chatSesion.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });

    return Response.json({
      text: finalText,
      sessionId: session.id,
      createdAt: assistantMessage.createdAt
    });

  } catch (error: any) {
    console.error('[Chat API] Error:', error.stack || error.message);

    if (error.message?.includes('quota') || error.message?.includes('rate') || error.message?.includes('429')) {
      return Response.json({
        text: '⏳ El servicio de IA está temporalmente limitado por cuota. Por favor espera unos segundos y vuelve a intentarlo.'
      }, { status: 200 });
    }

    return Response.json({ text: `Error: ${error.message}` }, { status: 500 });
  }
}
