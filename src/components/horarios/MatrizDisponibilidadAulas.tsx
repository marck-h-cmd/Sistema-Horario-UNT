'use client';

import { useEffect, useState } from 'react';

const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const DIAS_LABEL: Record<string,string> = {
  LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles',
  JUEVES:'Jueves', VIERNES:'Viernes', SABADO:'Sábado',
};
const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00',
               '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

interface CeldaAula {
  cursoNombre?: string;
  docenteNombre?: string;
  grupoNombre?: string;
  estado?: string;
}

interface Props {
  periodoId?: string;
  ambienteId?: string;
  onCeldaClick?: (dia: string, hora: string) => void;
}

function getCeldaStyle(estado?: string) {
  switch (estado) {
    case 'ASIGNADO':  return 'bg-purple-100 border-purple-300';
    case 'TEMPORAL':  return 'bg-yellow-100 border-yellow-300';
    case 'BLOQUEADO': return 'bg-gray-100 border-gray-300 opacity-60';
    default:          return 'bg-white border-gray-200 hover:bg-purple-50 cursor-pointer';
  }
}

export default function MatrizDisponibilidadAulas({ periodoId, ambienteId, onCeldaClick }: Props) {
  const [matriz, setMatriz] = useState<Record<string, Record<string, CeldaAula>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!periodoId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ periodoId });
    if (ambienteId) params.append('ambienteId', ambienteId);
    fetch(`/api/horarios/disponibilidad-aulas?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const m: Record<string, Record<string, CeldaAula>> = {};
        (d.data ?? []).forEach((h: any) => {
          if (!m[h.dia]) m[h.dia] = {};
          m[h.dia][h.horaInicio] = {
            cursoNombre: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre,
            docenteNombre: h.docente ? `${h.cursoDocenteGrupo?.cursoDocente?.docente?.apellidos}` : undefined,
            grupoNombre: h.grupo?.nombre,
            estado: h.estado,
          };
        });
        setMatriz(m);
      })
      .catch(() => setMatriz({}))
      .finally(() => setLoading(false));
  }, [periodoId, ambienteId]);

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-gray-900">Disponibilidad de Aulas</h3>
        <p className="text-xs text-gray-500 mt-0.5">Ocupación por día y hora</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2.5 text-gray-500 font-semibold border border-gray-200 w-20 text-center">Hora</th>
              {DIAS.map(dia => (
                <th key={dia} className="px-3 py-2.5 text-gray-700 font-semibold border border-gray-200 text-center min-w-[110px]">
                  {DIAS_LABEL[dia]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="sticky left-0 bg-gray-50 border border-gray-200 px-3 py-2">
                      <div className="h-3 bg-gray-200 animate-pulse rounded" />
                    </td>
                    {DIAS.map(d => (
                      <td key={d} className="border border-gray-200 p-1" style={{ height: 52 }}>
                        <div className="h-full bg-gray-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : HORAS.map(hora => (
                  <tr key={hora}>
                    <td className="sticky left-0 bg-gray-50 border border-gray-200 px-3 py-2 text-center font-medium text-gray-600">
                      {hora}
                    </td>
                    {DIAS.map(dia => {
                      const celda = matriz[dia]?.[hora];
                      return (
                        <td
                          key={dia}
                          onClick={() => !celda?.estado && onCeldaClick?.(dia, hora)}
                          className={`border p-1.5 transition-colors ${getCeldaStyle(celda?.estado)}`}
                          style={{ height: 52 }}
                        >
                          {celda?.estado && (
                            <div className="leading-tight overflow-hidden">
                              <div className="font-semibold truncate text-gray-800">{celda.cursoNombre}</div>
                              <div className="text-gray-500 truncate">{celda.docenteNombre}</div>
                              {celda.grupoNombre && <div className="text-gray-400">{celda.grupoNombre}</div>}
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