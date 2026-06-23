'use client';

import { useEffect, useState } from 'react';

const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const DIAS_LABEL: Record<string,string> = {
  LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles',
  JUEVES:'Jueves', VIERNES:'Viernes', SABADO:'Sábado',
};
const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00',
               '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

interface CeldaLab {
  cursoNombre?: string;
  docenteNombre?: string;
  estado?: string;
  esPractica?: boolean;
}

interface Props {
  periodoId?: string;
  laboratorioId?: string;
  onCeldaClick?: (dia: string, hora: string) => void;
}

function getCeldaStyle(estado?: string, esPractica?: boolean) {
  if (estado === 'ASIGNADO')  return esPractica ? 'bg-green-100 border-green-300' : 'bg-teal-100 border-teal-300';
  if (estado === 'TEMPORAL')  return 'bg-yellow-100 border-yellow-300';
  if (estado === 'BLOQUEADO') return 'bg-gray-100 border-gray-300 opacity-60';
  return 'bg-white border-gray-200 hover:bg-teal-50 cursor-pointer';
}

export default function MatrizDisponibilidadLaboratorios({ periodoId, laboratorioId, onCeldaClick }: Props) {
  const [matriz, setMatriz] = useState<Record<string, Record<string, CeldaLab>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!periodoId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ periodoId });
    if (laboratorioId) params.append('laboratorioId', laboratorioId);
    fetch(`/api/horarios/disponibilidad-laboratorios?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const m: Record<string, Record<string, CeldaLab>> = {};
        (d.data ?? []).forEach((h: any) => {
          if (!m[h.dia]) m[h.dia] = {};
          m[h.dia][h.horaInicio] = {
            cursoNombre: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre,
            docenteNombre: h.docente?.apellidos,
            estado: h.estado,
            esPractica: h.esPractica,
          };
        });
        setMatriz(m);
      })
      .catch(() => setMatriz({}))
      .finally(() => setLoading(false));
  }, [periodoId, laboratorioId]);

  return (
    <div className="card overflow-hidden">
      <div className="card-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Disponibilidad de Laboratorios</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ocupación por día y hora</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-teal-100 border border-teal-300" />
            <span className="text-gray-500">Teoría</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span className="text-gray-500">Práctica</span>
          </div>
        </div>
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
                          className={`border p-1.5 transition-colors ${getCeldaStyle(celda?.estado, celda?.esPractica)}`}
                          style={{ height: 52 }}
                        >
                          {celda?.estado && (
                            <div className="leading-tight overflow-hidden">
                              <div className="font-semibold truncate text-gray-800">{celda.cursoNombre}</div>
                              <div className="text-gray-500 truncate">{celda.docenteNombre}</div>
                              {celda.esPractica && <div className="text-green-600 text-[9px]">PRÁCTICA</div>}
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