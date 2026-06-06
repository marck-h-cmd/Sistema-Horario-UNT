'use client';

import { useEffect, useState, useRef } from 'react';

interface Actividad {
  id: string;
  tipo: string;
  descripcion: string;
  usuario?: string;
  timestamp: string;
}

const TIPO_CONFIG: Record<string, { color: string; bg: string }> = {
  ASIGNACION:   { color: 'text-green-700',  bg: 'bg-green-100'  },
  ELIMINACION:  { color: 'text-red-700',    bg: 'bg-red-100'    },
  PUBLICACION:  { color: 'text-blue-700',   bg: 'bg-blue-100'   },
  CONFLICTO:    { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  NOTIFICACION: { color: 'text-purple-700', bg: 'bg-purple-100' },
  LOGIN:        { color: 'text-gray-700',   bg: 'bg-gray-100'   },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export default function ActividadTiempoReal() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auditoria/historial?limit=15', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setActividades(d.data?.items ?? d.data ?? []))
      .catch(() => setActividades([]))
      .finally(() => setLoading(false));

    try {
      const wsEnabled = process.env.NEXT_PUBLIC_WS_ENABLED === 'true';
      if (!wsEnabled) return () => { wsRef.current?.close(); };
      if (!token) return () => { wsRef.current?.close(); };
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/websocket?token=${encodeURIComponent(token)}&channel=general`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'actividad') setActividades(prev => [msg.data, ...prev].slice(0, 15));
        } catch {}
      };
    } catch {}

    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Actividad Reciente</h3>
          <p className="text-xs text-gray-500 mt-0.5">Últimas acciones del sistema</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-[10px] text-gray-500">{connected ? 'En vivo' : 'Diferido'}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-gray-50">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-100 animate-pulse rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : actividades.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Sin actividad reciente</div>
        ) : (
          actividades.map((a, i) => {
            const c = TIPO_CONFIG[a.tipo] ?? TIPO_CONFIG.LOGIN;
            return (
              <div key={a.id ?? i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${c.bg}`}>
                  <div className={`w-2 h-2 rounded-full ${c.color.replace('text-','bg-')}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 leading-snug">{a.descripcion}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.usuario && <span className="text-[10px] text-gray-400">{a.usuario}</span>}
                    <span className="text-[10px] text-gray-400">· {timeAgo(a.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
