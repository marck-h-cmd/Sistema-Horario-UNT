'use client';

import { useEffect, useState } from 'react';

const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
const HORAS = ['07','08','09','10','11','12','13','14','15','16','17','18','19','20'];
const DIA_MAP: Record<string,string> = { LUNES:'Lun',MARTES:'Mar',MIERCOLES:'Mié',JUEVES:'Jue',VIERNES:'Vie',SABADO:'Sáb' };

interface CalorData { dia: string; hora: string; ocupacion: number; ambientes: number; }

function getColor(v: number): string {
  if (v === 0) return '#f9fafb';
  if (v < 20)  return '#dbeafe';
  if (v < 40)  return '#93c5fd';
  if (v < 60)  return '#3b82f6';
  if (v < 80)  return '#1d4ed8';
  return '#1e3a8a';
}

const HeatTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ 
      background: '#1e293b', 
      border: '1px solid #334155', 
      borderRadius: '10px', 
      padding: '8px 14px', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)' 
    }}>
      <p style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>{label}</p>
      <p style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700' }}>{payload[0].value}</p>
    </div>
  );
};

export default function MapaCalorOcupacion({ periodoId }: { periodoId?: string }) {
  const [rawData, setRawData] = useState<CalorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<CalorData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const params = periodoId ? `?periodoId=${periodoId}` : '';
    fetch(`/api/estadisticas/mapa-calor${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setRawData(d.data ?? [])).catch(() => setRawData([])).finally(() => setLoading(false));
  }, [periodoId]);

  const lookup: Record<string, Record<string, CalorData>> = {};
  rawData.forEach(d => {
    const diaLabel = DIA_MAP[d.dia] ?? d.dia;
    if (!lookup[diaLabel]) lookup[diaLabel] = {};
    lookup[diaLabel][d.hora] = d;
  });

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Mapa de Calor — Ocupación</h3>
          <p className="text-xs text-gray-500 mt-0.5">Uso de ambientes por día y hora</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          {['#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a'].map((c,i) => (
            <div key={i} className="w-4 h-3 rounded-sm" style={{ background: c }} />
          ))}
          <span className="ml-1">baja → alta</span>
        </div>
      </div>
      <div className="card-body pt-3 overflow-x-auto">
        {loading ? (
          <div className="h-40 bg-gray-50 animate-pulse rounded" />
        ) : (
          <div className="min-w-[420px]">
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns:`36px repeat(${DIAS.length}, 1fr)` }}>
              <div />
              {DIAS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-500 pb-1">{d}</div>
              ))}
            </div>
            {HORAS.map(hora => (
              <div key={hora} className="grid gap-1 mb-1" style={{ gridTemplateColumns:`36px repeat(${DIAS.length}, 1fr)` }}>
                <div className="text-[10px] text-gray-400 text-right pr-1 leading-7">{hora}:00</div>
                {DIAS.map(dia => {
                  const cell = lookup[dia]?.[hora+':00'] ?? lookup[dia]?.[hora];
                  const val = cell?.ocupacion ?? 0;
                  return (
                    <div key={dia}
                      className="h-7 rounded-md flex items-center justify-center text-[9px] font-medium cursor-default transition-transform hover:scale-110"
                      style={{ background: getColor(val), color: val >= 60 ? '#fff' : '#374151' }}
                      onMouseEnter={() => setHover(cell ?? null)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {val > 0 ? `${val}%` : ''}
                    </div>
                  );
                })}
              </div>
            ))}
            {hover && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                <b>{DIA_MAP[hover.dia] ?? hover.dia}</b> · {hover.hora} — <b>{hover.ocupacion}%</b> ocupación · {hover.ambientes} ambientes en uso
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}