import { prisma } from '@/lib/prisma';
import { ImportadorCSV } from '@/lib/importadorCSV';
import { ServicioCurso } from './ServicioCurso';

export interface ResultadoImportacionCursos {
  exitosos: number;
  fallidos: number;
  errores: { fila: number; mensaje: string }[];
  cursosCreados: any[];
}

export class ImportadorCursos {
  private servicioCurso: ServicioCurso;
  private readonly COLUMNAS_REQUERIDAS = [
    'codigo',
    'nombre',
    'creditos',
    'horasTeoria',
    'horasPractica',
    'horasLaboratorio',
    'ciclo',
  ];

  constructor() {
    this.servicioCurso = new ServicioCurso();
  }

  async importarDesdeCSV(
    contenido: string,
    sobrescribir: boolean = false
  ): Promise<ResultadoImportacionCursos> {
    const resultado: ResultadoImportacionCursos = {
      exitosos: 0,
      fallidos: 0,
      errores: [],
      cursosCreados: [],
    };

    try {
      const { headers, datos } = ImportadorCSV.parsearCSV(contenido);

      const faltantes = ImportadorCSV.validarColumnasRequeridas(
        headers,
        this.COLUMNAS_REQUERIDAS
      );

      if (faltantes.length > 0) {
        throw new Error(`Columnas faltantes: ${faltantes.join(', ')}`);
      }

      for (let i = 0; i < datos.length; i++) {
        const fila = datos[i];
        const numeroFila = i + 2;

        try {
          await this.procesarFila(fila, numeroFila, resultado, sobrescribir);
        } catch (error: any) {
          resultado.fallidos++;
          resultado.errores.push({
            fila: numeroFila,
            mensaje: error.message || 'Error desconocido',
          });
        }
      }
    } catch (error: any) {
      throw new Error(`Error al procesar archivo: ${error.message}`);
    }

    return resultado;
  }

  private async procesarFila(
    fila: any,
    numeroFila: number,
    resultado: ResultadoImportacionCursos,
    sobrescribir: boolean
  ): Promise<void> {
    const codigo = fila.codigo?.trim();
    const nombre = fila.nombre?.trim();
    const creditos = parseInt(fila.creditos);
    const horasTeoria = parseInt(fila.horasTeoria) || 0;
    const horasPractica = parseInt(fila.horasPractica) || 0;
    const horasLaboratorio = parseInt(fila.horasLaboratorio) || 0;
    const ciclo = parseInt(fila.ciclo);
    const tipoCurso = fila.tipoCurso?.trim() || 'OB';

    if (!codigo || !nombre || isNaN(creditos) || isNaN(ciclo)) {
      throw new Error('Faltan datos requeridos (código, nombre, créditos, ciclo)');
    }

    const existente = await prisma.curso.findUnique({ where: { codigo } });

    if (existente) {
      if (sobrescribir) {
        await this.servicioCurso.actualizar(existente.id, {
          nombre,
          creditos,
          horasTeoria,
          horasPractica,
          horasLaboratorio,
          ciclo,
          tipoCurso,
        });
        resultado.exitosos++;
        return;
      }
      throw new Error(`Ya existe un curso con código ${codigo}`);
    }

    const curso = await this.servicioCurso.crear({
      codigo,
      nombre,
      creditos,
      horasTeoria,
      horasPractica,
      horasLaboratorio,
      ciclo,
      tipoCurso,
    });

    resultado.exitosos++;
    resultado.cursosCreados.push(curso);
  }
}
