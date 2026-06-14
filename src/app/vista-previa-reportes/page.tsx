'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Boton } from '@/components/ui/Boton';
import { FileText, Download, User, Calendar, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { NotificacionToast } from '@/components/ui/NotificacionToast';

interface DocenteItem {
  id: string;
  codigo: string;
  nombreCompleto: string;
  email: string;
  categoria: string;
}

interface PeriodoItem {
  id: string;
  nombre: string;
  activo: boolean;
}

export default function VistaPreviaReportes() {
  const [docentes, setDocentes] = useState<DocenteItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [docenteId, setDocenteId] = useState<string>('');
  const [periodoId, setPeriodoId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [docenteActual, setDocenteActual] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados de carga por reporte
  const [loadingReporte, setLoadingReporte] = useState<Record<string, boolean>>({
    carga: false,
    'dj-central': false,
    'dj-desconcentrada': false,
  });

  // Cargar lista de docentes y periodos al inicio
  useEffect(() => {
    async function inicializar() {
      setLoadingData(true);
      try {
        // Consultar periodos de forma segura
        const resPeriodos = await fetch('/api/periodos');
        if (resPeriodos.ok) {
          const data = await resPeriodos.json();
          const periodosList = data.data || [];
          setPeriodos(periodosList);
          
          // Seleccionar periodo activo por defecto
          const activo = periodosList.find((p: any) => p.activo);
          if (activo) setPeriodoId(activo.id);
          else if (periodosList.length > 0) setPeriodoId(periodosList[0].id);
        }

        // Consultar docentes (usando buscador o listar)
        const resDocentes = await fetch('/api/docentes?limit=50');
        if (resDocentes.ok) {
          const data = await resDocentes.json();
          const docentesList = (data.data || []).map((d: any) => ({
            id: d.id,
            codigo: d.codigo,
            nombreCompleto: `${d.usuario.nombre} ${d.usuario.apellidos}`,
            email: d.usuario.email,
            categoria: d.categoria,
          }));
          setDocentes(docentesList);
          if (docentesList.length > 0) {
            setDocenteId(docentesList[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error al inicializar cargado de combos:', err);
      } finally {
        setLoadingData(false);
      }
    }

    inicializar();
  }, []);

  // Cargar información del docente seleccionado
  const handleCargarDatosDocente = async () => {
    if (!docenteId || !periodoId) {
      NotificacionToast.error('Por favor, seleccione un Docente y un Periodo Académico.');
      return;
    }

    setLoading(true);
    setError(null);
    setDocenteActual(null);

    try {
      const res = await fetch(`/api/docentes/${docenteId}`);
      if (res.ok) {
        const data = await res.json();
        setDocenteActual(data);
        NotificacionToast.exito('Datos del docente cargados correctamente');
      } else {
        const err = await res.json();
        setError(err.message || 'No se pudo cargar la información del docente');
      }
    } catch (err: any) {
      setError('Error de red al conectar con el servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Descargar reporte PDF específico
  const handleDescargarReporte = async (tipo: 'carga' | 'dj-central' | 'dj-desconcentrada') => {
    if (!docenteId || !periodoId) {
      NotificacionToast.error('Seleccione el docente y periodo antes de descargar.');
      return;
    }

    setLoadingReporte((prev) => ({ ...prev, [tipo]: true }));
    try {
      const res = await fetch('/api/docente/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, docenteId, periodoId }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tipo}-${docenteId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        NotificacionToast.exito('Reporte PDF descargado con éxito');
      } else {
        const err = await res.json();
        NotificacionToast.error(err.message || 'Error al generar el PDF');
      }
    } catch (err: any) {
      NotificacionToast.error('Error al conectar con la API: ' + err.message);
    } finally {
      setLoadingReporte((prev) => ({ ...prev, [tipo]: false }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="p-3 bg-primary-500/10 rounded-xl text-primary-500">
          <FileText className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
            Vista Previa de Reportes PDF Oficiales
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Módulo temporal de pruebas para descarga de Formatos #1 y #2 oficiales (Sede Central y Desconcentrada).
          </p>
        </div>
      </div>

      {/* Selector de Docente y Periodo */}
      <Card className="shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <Card.Header>
          <Card.Title className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-500" />
            Configuración del Reporte
          </Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Combo de Docente */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Seleccione Docente
              </label>
              {docentes.length > 0 ? (
                <select
                  value={docenteId}
                  onChange={(e) => setDocenteId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} - {d.nombreCompleto} ({d.categoria})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Ingrese UUID de Docente de forma manual"
                    value={docenteId}
                    onChange={(e) => setDocenteId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠️ No se cargaron docentes automáticamente. Ingrese el ID manual.
                  </p>
                </div>
              )}
            </div>

            {/* Combo de Periodo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Seleccione Periodo Académico
              </label>
              {periodos.length > 0 ? (
                <select
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.activo ? '(Activo)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ingrese UUID de Periodo de forma manual"
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Boton
              onClick={handleCargarDatosDocente}
              disabled={loading || loadingData}
              className="gap-2"
              variant="default"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <User className="h-4 w-4" />
              )}
              Cargar datos de Docente
            </Boton>
          </div>
        </Card.Content>
      </Card>

      {/* Manejo de Errores */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-sm text-rose-800 dark:text-rose-300 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error al cargar datos</p>
            <p className="text-xs opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Datos del Docente Cargado */}
      {docenteActual && (
        <Card className="shadow-md border border-emerald-500/20 dark:border-emerald-500/10 bg-emerald-500/5">
          <Card.Content className="py-5 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle className="h-5 w-5" />
              <h2 className="font-bold text-base">Docente Seleccionado: {docenteActual.usuario?.nombre} {docenteActual.usuario?.apellidos}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-500 dark:text-slate-400">Código/IBM</p>
                <p className="font-bold text-gray-800 dark:text-slate-100">{docenteActual.codigo}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-500 dark:text-slate-400">DNI</p>
                <p className="font-bold text-gray-800 dark:text-slate-100">{docenteActual.dni}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-500 dark:text-slate-400">Categoría</p>
                <p className="font-bold text-gray-800 dark:text-slate-100">{docenteActual.categoria}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-500 dark:text-slate-400">Dedicación</p>
                <p className="font-bold text-gray-800 dark:text-slate-100">{docenteActual.dedicacion}</p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Botones de Descarga de PDFs */}
      <Card className="shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <Card.Header>
          <Card.Title className="text-base flex items-center gap-2">
            <Download className="h-5 w-5 text-primary-500" />
            Descarga de Documentos PDF Oficiales
          </Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Botón 1: Formato 1 */}
          <Boton
            onClick={() => handleDescargarReporte('carga')}
            disabled={loadingReporte.carga}
            variant="default"
            className="flex flex-col items-center justify-center p-6 h-auto gap-3 text-center border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-2xl shadow-sm transition-all duration-300"
          >
            {loadingReporte.carga ? (
              <RefreshCw className="h-8 w-8 animate-spin" />
            ) : (
              <FileText className="h-8 w-8" />
            )}
            <div className="space-y-1">
              <p className="font-bold text-sm">Formato N° 1</p>
              <p className="text-[10px] opacity-80">Carga Horaria Asignada</p>
            </div>
          </Boton>

          {/* Botón 2: DD.JJ. Central */}
          <Boton
            onClick={() => handleDescargarReporte('dj-central')}
            disabled={loadingReporte['dj-central']}
            variant="default"
            className="flex flex-col items-center justify-center p-6 h-auto gap-3 text-center border border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-800 dark:text-blue-300 rounded-2xl shadow-sm transition-all duration-300"
          >
            {loadingReporte['dj-central'] ? (
              <RefreshCw className="h-8 w-8 animate-spin" />
            ) : (
              <FileText className="h-8 w-8" />
            )}
            <div className="space-y-1">
              <p className="font-bold text-sm">Formato N° 2 (Central)</p>
              <p className="text-[10px] opacity-80">Declaración Jurada Central</p>
            </div>
          </Boton>

          {/* Botón 3: DD.JJ. Desconcentrada */}
          <Boton
            onClick={() => handleDescargarReporte('dj-desconcentrada')}
            disabled={loadingReporte['dj-desconcentrada']}
            variant="default"
            className="flex flex-col items-center justify-center p-6 h-auto gap-3 text-center border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-2xl shadow-sm transition-all duration-300"
          >
            {loadingReporte['dj-desconcentrada'] ? (
              <RefreshCw className="h-8 w-8 animate-spin" />
            ) : (
              <FileText className="h-8 w-8" />
            )}
            <div className="space-y-1">
              <p className="font-bold text-sm">Formato N° 2 (Filial)</p>
              <p className="text-[10px] opacity-80">Sedes Desconcentradas</p>
            </div>
          </Boton>
        </Card.Content>
      </Card>
    </div>
  );
}
