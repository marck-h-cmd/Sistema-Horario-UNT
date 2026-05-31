import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';

export interface SlotDisponible {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export function useDisponibilidad() {
  const [slots, setSlots] = useState<SlotDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verificar = useCallback(async (params: {
    docenteId?: string;
    ambienteId?: string;
    periodoId: string;
  }) => {
    setLoading(true);
    try {
      const res = await apiGet<SlotDisponible[]>('/api/disponibilidad', params);
      setSlots(res.data ?? []);
    } catch {
      setError('Error al verificar disponibilidad');
    } finally {
      setLoading(false);
    }
  }, []);

  const obtenerDisponibilidadDocente = useCallback(async (docenteId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<SlotDisponible[]>(`/api/docentes/${docenteId}/disponibilidad`, {});
      setSlots(res.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Error al obtener disponibilidad del docente');
    } finally {
      setLoading(false);
    }
  }, []);

  const guardarDisponibilidadDocente = useCallback(async (docenteId: string, nuevosSlots: SlotDisponible[]) => {
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/api/docentes/${docenteId}/disponibilidad`, { slots: nuevosSlots });
      setSlots(nuevosSlots);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al guardar disponibilidad');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { slots, loading, saving, error, verificar, obtenerDisponibilidadDocente, guardarDisponibilidadDocente };
}