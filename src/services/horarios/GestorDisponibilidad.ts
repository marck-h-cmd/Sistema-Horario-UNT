import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { DiaSemana, TipoAmbiente, EstadoHorario } from '@prisma/client';

export interface DisponibilidadAmbiente {
  ambienteId: string;
  codigo: string;
  nombre: string;
  tipo: TipoAmbiente;
  horariosOcupados: HorarioOcupado[];
}

export interface HorarioOcupado {
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  cursoId?: string;
  cursoNombre?: string;
  docenteNombre?: string;
}

export interface MatrizDisponibilidad {
  ambientes: DisponibilidadAmbiente[];
  dias: DiaSemana[];
  franjasHorarias: string[];
}

export class GestorDisponibilidad {
  private readonly CACHE_TTL = 300; // 5 minutos

  async obtenerDisponibilidadAmbientes(
    periodoId: string,
    tipo?: TipoAmbiente,
    diaSemana?: DiaSemana
  ): Promise<DisponibilidadAmbiente[]> {
    const cacheKey = `disponibilidad:${periodoId}:${tipo || 'all'}:${diaSemana || 'all'}`;
    
    // Intentar obtener de caché
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Obtener ambientes con sus horarios ocupados
    const whereAmbiente: any = { activo: true };
    if (tipo) whereAmbiente.tipo = tipo;

    const ambientes = await prisma.ambiente.findMany({
      where: whereAmbiente,
      include: {
        horarios: {
          where: {
            periodoId,
            estado: { notIn: ['CANCELADO' as EstadoHorario] },
            ...(diaSemana && { diaSemana }),
          },
          include: {
            curso: { select: { nombre: true } },
            docente: {
              include: {
                usuario: { select: { nombre: true, apellidos: true } }
              }
            },
          },
        },
      },
    });

    const disponibilidad: DisponibilidadAmbiente[] = ambientes.map(ambiente => ({
      ambienteId: ambiente.id,
      codigo: ambiente.codigo,
      nombre: ambiente.nombre,
      tipo: ambiente.tipo,
      horariosOcupados: ambiente.horarios
        .filter(h => h.diaSemana !== null && h.horaInicio !== null && h.horaFin !== null)
        .map(h => ({
          diaSemana: h.diaSemana!,
          horaInicio: h.horaInicio!,
          horaFin: h.horaFin!,
          cursoId: h.cursoId,
          cursoNombre: h.curso.nombre,
          docenteNombre: `${h.docente.usuario.nombre} ${h.docente.usuario.apellidos}`,
        })),
    }));

    // Guardar en caché
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(disponibilidad));

    return disponibilidad;
  }

  async obtenerMatrizDisponibilidad(
    periodoId: string,
    tipo?: TipoAmbiente
  ): Promise<MatrizDisponibilidad> {
    const disponibilidad = await this.obtenerDisponibilidadAmbientes(periodoId, tipo);

    const dias: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    
    // Generar franjas horarias (ej: 08:00-09:00, 09:00-10:00, etc.)
    const franjasHorarias = this.generarFranjasHorarias('08:00', '20:00');

    return {
      ambientes: disponibilidad,
      dias,
      franjasHorarias,
    };
  }

  async limpiarCacheDisponibilidad(periodoId: string): Promise<void> {
    const keys = await redis.keys(`disponibilidad:${periodoId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private generarFranjasHorarias(inicio: string, fin: string): string[] {
    const franjas: string[] = [];
    let [hora, minuto] = inicio.split(':').map(Number);
    const [horaFin] = fin.split(':').map(Number);

    while (hora < horaFin) {
      const siguiente = hora + 1;
      franjas.push(
        `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}-${String(siguiente).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
      );
      hora = siguiente;
    }

    return franjas;
  }
}