export const Rol = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  SECRETARIA: 'SECRETARIA',
  DOCENTE: 'DOCENTE',
  OPERADOR: 'OPERADOR',
  COORDINADOR: 'COORDINADOR',
  ESTUDIANTE: 'ESTUDIANTE',
} as const;

export type Rol = (typeof Rol)[keyof typeof Rol];

export const CategoriaDocente = {
  PRINCIPAL: 'PRINCIPAL',
  ASOCIADO: 'ASOCIADO',
  AUXILIAR: 'AUXILIAR',
  CONTRATADO: 'CONTRATADO',
  INVITADO: 'INVITADO',
} as const;

export type CategoriaDocente = (typeof CategoriaDocente)[keyof typeof CategoriaDocente];

export const TipoAmbiente = {
  AULA: 'AULA',
  LABORATORIO: 'LABORATORIO',
  AUDITORIO: 'AUDITORIO',
  SALA_CONFERENCIAS: 'SALA_CONFERENCIAS',
} as const;

export type TipoAmbiente = (typeof TipoAmbiente)[keyof typeof TipoAmbiente];

export const DiaSemana = {
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIERCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SABADO',
  DOMINGO: 'DOMINGO',
} as const;

export type DiaSemana = (typeof DiaSemana)[keyof typeof DiaSemana];

export const EstadoPeriodo = {
  PLANIFICACION: 'PLANIFICACION',
  ACTIVO: 'ACTIVO',
  CERRADO: 'CERRADO',
  ARCHIVADO: 'ARCHIVADO',
} as const;

export type EstadoPeriodo = (typeof EstadoPeriodo)[keyof typeof EstadoPeriodo];