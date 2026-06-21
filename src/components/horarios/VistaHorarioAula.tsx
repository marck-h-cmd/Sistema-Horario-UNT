'use client';

import { useEffect, useState } from 'react';

const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const DIAS_LABEL: Record<string,string> = {
  LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles',
  JUEVES:'Jueves', VIERNES:'Viernes', SABADO:'Sábado',
};
const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00',
               '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

interface Sesion {
  cursoNombre: string;
  docenteApellidos: string;
  grupoNombre?: string;
  estado: string;
}

interface Props {
  ambienteId: string;
  periodoId?: string;
}

export default function VistaHorarioAula({ ambienteId, periodoId }: Props) {
  const [matriz, setMatriz] = useState<Record<string, Record<string, Sesion>>>({});
  const [loading, setLoading] = useState(true);
  const [ambiente, setAmbiente] = useState<{ codigo: string; nombre: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ ambienteId });
    if (periodoId) params.append('periodoId', periodoId);
    Promise.all([
      fetch(`/api/horarios?${params}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/ambientes/${ambienteId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([horarios, amb]) => {
        setAmbiente(amb.data ?? null);
        const m: Record<string, Record<string, Sesion>> = {};
        (horarios.data?.items ?? []).forEach((h: any) => {
          if (!m[h.dia]) m[h.dia] = {};
          m[h.dia][h.horaInicio] = {
            cursoNombre: h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.nombre,
            docenteApellidos: h.docente?.apellidos ?? '',
            grupoNombre: h.grupo?.nombre,
            estado: h.estado,
          };
        });
        setMatriz(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ambienteId, periodoId]);

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-gray-900">
          Horario Aula: {ambiente ? `${ambiente.codigo} — ${ambiente.nombre}` : '...'}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-[500px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2.5 border border-gray-200 text-center w-16 text-gray-500 font-semibold">Hora</th>
              {DIAS.map(d => (
                <th key={d} className="px-3 py-2.5 border border-gray-200 text-center text-gray-700 font-semibold min-w-[100px]">
                  {DIAS_LABEL[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
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
                      const s = matriz[dia]?.[hora];
                      return (
                        <td key={dia}
                          className={`border p-1.5 ${s ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}
                          style={{ height: 52 }}
                        >
                          {s && (
                            <div className="leading-tight overflow-hidden">
                              <div className="font-semibold text-gray-800 truncate">{s.cursoNombre}</div>
                              <div className="text-gray-500 truncate">{s.docenteApellidos}</div>
                              {s.grupoNombre && <div className="text-gray-400">{s.grupoNombre}</div>}
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