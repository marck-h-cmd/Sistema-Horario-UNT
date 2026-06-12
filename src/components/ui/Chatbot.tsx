'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Bot, Loader2 } from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Parsea el stream de texto del Vercel AI SDK.
 * El formato es líneas como: 0:"texto" o 0:texto
 * También puede venir texto plano directo.
 */
function parseAIStreamChunk(raw: string): string {
  let result = '';
  const lines = raw.split('\n');
  for (const line of lines) {
    // Formato Vercel AI SDK v3: `0:"texto"`
    if (line.startsWith('0:')) {
      const value = line.slice(2);
      try {
        result += JSON.parse(value);
      } catch {
        // Si no es JSON válido, usar el valor directamente
        result += value.replace(/^"|"$/g, '');
      }
    }
    // Formato data stream: `data: "texto"`
    else if (line.startsWith('data: ')) {
      const value = line.slice(6);
      if (value === '[DONE]') continue;
      try {
        const parsed = JSON.parse(value);
        if (parsed?.choices?.[0]?.delta?.content) {
          result += parsed.choices[0].delta.content;
        } else if (typeof parsed === 'string') {
          result += parsed;
        }
      } catch {
        result += value;
      }
    }
  }
  return result;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);

  // Mantener ref sincronizada para usarla en callbacks sin stale closure
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Síntesis de voz
  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/\*/g, '').replace(/#/g, '')
    );
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // ── Enviar mensaje ──────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text };
    const currentMessages = messagesRef.current;
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const historyForApi = [
      ...currentMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Error ${res.status}: ${errBody}`);
      }

      // La API ahora devuelve JSON simple: { text: "..." }
      const data = await res.json();
      const responseText: string = data.text ?? '';
      console.log("respuesta" ,responseText);

      if (!responseText.trim()) {
        throw new Error('El asistente no generó una respuesta. Intenta reformular tu pregunta.');
      }

      const assistantMsg: Message = { id: uid(), role: 'assistant', content: responseText.trim() };
      setMessages(prev => [...prev, assistantMsg]);
      speak(assistantMsg.content);

    } catch (err: any) {
      console.error('[Chatbot] Error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: `⚠️ ${err.message || 'Error al conectar con el asistente. Inténtalo de nuevo.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, speak]);



  // ── Reconocimiento de voz ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'es-ES';

    rec.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      if (transcript?.trim()) {
        sendMessage(transcript.trim());
      }
    };

    rec.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Permiso de micrófono denegado. Habilítalo en tu navegador y accede solo desde localhost o HTTPS.');
      } else if (event.error !== 'no-speech') {
        console.error('[Chatbot] Speech error:', event.error);
      }
    };

    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  // Solo inicializar una vez al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleVoice = () => {
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceEnabled(v => !v);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    sendMessage(text);
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 hover:scale-105 transition-all z-[9999] flex items-center justify-center"
          aria-label="Abrir asistente"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Ventana del Chatbot */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden">

          {/* Header */}
          <div className="bg-emerald-600 p-4 text-white flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <Bot size={22} />
              <h3 className="font-semibold text-sm">FelIxA</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className="p-1.5 hover:bg-emerald-700 rounded-md transition-colors"
                title={voiceEnabled ? 'Silenciar respuestas de voz' : 'Activar respuestas de voz'}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-emerald-700 rounded-md transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-500 mt-6 px-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bot size={32} />
                </div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">¡Hola! Soy FelIxA.</p>
                <p>Pregúntame sobre <b>horarios de docentes</b> o <b>laboratorios libres</b>.</p>
                <p className="mt-3 text-xs text-slate-400">Escribe o usa el micrófono para hablar.</p>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 mt-1">
                    <Bot size={16} />
                  </div>
                )}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mt-1">
                  <Bot size={16} />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl rounded-tl-sm flex gap-1.5 items-center shadow-sm">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2 items-center"
          >
            <button
              type="button"
              onClick={toggleListen}
              disabled={isLoading}
              className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50'
              }`}
              title={isListening ? 'Detener grabación' : 'Hablar'}
            >
              {isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={isListening ? 'Escuchando...' : 'Escribe tu pregunta...'}
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-200"
              disabled={isListening || isLoading}
              autoComplete="off"
            />

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Enviar"
            >
              {isLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <Send size={18} />
              }
            </button>
          </form>
        </div>
      )}
    </>
  );
}
