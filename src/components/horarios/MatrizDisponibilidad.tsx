'use client';

import { useEffect, useState } from 'react';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIAS_LABEL: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
};
const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00',
               '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

interface Celda {
  docenteNombre?: string;
  cursoNombre?: string;
  ambienteCodigo?: string;
  estado?: 'ASIGNADO' | 'TEMPORAL' | 'BLOQUEADO' | 'DISPONIBLE';
  horarioId?: string;
}

interface Props {
  periodoId?: string;
  docenteId?: string;
  soloLectura?: boolean;
  onCeldaClick?: (dia: string, hora: string, celda: Celda) => void;
}

function getCeldaStyle(estado?: string) {
  switch (estado) {
    case 'ASIGNADO':  return 'bg-blue-100 border-blue-300 hover:bg-blue-200 cursor-pointer';
    case 'TEMPORAL':  return 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200 cursor-pointer';
    case 'BLOQUEADO': return 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60';
    default:          return 'bg-white border-gray-200 hover:bg-green-50 cursor-pointer';
  }
}

export default function MatrizDisponibilidad({ periodoId, docenteId, soloLectura = false, onCeldaClick }: Props) {
  const [matriz, setMatriz] = useState<Record<string, Record<string, Celda>>>({});
  const [loading, setLoading] = useState(true);
  const [celdaActiva, setCeldaActiva] = useState<{ dia: string; hora: string } | null>(null);

  useEffect(() => {
    if (!periodoId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ periodoId });
    if (docenteId) params.append('docenteId', docenteId);
    fetch(`/api/horarios/disponibilidad-matriz?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const m: Record<string, Record<string, Celda>> = {};
        (d.data ?? []).forEach((h: any) => {
          if (!m[h.dia]) m[h.dia] = {};
          m[h.dia][h.horaInicio] = {
            docenteNombre: h.docente ? `${h.cursoDocenteGrupo?.cursoDocente?.docente?.apellidos}, ${h.cursoDocenteGrupo?.cursoDocente?.docente?.nombres}` : undefined,
            cursoNombre: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre,
            ambienteCodigo: h.ambiente?.codigo,
            estado: h.estado,
            horarioId: h.id,
          };
        });
        setMatriz(m);
      })
      .catch(() => setMatriz({}))
      .finally(() => setLoading(false));
  }, [periodoId, docenteId]);

  const handleClick = (dia: string, hora: string) => {
    if (soloLectura) return;
    const celda = matriz[dia]?.[hora] ?? {};
    if (celda.estado === 'BLOQUEADO') return;
    setCeldaActiva({ dia, hora });
    onCeldaClick?.(dia, hora, celda);
  };

  if (!periodoId) {
    return (
      <div className="card card-body text-center py-12 text-gray-400 text-sm">
        Selecciona un período para ver la matriz de disponibilidad
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Leyenda */}
      <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-4">
        {[
          { color: 'bg-blue-100 border border-blue-300',   label: 'Asignado'   },
          { color: 'bg-yellow-100 border border-yellow-300', label: 'Temporal' },
          { color: 'bg-gray-100 border border-gray-300',   label: 'Bloqueado'  },
          { color: 'bg-white border border-gray-200',      label: 'Disponible' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className={`w-4 h-4 rounded ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-gray-500 font-semibold border border-gray-200 w-20 text-center">
                Hora
              </th>
              {DIAS.map(dia => (
                <th key={dia} className="px-3 py-2.5 text-gray-700 font-semibold border border-gray-200 text-center min-w-[110px]">
                  {DIAS_LABEL[dia]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, ri) => (
                  <tr key={ri}>
                    <td className="sticky left-0 bg-gray-50 border border-gray-200 px-3 py-2 text-center text-gray-400">
                      <div className="h-3 bg-gray-200 animate-pulse rounded" />
                    </td>
                    {DIAS.map(dia => (
                      <td key={dia} className="border border-gray-200 p-1" style={{ height: 52 }}>
                        <div className="h-full bg-gray-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : HORAS.map(hora => (
                  <tr key={hora}>
                    <td className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-center font-medium text-gray-600">
                      {hora}
                    </td>
                    {DIAS.map(dia => {
                      const celda = matriz[dia]?.[hora];
                      const isActiva = celdaActiva?.dia === dia && celdaActiva?.hora === hora;
                      return (
                        <td
                          key={dia}
                          onClick={() => handleClick(dia, hora)}
                          className={`border p-1.5 transition-colors ${getCeldaStyle(celda?.estado)} ${isActiva ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                          style={{ height: 52 }}
                        >
                          {celda?.estado && celda.estado !== 'DISPONIBLE' && (
                            <div className="leading-tight overflow-hidden">
                              {celda.cursoNombre && (
                                <div className="font-semibold truncate text-gray-800">{celda.cursoNombre}</div>
                              )}
                              {celda.docenteNombre && (
                                <div className="text-gray-500 truncate">{celda.docenteNombre}</div>
                              )}
                              {celda.ambienteCodigo && (
                                <div className="text-gray-400">{celda.ambienteCodigo}</div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}