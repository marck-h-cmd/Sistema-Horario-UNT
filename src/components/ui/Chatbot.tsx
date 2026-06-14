'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Bot, Loader2, Trash2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string | Date;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function formatMessageTime(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // WhatsApp-style Recording States
  const [recordingState, setRecordingState] = useState<'IDLE' | 'HOLDING' | 'LOCKED'>('IDLE');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for tracking recording and gesture coordinates (to avoid stale closures)
  const recordingStateRef = useRef<'IDLE' | 'HOLDING' | 'LOCKED'>('IDLE');
  const isPausedRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const currentTranscriptRef = useRef('');
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);

  // Sync refs to avoid stale closures in SpeechRecognition handlers
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if ((recordingState === 'HOLDING' || recordingState === 'LOCKED') && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (recordingState === 'IDLE') {
      setRecordingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState, isPaused]);

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Mantener ref sincronizada para usarla en callbacks sin stale closure
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cargar historial al montar o cuando cambie el usuario registrado
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const storedSessionId = sessionStorage.getItem('chatbot_session_id');
        const token = localStorage.getItem('accessToken');
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = storedSessionId 
          ? `/api/chat/history?sessionId=${storedSessionId}`
          : '/api/chat/history';

        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
            sessionStorage.setItem('chatbot_session_id', data.sessionId);
          }
          if (data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        console.error('Error al cargar historial del chat:', err);
      }
    };

    fetchHistory();
  }, [user]);

  const clearChat = useCallback(async () => {
    if (window.confirm('¿Estás seguro de que deseas iniciar una nueva conversación y borrar el historial en pantalla?')) {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/chat/history', {
          method: 'POST',
          headers
        });

        if (res.ok) {
          const data = await res.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
            sessionStorage.setItem('chatbot_session_id', data.sessionId);
          }
          setMessages([]);
        }
      } catch (err) {
        console.error('Error al limpiar chat:', err);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

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

    const userMsg: Message = { id: uid(), role: 'user', content: text, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: sessionId || sessionStorage.getItem('chatbot_session_id'),
          content: text
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Error ${res.status}: ${errBody}`);
      }

      // La API ahora devuelve JSON simple: { text: "...", sessionId: "..." }
      const data = await res.json();
      const responseText: string = data.text ?? '';
      const returnedSessionId: string = data.sessionId;

      if (returnedSessionId) {
        setSessionId(returnedSessionId);
        sessionStorage.setItem('chatbot_session_id', returnedSessionId);
      }
      console.log("respuesta" ,responseText);

      if (!responseText.trim()) {
        throw new Error('El asistente no generó una respuesta. Intenta reformular tu pregunta.');
      }

      const assistantMsg: Message = { 
        id: uid(), 
        role: 'assistant', 
        content: responseText.trim(),
        createdAt: data.createdAt || new Date()
      };
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
          createdAt: new Date()
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, speak, sessionId]);

  const cancelRecording = useCallback(() => {
    setRecordingState('IDLE');
    setIsPaused(false);
    setIsListening(false);
    dragStartRef.current = null;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    accumulatedTextRef.current = '';
    currentTranscriptRef.current = '';
  }, []);

  const stopAndSendRecording = useCallback(() => {
    setRecordingState('IDLE');
    setIsPaused(false);
    setIsListening(false);
    dragStartRef.current = null;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    
    const finalResult = (accumulatedTextRef.current + ' ' + currentTranscriptRef.current).trim();
    accumulatedTextRef.current = '';
    currentTranscriptRef.current = '';
    
    if (finalResult) {
      sendMessage(finalResult);
    }
  }, [sendMessage]);

  const togglePauseRecording = useCallback(() => {
    if (recordingStateRef.current !== 'LOCKED') return;
    
    if (!isPausedRef.current) {
      setIsPaused(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('[Chatbot] Error pausing recognition:', err);
        }
      }
    } else {
      setIsPaused(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (err) {
          console.error('[Chatbot] Error resuming recognition:', err);
        }
      }
    }
  }, []);

  const handleMicStart = useCallback((clientX: number, clientY: number) => {
    if (recordingStateRef.current !== 'IDLE') return;

    accumulatedTextRef.current = '';
    currentTranscriptRef.current = '';
    dragStartRef.current = { x: clientX, y: clientY };
    
    setRecordingState('HOLDING');
    setIsPaused(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('[Chatbot] Error starting speech recognition:', err);
      }
    }
  }, []);

  const handleMicMove = useCallback((clientX: number, clientY: number) => {
    if (recordingStateRef.current !== 'HOLDING' || !dragStartRef.current) return;
    
    const diffY = dragStartRef.current.y - clientY;
    const diffX = dragStartRef.current.x - clientX;
    
    if (diffY >= 60) {
      setRecordingState('LOCKED');
      dragStartRef.current = null;
    } else if (diffX >= 60) {
      cancelRecording();
    }
  }, [cancelRecording]);

  const handleMicEnd = useCallback(() => {
    if (recordingStateRef.current !== 'HOLDING') return;
    stopAndSendRecording();
  }, [stopAndSendRecording]);

  // Global gesture listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMicMove(e.clientX, e.clientY);
    };
    
    const handleGlobalMouseUp = () => {
      handleMicEnd();
    };

    if (recordingState === 'HOLDING') {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [recordingState, handleMicMove, handleMicEnd]);

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        handleMicMove(touch.clientX, touch.clientY);
      }
    };
    
    const handleGlobalTouchEnd = () => {
      handleMicEnd();
    };

    if (recordingState === 'HOLDING') {
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }
    
    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [recordingState, handleMicMove, handleMicEnd]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleMicStart(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      handleMicStart(touch.clientX, touch.clientY);
    }
  };

  // ── Reconocimiento de voz ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'es-ES';

    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      currentTranscriptRef.current = transcript.trim();
    };

    rec.onerror = (event: any) => {
      console.error('[Chatbot] Speech error:', event.error);
      
      if (event.error === 'not-allowed') {
        alert('Permiso de micrófono denegado o bloqueado. Habilítalo en los ajustes de tu navegador.');
        cancelRecording();
      } else if (event.error === 'audio-capture') {
        alert('No se detectó ningún micrófono o el dispositivo de entrada está ocupado.');
        cancelRecording();
      } else if (event.error !== 'no-speech' && event.error !== 'network') {
        alert(`Error de reconocimiento de voz: ${event.error}. Por favor revisa los dispositivos de tu sistema.`);
        cancelRecording();
      }
    };

    rec.onend = () => {
      // Merge current transcript when session ends
      if (currentTranscriptRef.current) {
        accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + currentTranscriptRef.current).trim();
        currentTranscriptRef.current = '';
      }

      // Auto-restart if holding/locked and not paused
      if ((recordingStateRef.current === 'HOLDING' || recordingStateRef.current === 'LOCKED') && !isPausedRef.current) {
        try {
          rec.start();
        } catch (err) {
          console.error('[Chatbot] Auto-restart failed:', err);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                onClick={clearChat}
                className="p-1.5 hover:bg-emerald-700 rounded-md transition-colors"
                title="Limpiar conversación"
                disabled={isLoading}
              >
                <Trash2 size={18} />
              </button>
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
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm flex flex-col ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap flex-1">{m.content}</div>
                  {m.createdAt && (
                    <span className={`text-[10px] self-end mt-1.5 leading-none select-none ${
                      m.role === 'user' ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {formatMessageTime(m.createdAt)}
                    </span>
                  )}
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

          {/* Custom style block for CSS animations */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes chatbotPulseRed {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(1.15); }
            }
            @keyframes chatbotSlideLeft {
              0% { transform: translateX(0); opacity: 0.9; }
              100% { transform: translateX(-12px); opacity: 0.2; }
            }
            @keyframes chatbotSlideUpLock {
              0% { transform: translateY(0); opacity: 0.4; }
              50% { transform: translateY(-6px); opacity: 1; }
              100% { transform: translateY(-12px); opacity: 0; }
            }
            .animate-chatbot-pulse-red {
              animation: chatbotPulseRed 1.2s infinite ease-in-out;
            }
            .animate-chatbot-slide-left {
              animation: chatbotSlideLeft 1.2s infinite ease-in-out;
            }
            .animate-chatbot-slide-up-lock {
              animation: chatbotSlideUpLock 1.5s infinite ease-in-out;
            }
          `}} />

          {/* Input or Recording Overlay */}
          {recordingState !== 'IDLE' ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2 items-center justify-between h-[62px] relative transition-all duration-300">
              
              {/* HOLDING State UI */}
              {recordingState === 'HOLDING' && (
                <>
                  {/* Flashing Red Dot and Timer */}
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-chatbot-pulse-red" />
                    <span className="text-sm font-mono">{formatRecordingTime(recordingTime)}</span>
                  </div>

                  {/* Slide to Cancel Text & Animation */}
                  <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium select-none">
                    <span className="animate-chatbot-slide-left font-bold">&lt;</span>
                    <span>Desliza para cancelar</span>
                  </div>

                  {/* Floating Lock Icon and held Mic Button */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-800 px-2 py-1.5 rounded-full border border-emerald-200 dark:border-slate-700 shadow-lg select-none">
                      <span className="animate-chatbot-slide-up-lock">🔒</span>
                      <span className="leading-none text-[8px] animate-chatbot-slide-up-lock">▲</span>
                    </div>
                    
                    <button
                      type="button"
                      className="p-2.5 bg-red-500 text-white rounded-full transition-transform scale-110 shadow-lg cursor-grab active:cursor-grabbing flex-shrink-0"
                      onMouseDown={onMouseDown}
                      onTouchStart={onTouchStart}
                      title="Suelte para enviar, deslice para bloquear o cancelar"
                    >
                      <Mic size={18} className="animate-pulse" />
                    </button>
                  </div>
                </>
              )}

              {/* LOCKED State UI */}
              {recordingState === 'LOCKED' && (
                <>
                  {/* Trash can to delete */}
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-2.5 bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-all active:scale-90 flex-shrink-0"
                    title="Eliminar grabación"
                  >
                    <Trash2 size={18} />
                  </button>

                  {/* Timer & Play/Pause controls */}
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-slate-400 dark:bg-slate-600' : 'bg-red-500 animate-chatbot-pulse-red'}`} />
                    <span className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300">{formatRecordingTime(recordingTime)}</span>

                    <button
                      type="button"
                      onClick={togglePauseRecording}
                      className={`p-2 rounded-full transition-all active:scale-90 flex-shrink-0 ${
                        isPaused
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-200'
                      }`}
                      title={isPaused ? 'Reanudar grabación' : 'Pausar grabación'}
                    >
                      {isPaused ? <Play size={18} /> : <Pause size={18} />}
                    </button>
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={stopAndSendRecording}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all active:scale-90 shadow-md flex-shrink-0"
                    title="Enviar mensaje"
                  >
                    <Send size={18} />
                  </button>
                </>
              )}

            </div>
          ) : (
            <form
              onSubmit={handleFormSubmit}
              className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2 items-center"
            >
              <button
                type="button"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                disabled={isLoading}
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 flex-shrink-0 transition-all active:scale-95"
                title="Mantén presionado para hablar (Desliza arriba para bloquear, izquierda para cancelar)"
              >
                <Mic size={20} />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Escribe tu pregunta..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-200"
                disabled={isLoading}
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
          )}
        </div>
      )}
    </>
  );
}
