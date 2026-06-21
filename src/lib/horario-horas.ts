import { HORARIOS } from '@/lib/constantes';

/** Última hora permitida para fin de clase (21:00 = 9:00 p.m.) */
export const HORA_LIMITE_FIN_CLASES = HORARIOS.HORA_LIMITE_FIN_CLASES;

export function calcularHorasEntre(horaInicio: string, horaFin: string): number {
  if (!horaInicio || !horaFin) return 0;
  const [hiH, hiM] = horaInicio.split(':').map(Number);
  const [hfH, hfM] = horaFin.split(':').map(Number);
  if (Number.isNaN(hiH) || Number.isNaN(hiM) || Number.isNaN(hfH) || Number.isNaN(hfM)) return 0;
  return hfH + hfM / 60 - (hiH + hiM / 60);
}

export function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * No se programan clases después de las 21:00.
 * - La hora de inicio debe ser estrictamente anterior a 21:00.
 * - La hora de fin no puede ser posterior a 21:00.
 */
export function validarFranjaHorariaPermitida(
  horaInicio: string,
  horaFin: string
): { valido: boolean; mensaje?: string } {
  const inicio = minutosDesdeMedianoche(horaInicio);
  const fin = minutosDesdeMedianoche(horaFin);
  const limite = minutosDesdeMedianoche(HORA_LIMITE_FIN_CLASES);

  if (inicio >= limite) {
    return {
      valido: false,
      mensaje: `No hay clases después de las ${HORA_LIMITE_FIN_CLASES}. La hora de inicio debe ser anterior a las 21:00.`,
    };
  }

  if (fin > limite) {
    return {
      valido: false,
      mensaje: `La hora de fin no puede ser posterior a las ${HORA_LIMITE_FIN_CLASES} (9:00 p.m.).`,
    };
  }

  if (inicio >= fin) {
    return {
      valido: false,
      mensaje: 'La hora de fin debe ser posterior a la hora de inicio.',
    };
  }

  return { valido: true };
}
