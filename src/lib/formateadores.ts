// Formateadores para diferentes tipos de datos

export class Formateadores {
  // Formatear nombre completo
  static nombreCompleto(nombre: string, apellidos: string): string {
    return `${nombre} ${apellidos}`;
  }

  // Formatear nombre de usuario para mostrar
  static nombreUsuario(usuario: { nombre: string; apellidos: string }): string {
    return `${usuario.apellidos}, ${usuario.nombre}`;
  }

  // Formatear créditos
  static creditos(creditos: number): string {
    return `${creditos} créd.`;
  }

  // Formatear horas
  static horas(horas: number): string {
    if (horas === 0) return '0h';
    if (horas < 10) return `${horas}h`;
    return `${horas}h`;
  }

  // Formatear capacidad
  static capacidad(capacidad: number): string {
    return `${capacidad} personas`;
  }

  // Formatear categoría de docente
  static categoriaDocente(categoria: string): string {
    const mapa: Record<string, string> = {
      'PRINCIPAL': 'Principal',
      'ASOCIADO': 'Asociado',
      'AUXILIAR': 'Auxiliar',
      'CONTRATADO': 'Contratado',
      'INVITADO': 'Invitado',
    };
    return mapa[categoria] || categoria;
  }

  // Formatear tipo de ambiente
  static tipoAmbiente(tipo: string): string {
    const mapa: Record<string, string> = {
      'AULA': 'Aula',
      'LABORATORIO': 'Laboratorio',
      'AUDITORIO': 'Auditorio',
      'SALA_CONFERENCIAS': 'Sala de Conferencias',
    };
    return mapa[tipo] || tipo;
  }

  // Formatear estado de horario
  static estadoHorario(estado: string): string {
    const mapa: Record<string, string> = {
      'BORRADOR': 'Borrador',
      'SELECCION_TEMPORAL': 'Selección Temporal',
      'CONFIRMADO': 'Confirmado',
      'PUBLICADO': 'Publicado',
      'CANCELADO': 'Cancelado',
    };
    return mapa[estado] || estado;
  }

  // Formatear estado de período
  static estadoPeriodo(estado: string): string {
    const mapa: Record<string, string> = {
      'BORRADOR': 'Borrador',
      'ACTIVO': 'Activo',
      'FINALIZADO': 'Finalizado',
      'ARCHIVADO': 'Archivado',
    };
    return mapa[estado] || estado;
  }

  // Formatear prioridad de notificación
  static prioridadNotificacion(prioridad: string): string {
    const mapa: Record<string, string> = {
      'BAJA': 'Baja',
      'MEDIA': 'Media',
      'ALTA': 'Alta',
      'URGENTE': 'Urgente',
    };
    return mapa[prioridad] || prioridad;
  }

  // Formatear canal de notificación
  static canalNotificacion(canal: string): string {
    const mapa: Record<string, string> = {
      'CORREO': 'Correo electrónico',
      'WHATSAPP': 'WhatsApp',
      'TELEGRAM': 'Telegram',
      'SISTEMA': 'Sistema',
    };
    return mapa[canal] || canal;
  }

  // Formatear rol de usuario
  static rolUsuario(rol: string): string {
    const mapa: Record<string, string> = {
      'SUPER_ADMIN': 'Super Administrador',
      'ADMINISTRADOR': 'Administrador',
      'OPERADOR': 'Operador',
      'DOCENTE': 'Docente',
      'MONITOR': 'Monitor',
    };
    return mapa[rol] || rol;
  }

  // Formatear ciclo académico
  static ciclo(ciclo: number): string {
    return `${ciclo}° Ciclo`;
  }

  // Formatear dirección de correo
  static email(email: string): string {
    return email.toLowerCase().trim();
  }

  // Formatear código de curso/docente
  static codigo(codigo: string): string {
    return codigo.toUpperCase().trim();
  }

  // Formatear color basado en estado
  static colorEstado(estado: string): string {
    const colores: Record<string, string> = {
      'BORRADOR': 'gray',
      'ACTIVO': 'green',
      'CONFIRMADO': 'blue',
      'PUBLICADO': 'purple',
      'CANCELADO': 'red',
      'FINALIZADO': 'orange',
      'PENDIENTE': 'yellow',
    };
    return colores[estado] || 'gray';
  }

  // Formatear dedicación de docente
  static dedicacionDocente(dedicacion: string): string {
    const mapa: Record<string, string> = {
      'TIEMPO_COMPLETO_40H': 'Tiempo Completo (40h)',
      'TIEMPO_PARCIAL_20H': 'Tiempo Parcial (20h)',
      'DEDICACION_EXCLUSIVA': 'Dedicación Exclusiva',
    };
    return mapa[dedicacion] || dedicacion;
  }

  // Formatear día de la semana
  static diaSemana(dia: string): string {
    const mapa: Record<string, string> = {
      'LUNES': 'Lunes',
      'MARTES': 'Martes',
      'MIERCOLES': 'Miércoles',
      'JUEVES': 'Jueves',
      'VIERNES': 'Viernes',
      'SABADO': 'Sábado',
      'DOMINGO': 'Domingo',
    };
    return mapa[dia.toUpperCase()] || dia;
  }
}