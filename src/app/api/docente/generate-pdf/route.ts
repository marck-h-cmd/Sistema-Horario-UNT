import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

// Importar los componentes PDF
import { FormatoCargaHoraria } from '@/components/pdf/FormatoCargaHoraria';
import { DeclaracionJuradaCentral } from '@/components/pdf/DeclaracionJuradaCentral';
import { DeclaracionJuradaDesconcentrada } from '@/components/pdf/DeclaracionJuradaDesconcentrada';
import { FormatoHorarioSemanal } from '@/components/pdf/FormatoHorarioSemanal';
import { FormatoCargaFiliales } from '@/components/pdf/FormatoCargaFiliales';
import { TipoActividadNoLectiva } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo, docenteId, periodoId } = body;

    const validTipos = ['carga', 'dj-central', 'dj-desconcentrada', 'horario', 'filiales'];
    if (!tipo || !docenteId || !periodoId || !validTipos.includes(tipo)) {
      return NextResponse.json(
        { success: false, message: 'Faltan parámetros requeridos: tipo, docenteId, periodoId o tipo inválido' },
        { status: 400 }
      );
    }

    // 1. Consultar Docente con relaciones existentes
    const docenteDb = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: {
        usuario: true,
        departamento: {
          include: {
            facultad: true,
          },
        },
        cargos: { where: { activo: true } },
        becas: { where: { activo: true } },
        comisiones: { where: { activo: true } },
      },
    });

    if (!docenteDb) {
      return NextResponse.json(
        { success: false, message: `Docente con ID ${docenteId} no encontrado` },
        { status: 404 }
      );
    }

    // 2. Consultar Periodo Académico
    const periodoDb = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodoDb) {
      return NextResponse.json(
        { success: false, message: `Periodo académico con ID ${periodoId} no encontrado` },
        { status: 404 }
      );
    }

    // Adaptar metadatos del docente
    const dedicacionHoras = docenteDb.dedicacion === 'TIEMPO_PARCIAL_20H' ? 20 : 40;
    const modalidadText = docenteDb.dedicacion === 'TIEMPO_COMPLETO_40H'
      ? 'Tiempo Completo'
      : docenteDb.dedicacion === 'DEDICACION_EXCLUSIVA'
      ? 'Dedicación Exclusiva'
      : 'Tiempo Parcial';

    const condicionText = docenteDb.categoria === 'CONTRATADO' || docenteDb.categoria === 'INVITADO'
      ? 'Contratado'
      : 'Nombrado';

    const docenteAdaptado = {
      nombres: docenteDb.usuario.nombre,
      apellidos: docenteDb.usuario.apellidos,
      dni: docenteDb.dni,
      codigoIBM: docenteDb.codigo, // Se usa el código como IBM
      departamento: docenteDb.departamento.nombre,
      facultad: docenteDb.departamento.facultad.nombre,
      condicion: condicionText,
      categoria: docenteDb.categoria.toString(),
      modalidad: modalidadText,
      dedicacion_horas: dedicacionHoras,
    };

    // Adaptar metadatos del periodo
    const periodoAdaptado = {
      anio: new Date(periodoDb.fechaInicio).getFullYear().toString(),
      ciclo: periodoDb.nombre.includes('II') ? 'II' : 'I',
      fecha_inicio: new Date(periodoDb.fechaInicio).toLocaleDateString('es-PE'),
      fecha_fin: new Date(periodoDb.fechaFin).toLocaleDateString('es-PE'),
    };
    
    const fechaActual = new Date().toLocaleDateString('es-PE');

    // 3. Consultar horarios asignados (activos y no cancelados)
    const horariosDb = await prisma.horario.findMany({
      where: {
        cursoDocenteGrupo: { cursoDocente: { docenteId } },
        periodoId,
        estado: { not: 'CANCELADO' },
      },
      include: {
        cursoDocenteGrupo: {
          include: {
            grupo: true,
            cursoDocente: {
              include: { planEstudioCurso: { include: { curso: true } } }
            }
          }
        },
        ambiente: true,
      },
    }) as any[];

    // Agrupar horarios por curso y grupo para calcular carga lectiva
    const parseTime = (t: string) => {
      const parts = t.split(':');
      return parseInt(parts[0]) + (parseInt(parts[1] || '0') / 60);
    };

    const hashCursos: Record<string, any> = {};
    horariosDb.forEach((h) => {
      const pc = h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso;
      const key = `${pc?.curso?.id}-${h.cursoDocenteGrupo?.grupoId || 'sin-grupo'}`;
      const duracion = h.horaInicio && h.horaFin ? parseTime(h.horaFin) - parseTime(h.horaInicio) : 2;

      if (!hashCursos[key]) {
        hashCursos[key] = {
          codigo: pc?.curso?.codigo,
          nombre: pc?.curso?.nombre,
          escuela: docenteAdaptado.departamento,
          ciclo: pc?.ciclo,
          seccion: h.cursoDocenteGrupo?.grupo?.nombre || 'A',
          n_alumnos: h.cursoDocenteGrupo?.capacidad || 35,
          horas_teoria: 0,
          horas_practica: 0,
          horas_laboratorio: 0,
        };
      }

      if (h.tipoComponente === 'TEORIA') {
        hashCursos[key].horas_teoria += duracion;
      } else if (h.tipoComponente === 'PRACTICA') {
        hashCursos[key].horas_practica += duracion;
      } else if (h.tipoComponente === 'LABORATORIO') {
        hashCursos[key].horas_laboratorio += duracion;
      }
    });

    let cargaLectivaList = Object.values(hashCursos);

    // 4. Consultar Carga No Lectiva
    const noLectivaDb = await prisma.declaracionNoLectiva.findUnique({
      where: {
        docenteId_periodoId: { docenteId, periodoId },
      },
      include: {
        items: true,
      },
    });

    const MAP_TIPO_ACTIVIDAD: Record<string, string> = {
      PREPARACION_Y_EVALUACION: 'Preparación y Evaluación de Clases',
      CONSEJERIA: 'Tutoría y Consejería a Estudiantes',
      INVESTIGACION: 'Investigación Científica',
      CAPACITACION: 'Capacitación y Perfeccionamiento Docente',
      ACTIVIDADES_DE_GOBIERNO: 'Actividades de Gobierno Universitario',
      ACTIVIDADES_DE_ADMINISTRACION: 'Actividades de Administración Académica',
      ASESORIA_DE_TESIS: 'Asesoría de Proyectos de Tesis',
      RESPONSABILIDAD_SOCIAL_UNIVERSITARIA: 'Responsabilidad Social Universitaria (RSU)',
      COMITES_TECNICOS_Y_COMISIONES: 'Comités Técnicos y Comisiones Oficiales',
    };

    let cargaNoLectivaList: any[] = [];
    if (noLectivaDb) {
      cargaNoLectivaList = noLectivaDb.items.map((item) => ({
        tipoActividad: item.tipoActividad,
        horasSemanales: item.horasSemanales,
        descripcion: item.descripcion || '',
      }));
    } else {
      // Valores por defecto para rellenar el formato si no tiene declaración
      cargaNoLectivaList = [
        { tipoActividad: 'PREPARACION_Y_EVALUACION', horasSemanales: 0 },
        { tipoActividad: 'CONSEJERIA', horasSemanales: 0 },
      ];
    }

    // 5. Consultar Comisión de Servicio
    const comisionDb = docenteDb.comisiones[0];
    const comisionAdaptada = comisionDb
      ? {
          activa: true,
          sedeDestino: comisionDb.sedeDestino.toString(),
          fechaInicio: new Date(comisionDb.fechaInicio).toLocaleDateString('es-PE'),
          fechaFin: new Date(comisionDb.fechaFin).toLocaleDateString('es-PE'),
          resolucion: comisionDb.licenciaDocumento,
        }
      : null;

    // APLICAR REGLAS DE NEGOCIO Y NOTAS DE VALIDACIÓN
    let notaValidacion = '';

    // A. Beca de Estudio Activa (Carga lectiva = 0)
    const tieneBecaActiva = docenteDb.becas.length > 0;
    if (tieneBecaActiva) {
      // Forzar carga lectiva visualmente a 0
      cargaLectivaList = [];
      notaValidacion = 'Docente con beca de estudio activa - carga lectiva 0 horas según reglamento de becas.';
    }

    // Calcular totales de horas
    const totalLectivas = cargaLectivaList.reduce(
      (acc, c) => acc + (c.horas_teoria + c.horas_practica + c.horas_laboratorio),
      0
    );
    const totalNoLectivas = cargaNoLectivaList.reduce((acc, n) => acc + n.horasSemanales, 0);

    // B. Validación Preparación y Evaluación (<= 50% de lectivas)
    const itemPrep = noLectivaDb?.items.find((i) => i.tipoActividad === TipoActividadNoLectiva.PREPARACION_Y_EVALUACION);
    if (itemPrep && totalLectivas > 0) {
      const limitePrep = totalLectivas * 0.5;
      if (itemPrep.horasSemanales > limitePrep) {
        notaValidacion = 'Advertencia: Las horas de Preparación y Evaluación superan el 50% de la carga lectiva (máximo permitido).';
      }
    }

    // C. Cargo Administrativo límites (Cargo mayor <= 8h, otros <= 12h)
    const tieneCargoActivo = docenteDb.cargos.length > 0;
    if (tieneCargoActivo) {
      const cargo = docenteDb.cargos[0];
      const esCargoMayor = ['DECANO', 'DIRECTOR_DE_ESCUELA', 'DIRECTOR_DE_POSTGRADO', 'JEFE_DE_DEPARTAMENTO'].includes(
        cargo.tipoCargo.toString()
      );
      const limiteCargo = esCargoMayor ? 8 : 12;

      if (totalLectivas > limiteCargo) {
        notaValidacion = `Advertencia: Las horas lectivas asignadas (${totalLectivas}h) superan el límite permitido de ${limiteCargo}h para el cargo de ${cargo.tipoCargo}.`;
      }
    }

    // D. Alerta si la suma no coincide con la dedicación
    if (!notaValidacion && totalLectivas + totalNoLectivas !== dedicacionHoras) {
      notaValidacion = `Advertencia: La suma de horas (${totalLectivas}h lectivas + ${totalNoLectivas}h no lectivas = ${
        totalLectivas + totalNoLectivas
      }h) no coincide con su dedicación (${dedicacionHoras}h).`;
    }

    // 6. Generar e iniciar Renderizado del PDF a Buffer según el tipo
    let pdfElement: React.ReactElement;
    if (tipo === 'carga') {
      pdfElement = React.createElement(FormatoCargaHoraria, {
        docente: docenteAdaptado,
        periodo: periodoAdaptado,
        cargaLectiva: cargaLectivaList,
        cargaNoLectiva: cargaNoLectivaList,
        notaValidacion: notaValidacion || undefined,
      });
    } else if (tipo === 'dj-central') {
      pdfElement = React.createElement(DeclaracionJuradaCentral, {
        docente: docenteAdaptado,
        periodo: periodoAdaptado,
      });
    } else if (tipo === 'dj-desconcentrada') {
      pdfElement = React.createElement(DeclaracionJuradaDesconcentrada, {
        docente: docenteAdaptado,
        periodo: periodoAdaptado,
        comisionServicio: comisionAdaptada,
      });
    } else if (tipo === 'horario') {
      // Formateo de horarios para el F03-CAD
      const formatDia = (d: string) => d.substring(0, 2).toUpperCase();
      
      const cargaLectivaHorarioList = Object.values(hashCursos).map((curso: any) => {
        // Encontrar horarios correspondientes a este curso/grupo
        const hs = (horariosDb as any[]).filter(h => h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.codigo === curso.codigo && (h.cursoDocenteGrupo?.grupo?.nombre || 'A') === curso.seccion);
        
        const hTeoria = hs.filter(h => h.tipoComponente === 'TEORIA');
        const hPractica = hs.filter(h => h.tipoComponente === 'PRACTICA');
        const hLab = hs.filter(h => h.tipoComponente === 'LABORATORIO');
        
        let horarioStr = '';
        if (hTeoria.length > 0) {
          horarioStr += 'T: ' + hTeoria.map(h => `${formatDia(h.diaSemana || '')}(${h.horaInicio}-${h.horaFin})`).join(', ') + '\n';
        }
        if (hPractica.length > 0) {
          horarioStr += 'P: ' + hPractica.map(h => `${formatDia(h.diaSemana || '')}(${h.horaInicio}-${h.horaFin})`).join(', ') + '\n';
        }
        if (hLab.length > 0) {
          horarioStr += 'L: ' + hLab.map(h => `${formatDia(h.diaSemana || '')}(${h.horaInicio}-${h.horaFin})`).join(', ') + '\n';
        }
        
        const lugares = Array.from(new Set(hs.map(h => h.ambiente?.codigo || 'F11'))).join(', ');
        const aulas = Array.from(new Set(hs.map(h => h.ambiente?.nombre || 'PD'))).join(', ');
        
        return {
          horarioStr: horarioStr.trim(),
          asignatura: `${curso.nombre}\n${curso.ciclo}-C ${curso.escuela} ${curso.seccion}`,
          lugar: lugares || 'F11',
          aula: aulas || 'PD',
          total: curso.horas_teoria + curso.horas_practica + curso.horas_laboratorio,
          horasTeoria: curso.horas_teoria,
          horasPractica: curso.horas_practica,
          horasLaboratorio: curso.horas_laboratorio,
        };
      });

      // Distribucion para No Lectivas
      const distribucionesDb = await prisma.distribucionNoLectiva.findMany({
        where: { docenteId, periodoId },
        include: { declaracionItem: true },
      });

      const cargaNoLectivaHorarioList = cargaNoLectivaList.map(n => {
        // Find matching item in db
        const matchingItem = noLectivaDb?.items.find(i => i.tipoActividad === n.tipoActividad);
        
        let horarioStr = '';
        if (matchingItem) {
          const dists = distribucionesDb.filter(d => d.declaracionItemId === matchingItem.id);
          horarioStr = dists.map(d => `${formatDia(d.diaSemana)}(${d.horaInicio}-${d.horaFin})`).join(', ');
        }
        
        return {
          actividadId: matchingItem?.tipoActividad || 'OTRO',
          actividadNombre: MAP_TIPO_ACTIVIDAD[n.tipoActividad] || n.tipoActividad,
          horarioStr: horarioStr,
          lugar: 'F11',
          aula: 'CUBÍCULO',
          total: n.horasSemanales,
        };
      });

      pdfElement = React.createElement(FormatoHorarioSemanal, {
        docente: {
          dni: docenteDb.dni || 'N/A',
          nombreCompleto: `${docenteDb.usuario.nombre} ${docenteDb.usuario.apellidos}`,
          departamento: docenteAdaptado.departamento,
          facultad: docenteAdaptado.facultad,
          categoriaDedicacion: `${docenteAdaptado.categoria} - ${docenteAdaptado.dedicacion_horas}HS`,
          email: docenteDb.usuario.email || undefined,
        },
        periodo: {
          anio: periodoAdaptado.anio,
          ciclo: periodoAdaptado.ciclo,
          fechaInicio: periodoAdaptado.fecha_inicio,
          fechaFin: periodoAdaptado.fecha_fin,
        },
        cargaLectiva: cargaLectivaHorarioList,
        cargaNoLectiva: cargaNoLectivaHorarioList,
        totalHoras: totalLectivas + totalNoLectivas,
        fechaRegistro: fechaActual,
      });
    } else if (tipo === 'filiales') {
      // Mapear carga de cursos para filiales
      const formatDia = (d: string) => d.substring(0, 2).toUpperCase();
      const cursosFiliales = Object.values(hashCursos).map((curso: any) => {
        const hs = (horariosDb as any[]).filter(h => h.cursoDocenteGrupo?.cursoDocente?.planEstudioCurso?.curso?.codigo === curso.codigo && (h.cursoDocenteGrupo?.grupo?.nombre || 'A') === curso.seccion);
        
        let horarioStr = '';
        hs.forEach(h => {
          horarioStr += `${formatDia(h.diaSemana || '')} ${h.horaInicio}-${h.horaFin} `;
        });

        return {
          curso: curso.nombre,
          dependencia: docenteAdaptado.facultad,
          fechaInicio: periodoAdaptado.fecha_inicio,
          fechaFin: periodoAdaptado.fecha_fin,
          horarioSemanal: horarioStr.trim(),
          totalHoras: `${curso.horas_teoria + curso.horas_practica + curso.horas_laboratorio} HORAS`
        };
      });

      pdfElement = React.createElement(FormatoCargaFiliales, {
        docente: {
          nombresApellidos: `${docenteDb.usuario.nombre} ${docenteDb.usuario.apellidos}`,
          codigo: docenteDb.codigo || docenteDb.id,
          condicion: docenteAdaptado.condicion,
          categoria: docenteAdaptado.categoria,
          modalidad: docenteAdaptado.modalidad || 'TC',
          horasTp: docenteAdaptado.dedicacion_horas,
          facultad: docenteAdaptado.facultad,
          departamento: docenteAdaptado.departamento,
        },
        periodo: {
          anio: periodoAdaptado.anio,
          semestre: periodoAdaptado.ciclo,
          inicio: periodoAdaptado.fecha_inicio,
          final: periodoAdaptado.fecha_fin,
        },
        cursos: cursosFiliales,
        fechaEmision: fechaActual,
      });
    } else {
      return NextResponse.json(
        { success: false, message: `Tipo de reporte '${tipo}' no soportado` },
        { status: 400 }
      );
    }

    const buffer = await renderToBuffer(pdfElement);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${tipo}-${docenteId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('Error al generar PDF:', err);
    return NextResponse.json(
      { success: false, message: `Error del servidor al generar el PDF: ${err.message}` },
      { status: 500 }
    );
  }
}
