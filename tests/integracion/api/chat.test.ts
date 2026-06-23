import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as chatPost } from '@/app/api/chat/route';
import { GET as historyGet, POST as historyPost } from '@/app/api/chat/history/route';
import { prisma } from '@/lib/prisma';
import { TokenService } from '@/services/auth/TokenService';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: vi.fn(),
    },
    chatSesion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chatMensaje: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    ambiente: {
      findMany: vi.fn(),
    },
    docente: {
      findMany: vi.fn(),
    },
  },
}));

// Mock TokenService
vi.mock('@/services/auth/TokenService', () => {
  return {
    TokenService: vi.fn().mockImplementation(() => {
      return {
        validateToken: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
      };
    }),
  };
});

// Mock AI packages
vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn(() => vi.fn()),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Hola, soy FelIxA, ¿en qué puedo ayudarte?',
    finishReason: 'stop',
    steps: [{ text: 'Hola, soy FelIxA, ¿en qué puedo ayudarte?' }],
  }),
  stepCountIs: vi.fn().mockReturnValue(3),
}));

describe('Chat API & History Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/chat/history', () => {
    it('debe crear una nueva sesión para un invitado si no se provee sessionId', async () => {
      const mockSession = { id: 'new-guest-session-id', titulo: 'Conversación de invitado', mensajes: [] };
      (prisma.chatSesion.create as any).mockResolvedValue(mockSession);

      const request = new Request('http://localhost:3000/api/chat/history');
      (request as any).cookies = {
        get: vi.fn().mockReturnValue(undefined)
      };
      const response = await historyGet(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBe('new-guest-session-id');
      expect(json.messages).toEqual([]);
      expect(prisma.chatSesion.create).toHaveBeenCalledWith({
        data: { titulo: 'Conversación de invitado' },
        include: { mensajes: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('debe retornar el historial de una sesión de invitado si se provee sessionId', async () => {
      const mockSession = {
        id: 'guest-session-123',
        titulo: 'Conversación de invitado',
        mensajes: [
          { id: 'm1', role: 'user', contenido: 'hola', createdAt: new Date() },
          { id: 'm2', role: 'assistant', contenido: 'hola humano', createdAt: new Date() },
        ],
      };
      (prisma.chatSesion.findUnique as any).mockResolvedValue(mockSession);

      const request = new Request('http://localhost:3000/api/chat/history?sessionId=guest-session-123');
      (request as any).cookies = {
        get: vi.fn().mockReturnValue(undefined)
      };
      const response = await historyGet(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBe('guest-session-123');
      expect(json.messages).toHaveLength(2);
      expect(json.messages[0].content).toBe('hola');
      expect(prisma.chatSesion.findUnique).toHaveBeenCalledWith({
        where: { id: 'guest-session-123' },
        include: { mensajes: { orderBy: { createdAt: 'asc' } } },
      });
    });
  });

  describe('POST /api/chat/history (limpiar/iniciar nueva conversación)', () => {
    it('debe crear una nueva sesión de invitado al llamar a POST', async () => {
      const mockSession = { id: 'new-session-reset-id', titulo: 'Conversación de invitado' };
      (prisma.chatSesion.create as any).mockResolvedValue(mockSession);

      const request = new Request('http://localhost:3000/api/chat/history', {
        method: 'POST',
      });
      (request as any).cookies = {
        get: vi.fn().mockReturnValue(undefined)
      };
      const response = await historyPost(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBe('new-session-reset-id');
      expect(json.messages).toEqual([]);
      expect(prisma.chatSesion.create).toHaveBeenCalledWith({
        data: {
          usuarioId: null,
          titulo: 'Conversación de invitado',
        },
      });
    });
  });

  describe('POST /api/chat (enviar mensaje)', () => {
    it('debe responder 400 si el contenido está vacío', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
      });
      const response = await chatPost(request as any);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('El mensaje no puede estar vacío.');
    });

    it('debe guardar el mensaje del usuario, invocar la IA y guardar la respuesta de la IA', async () => {
      const mockSession = { id: 'session-456', titulo: 'Conversación de invitado' };
      (prisma.chatSesion.create as any).mockResolvedValue(mockSession);
      (prisma.chatMensaje.create as any).mockResolvedValue({ id: 'm-msg', role: 'user', contenido: 'hola', createdAt: new Date() });
      (prisma.chatMensaje.findMany as any).mockResolvedValue([
        { id: 'm-msg', role: 'user', contenido: 'hola', createdAt: new Date() }
      ]);
      (prisma.chatSesion.update as any).mockResolvedValue({ id: 'session-456' });

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ content: 'hola' }),
      });
      const response = await chatPost(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.text).toBe('Hola, soy FelIxA, ¿en qué puedo ayudarte?');
      expect(json.sessionId).toBe('session-456');

      expect(prisma.chatMensaje.create).toHaveBeenCalledTimes(2);
      expect(prisma.chatSesion.update).toHaveBeenCalled();
    });
  });
});
