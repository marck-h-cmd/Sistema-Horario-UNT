import { prisma } from '@/lib/prisma';
import { Formateadores } from '@/lib/formateadores';
import { GeneradorPDF, ReporteConfig } from './GeneradorPDF';
import {
  generarKpiGrid,
  generarSeccionTitulo,
  generarTablaHTML,
} from './reporte-estilos';

export type EntidadCatalogo =
  | 'docentes'
  | 'cursos'
  | 'ambientes'
  | 'periodos'
  | 'grupos'
  | 'carga-academica';

export interface OpcionesCatalogoPDF {
  periodoId?: string;
  registroId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  // filtros específicos por entidad
  categoria?: string;     // docentes
  departamento?: string;  // docentes
  ciclo?: number;         // cursos
  cursoId?: string;       // grupos, carga-academica
  docenteId?: string;     // carga-academica
}

const TITULOS: Record<EntidadCatalogo, string> = {
  docentes: 'Catálogo de Docentes',
  cursos: 'Catálogo de Cursos',
  ambientes: 'Catálogo de Ambientes',
  periodos: 'Catálogo de Períodos Académicos',
  grupos: 'Catálogo de Grupos',
  'carga-academica': 'Catálogo de Carga Académica',
};

export class ReporteCatalogoService {
  private generadorPDF = new GeneradorPDF();

  async generar(entidad: EntidadCatalogo, opciones?: OpcionesCatalogoPDF): Promise<Buffer> {
    const { periodoId, registroId, fechaDesde, fechaHasta, categoria, departamento, ciclo, cursoId, docenteId } = opciones ?? {};

    const periodo = periodoId
      ? await prisma.periodoAcademico.findUnique({ where: { id: periodoId } })
      : null;

    let contenido = '';
    let subtituloDetalle = 'Listado administrativo del sistema';

    switch (entidad) {
      case 'docentes': {
        const r = await this.contenidoDocentes(registroId, fechaDesde, fechaHasta, categoria, departamento);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      case 'cursos': {
        const r = await this.contenidoCursos(registroId, fechaDesde, fechaHasta, ciclo);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      case 'ambientes': {
        const r = await this.contenidoAmbientes(registroId, fechaDesde, fechaHasta);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      case 'periodos': {
        const r = await this.contenidoPeriodos(registroId, fechaDesde, fechaHasta);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      case 'grupos': {
        const r = await this.contenidoGrupos(registroId, fechaDesde, fechaHasta, cursoId, periodoId);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      case 'carga-academica': {
        const r = await this.contenidoCargaAcademica(registroId, fechaDesde, fechaHasta, docenteId, cursoId);
        contenido = r.html;
        subtituloDetalle = r.subtitulo;
        break;
      }
      default:
        throw new Error('Entidad de catálogo no válida');
    }

    if (fechaDesde || fechaHasta) {
      const fmt = (d?: Date) => (d ? d.toLocaleDateString('es-PE') : '—');
      subtituloDetalle += ` · Rango: ${fmt(fechaDesde)} a ${fmt(fechaHasta)}`;
    }

    const html = this.generadorPDF.generarDocumento(TITULOS[entidad], contenido, {
      periodo: periodo?.nombre,
      subtitulo: subtituloDetalle,
    });

    const config: ReporteConfig = {
      titulo: TITULOS[entidad],
      orientacion: entidad === 'carga-academica' || entidad === 'grupos' ? 'landscape' : 'portrait',
      formato: 'A4',
    };

    return this.generadorPDF.generarPDF(html, config);
  }

  private validarEncontrado<T>(items: T[], registroId?: string, etiqueta = 'Registro') {
    if (registroId && items.length === 0) {
      throw new Error(`${etiqueta} no encontrado`);
    }
  }

  private rangoFechas(fechaDesde?: Date, fechaHasta?: Date) {
    if (!fechaDesde && !fechaHasta) return undefined;
    const filtro: { gte?: Date; lte?: Date } = {};
    if (fechaDesde) filtro.gte = fechaDesde;
    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      filtro.lte = hasta;
    }
    return filtro;
  }

  private async contenidoDocentes(registroId?: string, fechaDesde?: Date, fechaHasta?: Date, categoria?: string, departamento?: string) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    if (categoria) where.categoria = categoria;
    if (departamento) where.departamento = { contains: departamento, mode: 'insensitive' };
    const docentes = await prisma.docente.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        usuario: { select: { nombre: true, apellidos: true, email: true, activo: true } },
        _count: { select: { cursos: true, horarios: true } },
      },
      orderBy: { codigo: 'asc' },
    });
    this.validarEncontrado(docentes, registroId, 'Docente');

    const activos = docentes.filter((d) => d.usuario.activo).length;
    const partes: string[] = [];
    if (registroId) partes.push(`${docentes[0]?.codigo} — ${Formateadores.nombreUsuario(docentes[0]?.usuario)}`);
    else partes.push(`Listado (${docentes.length} docentes)`);
    if (categoria) partes.push(`Categoría: ${Formateadores.categoriaDocente(categoria)}`);
    if (departamento) partes.push(`Depto: ${departamento}`);
    const subtitulo = partes.join(' · ');

    const kpis = generarKpiGrid([
      { label: 'Registros', value: docentes.length },
      { label: 'Activos', value: activos },
      { label: 'Inactivos', value: docentes.length - activos },
    ]);

    const filas = docentes.map((d) => [
      d.codigo,
      Formateadores.nombreUsuario(d.usuario),
      d.usuario.email,
      Formateadores.categoriaDocente(d.categoria),
      d.departamento ?? '—',
      d._count.cursos.toString(),
      d.usuario.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(registroId ? 'Ficha del docente' : 'Detalle de docentes') +
        generarTablaHTML(
          ['Código', 'Nombre', 'Email', 'Categoría', 'Departamento', 'Cursos asig.', 'Activo'],
          filas
        ),
    };
  }

  private async contenidoCursos(registroId?: string, fechaDesde?: Date, fechaHasta?: Date, ciclo?: number) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    if (ciclo && ciclo > 0) where.ciclo = ciclo;
    const cursos = await prisma.curso.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { grupos: true, cursosDocente: true } } },
      orderBy: [{ ciclo: 'asc' }, { codigo: 'asc' }],
    });
    this.validarEncontrado(cursos, registroId, 'Curso');

    const activos = cursos.filter((c) => c.activo).length;
    const totalCreditos = cursos.reduce((s, c) => s + c.creditos, 0);
    const partes: string[] = [];
    if (registroId) partes.push(`${cursos[0]?.codigo} — ${cursos[0]?.nombre}`);
    else partes.push(`Listado (${cursos.length} cursos)`);
    if (ciclo && ciclo > 0) partes.push(`Ciclo ${ciclo}`);
    const subtitulo = partes.join(' · ');

    const kpis = generarKpiGrid([
      { label: 'Registros', value: cursos.length },
      { label: 'Activos', value: activos },
      { label: 'Créditos (suma)', value: totalCreditos },
    ]);

    const filas = cursos.map((c) => [
      c.codigo,
      c.nombre,
      c.ciclo.toString(),
      c.creditos.toString(),
      `${c.horasTeoria}T / ${c.horasPractica}P / ${c.horasLaboratorio}L`,
      c._count.grupos.toString(),
      c._count.cursosDocente.toString(),
      c.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(registroId ? 'Ficha del curso' : 'Detalle de cursos') +
        generarTablaHTML(
          ['Código', 'Nombre', 'Ciclo', 'Créd.', 'Horas', 'Grupos', 'Docentes', 'Activo'],
          filas
        ),
    };
  }

  private async contenidoAmbientes(registroId?: string, fechaDesde?: Date, fechaHasta?: Date) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    const ambientes = await prisma.ambiente.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { horarios: true } } },
      orderBy: { codigo: 'asc' },
    });
    this.validarEncontrado(ambientes, registroId, 'Ambiente');

    const activos = ambientes.filter((a) => a.activo).length;
    const labs = ambientes.filter((a) => a.tipo === 'LABORATORIO').length;
    const subtitulo = registroId
      ? `${ambientes[0].codigo} — ${ambientes[0].nombre}`
      : `Listado completo (${ambientes.length} ambientes)`;

    const kpis = generarKpiGrid([
      { label: 'Registros', value: ambientes.length },
      { label: 'Activos', value: activos },
      { label: 'Laboratorios', value: labs },
    ]);

    const filas = ambientes.map((a) => [
      a.codigo,
      a.nombre,
      Formateadores.tipoAmbiente(a.tipo),
      Formateadores.capacidad(a.capacidad),
      a.ubicacion ?? '—',
      a._count.horarios.toString(),
      a.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(registroId ? 'Ficha del ambiente' : 'Detalle de ambientes') +
        generarTablaHTML(
          ['Código', 'Nombre', 'Tipo', 'Capacidad', 'Ubicación', 'Horarios', 'Activo'],
          filas
        ),
    };
  }

  private async contenidoPeriodos(registroId?: string, fechaDesde?: Date, fechaHasta?: Date) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    const periodos = await prisma.periodoAcademico.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { horarios: true, ventanas: true } } },
      orderBy: { fechaInicio: 'desc' },
    });
    this.validarEncontrado(periodos, registroId, 'Período');

    const activo = periodos.filter((p) => p.activo).length;
    const subtitulo = registroId
      ? periodos[0].nombre
      : `Listado completo (${periodos.length} períodos)`;

    const kpis = generarKpiGrid([
      { label: 'Registros', value: periodos.length },
      { label: 'Marcados activos', value: activo },
      {
        label: 'Horarios registrados',
        value: periodos.reduce((s, p) => s + p._count.horarios, 0),
      },
    ]);

    const filas = periodos.map((p) => [
      p.nombre,
      new Date(p.fechaInicio).toLocaleDateString('es-PE'),
      new Date(p.fechaFin).toLocaleDateString('es-PE'),
      Formateadores.estadoPeriodo(p.estado),
      p._count.horarios.toString(),
      p._count.ventanas.toString(),
      p.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(registroId ? 'Ficha del período' : 'Detalle de períodos') +
        generarTablaHTML(
          ['Nombre', 'Inicio', 'Fin', 'Estado', 'Horarios', 'Ventanas', 'Activo'],
          filas
        ),
    };
  }

  private async contenidoGrupos(registroId?: string, fechaDesde?: Date, fechaHasta?: Date, cursoId?: string, periodoId?: string) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    if (cursoId) where.cursoId = cursoId;
    if (periodoId) where.horarios = { some: { periodoId } };
    const grupos = await prisma.grupo.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        curso: { select: { codigo: true, nombre: true, ciclo: true } },
        _count: { select: { horarios: true, matriculas: true } },
      },
      orderBy: [{ curso: { codigo: 'asc' } }, { nombre: 'asc' }],
    });
    this.validarEncontrado(grupos, registroId, 'Grupo');

    const activos = grupos.filter((g) => g.activo).length;
    const partes: string[] = [];
    if (registroId) partes.push(`${grupos[0]?.curso.codigo} — Grupo ${grupos[0]?.nombre}`);
    else partes.push(`Listado (${grupos.length} grupos)`);
    if (cursoId && grupos.length > 0) partes.push(`Curso: ${grupos[0].curso.nombre}`);
    const subtitulo = partes.join(' · ');

    const kpis = generarKpiGrid([
      { label: 'Registros', value: grupos.length },
      { label: 'Activos', value: activos },
      {
        label: 'Capacidad total',
        value: grupos.reduce((s, g) => s + g.capacidad, 0),
      },
    ]);

    const filas = grupos.map((g) => [
      g.curso.codigo,
      g.curso.nombre,
      g.curso.ciclo.toString(),
      g.nombre,
      g.capacidad.toString(),
      g._count.horarios.toString(),
      g._count.matriculas.toString(),
      g.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(registroId ? 'Ficha del grupo' : 'Detalle de grupos') +
        generarTablaHTML(
          ['Curso', 'Asignatura', 'Ciclo', 'Grupo', 'Capacidad', 'Horarios', 'Matrículas', 'Activo'],
          filas
        ),
    };
  }

  private async contenidoCargaAcademica(registroId?: string, fechaDesde?: Date, fechaHasta?: Date, docenteId?: string, cursoId?: string) {
    const createdAt = this.rangoFechas(fechaDesde, fechaHasta);
    const where: Record<string, unknown> = {};
    if (registroId) where.id = registroId;
    if (createdAt) where.createdAt = createdAt;
    if (docenteId) where.docenteId = docenteId;
    if (cursoId) where.cursoId = cursoId;
    const asignaciones = await prisma.cursoDocente.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        curso: { select: { codigo: true, nombre: true, creditos: true, ciclo: true } },
        docente: {
          select: {
            codigo: true,
            usuario: { select: { nombre: true, apellidos: true } },
          },
        },
      },
      orderBy: [{ docente: { codigo: 'asc' } }, { curso: { codigo: 'asc' } }],
    });
    this.validarEncontrado(asignaciones, registroId, 'Asignación');

    const activas = asignaciones.filter((a) => a.activo).length;
    const totalHoras = asignaciones.reduce((s, a) => s + a.horasAsignadas, 0);
    const partes: string[] = [];
    if (registroId) partes.push(`${asignaciones[0]?.docente.codigo} → ${asignaciones[0]?.curso.codigo}`);
    else partes.push(`Listado (${asignaciones.length} asignaciones)`);
    if (docenteId && asignaciones.length > 0) partes.push(`Docente: ${Formateadores.nombreUsuario(asignaciones[0].docente.usuario)}`);
    if (cursoId && asignaciones.length > 0) partes.push(`Curso: ${asignaciones[0].curso.nombre}`);
    const subtitulo = partes.join(' · ');

    const kpis = generarKpiGrid([
      { label: 'Registros', value: asignaciones.length },
      { label: 'Activas', value: activas },
      { label: 'Horas asignadas', value: totalHoras },
    ]);

    const filas = asignaciones.map((a) => [
      a.docente.codigo,
      Formateadores.nombreUsuario(a.docente.usuario),
      a.curso.codigo,
      a.curso.nombre,
      a.curso.ciclo.toString(),
      a.curso.creditos.toString(),
      a.horasAsignadas.toString(),
      a.activo ? 'Sí' : 'No',
    ]);

    return {
      subtitulo,
      html:
        kpis +
        generarSeccionTitulo(
          registroId ? 'Ficha de asignación' : 'Asignaciones curso — docente'
        ) +
        generarTablaHTML(
          [
            'Cód. docente',
            'Docente',
            'Cód. curso',
            'Curso',
            'Ciclo',
            'Créd.',
            'Horas asig.',
            'Activo',
          ],
          filas
        ),
    };
  }
}
