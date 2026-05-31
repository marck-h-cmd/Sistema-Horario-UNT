import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario, TipoComponente } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==================== INFORMACIÓN DE HORARIOS VÁLIDOS ====================
const rawSchedulesText = `IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Posgrado A-307	LUNES	07:00	09:00	A	CONFIRMADO	TEORIA	2	0	2
IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Lab. 3	LUNES	14:00	16:00	A	CONFIRMADO	LABORATORIO	2	0	2
IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Lab. 3	LUNES	16:00	18:00	B	CONFIRMADO	LABORATORIO	2	0	2
IS-102	Introducción a la Ing. de Sistemas	I	Alberto Mendoza de los Santos	Posgrado A-307	MARTES	07:00	10:00	A	CONFIRMADO	TEORIA	1	2	0
EG-101	Introducción a la Programación (EG)	I	Paul Cotrina Castellanos	Lab. 4	JUEVES	09:00	11:00	A	CONFIRMADO	LABORATORIO	0	0	2
EG-101	Introducción a la Programación (EG)	I	Paul Cotrina Castellanos	Lab. 4	JUEVES	11:00	13:00	B	CONFIRMADO	LABORATORIO	0	0	2
EG-102	Desarrollo Personal	I	Bertha Urtecho Zavaleta	Taller Confecciones Ing. Industrial	VIERNES	09:00	13:00	A	CONFIRMADO	PRACTICA	2	2	0
EG-103	Desarrollo del Pensamiento Lógico Matemático	I	Jose Luis Ponte Bejarano	Posgrado A-307	MARTES	10:00	13:00	A	CONFIRMADO	TEORIA	1	4	0
EG-103	Desarrollo del Pensamiento Lógico Matemático	I	Jose Luis Ponte Bejarano	Posgrado A-307	VIERNES	07:00	09:00	A	CONFIRMADO	TEORIA	1	4	0
EG-104	Lectura Crítica y Redac. Textos Académicos	I	Jorge Luis Rios Gonzales	Posgrado A-303	JUEVES	14:00	18:00	A	CONFIRMADO	TEORIA	2	2	0
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	LUNES	09:00	11:00	A	CONFIRMADO	TEORIA	2	4	0
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	LUNES	11:00	13:00	A	CONFIRMADO	TEORIA	2	4	0
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	MARTES	16:00	18:00	A	CONFIRMADO	PRACTICA	2	4	0
EG-106	Estadística General	I	Miguel Ipanaque Zapata	Taller Confecciones Ing. Industrial	JUEVES	07:00	09:00	A	CONFIRMADO	LABORATORIO	0	2	0
EG-106B	Estadística General	I	Martha Cardoso	Posgrado A-303	VIERNES	14:00	16:00	A	CONFIRMADO	TEORIA	2	2	0
EG-106B	Estadística General	I	Martha Cardoso	Taller Confecciones Ing. Industrial	VIERNES	16:00	18:00	A	CONFIRMADO	LABORATORIO	2	2	0
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 2	LUNES	09:00	13:00	A	CONFIRMADO	LABORATORIO	2	0	4
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 4	VIERNES	09:00	13:00	B	CONFIRMADO	LABORATORIO	2	0	4
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 2	MARTES	09:00	13:00	C	CONFIRMADO	LABORATORIO	2	0	4
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	I-4	MARTES	14:00	16:00	A	CONFIRMADO	TEORIA	2	0	4
IS-302	Sistémica	III	Everson David Agreda Gamboa	Posgrado A-307	MIERCOLES	09:00	12:00	A	CONFIRMADO	TEORIA	2	1	2
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	MIERCOLES	14:00	16:00	A	CONFIRMADO	LABORATORIO	2	1	2
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	MIERCOLES	16:00	18:00	B	CONFIRMADO	LABORATORIO	2	1	2
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	JUEVES	16:00	18:00	C	CONFIRMADO	LABORATORIO	2	1	2
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldan	Posgrado A-303	MIERCOLES	07:00	09:00	A	CONFIRMADO	TEORIA	1	1	2
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldan	Lab. 1	JUEVES	07:00	10:00	A	CONFIRMADO	LABORATORIO	1	1	2
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldan	Lab. 1	JUEVES	10:00	13:00	B	CONFIRMADO	LABORATORIO	1	1	2
MAT-301	Matemática Aplicada	III	Marcos Ferrer Reyna	Posgrado A-303	MIERCOLES	18:00	21:00	A	CONFIRMADO	TEORIA	1	2	2
MAT-301	Matemática Aplicada	III	Marcos Ferrer Reyna	Taller Confecciones Ing. Industrial	JUEVES	14:00	16:00	A	CONFIRMADO	PRACTICA	1	2	2
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Posgrado A-303	MARTES	16:00	18:00	A	CONFIRMADO	TEORIA	1	2	2
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Taller Confecciones Ing. Industrial	JUEVES	18:00	21:00	A	CONFIRMADO	LABORATORIO	1	2	2
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Taller Confecciones Ing. Industrial	VIERNES	07:00	09:00	B	CONFIRMADO	LABORATORIO	1	2	2
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Posgrado A-303	VIERNES	16:00	18:00	C	CONFIRMADO	TEORIA	1	2	2
ADM-301	Administración General	III	Juan Carrascal Cabanillas	Taller Confecciones Ing. Industrial	LUNES	07:00	09:00	A	CONFIRMADO	TEORIA	2	2	0
ADM-301	Administración General	III	Juan Carrascal Cabanillas	II-2	MARTES	07:00	09:00	A	CONFIRMADO	TEORIA	2	2	0
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Posgrado A-303	MARTES	15:00	20:00	A	CONFIRMADO	TEORIA	1	2	2
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	JUEVES	07:00	09:00	A	CONFIRMADO	LABORATORIO	1	2	2
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	JUEVES	09:00	11:00	A	CONFIRMADO	LABORATORIO	1	2	2
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	MIERCOLES	14:00	16:00	B	CONFIRMADO	LABORATORIO	1	2	2
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	MIERCOLES	16:00	18:00	B	CONFIRMADO	LABORATORIO	1	2	2
PSI-301	Psicología Organizacional (e)	III	Sheyla Laura Escobedo Rodriguez	Posgrado A-311	MARTES	18:00	20:00	A	CONFIRMADO	TEORIA	2	2	0
PSI-301	Psicología Organizacional (e)	III	Sheyla Laura Escobedo Rodriguez	Posgrado A-311	VIERNES	18:00	20:00	A	CONFIRMADO	TEORIA	2	2	0
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	Posgrado A-303	LUNES	08:00	09:00	A	CONFIRMADO	TEORIA	2	1	3
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	Lab. 4	LUNES	11:00	12:00	A	CONFIRMADO	LABORATORIO	2	1	3
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	Lab. 4	MARTES	08:00	09:00	A	CONFIRMADO	LABORATORIO	2	1	3
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	Lab. 2	JUEVES	07:00	08:00	A	CONFIRMADO	LABORATORIO	2	1	3
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	Lab. 2	VIERNES	07:00	08:00	A	CONFIRMADO	LABORATORIO	2	1	3
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Posgrado A-303	MIERCOLES	07:00	09:00	A	CONFIRMADO	TEORIA	2	2	2
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Posgrado A-303	MIERCOLES	09:00	11:00	A	CONFIRMADO	PRACTICA	2	2	2
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Lab. 3	JUEVES	09:00	10:00	A	CONFIRMADO	LABORATORIO	2	2	2
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Lab. 3	JUEVES	10:00	11:00	B	CONFIRMADO	LABORATORIO	2	2	2
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Posgrado A-307	JUEVES	09:00	10:00	C	CONFIRMADO	LABORATORIO	2	2	2
IS-503	Transformación Digital	V	Everson David Agreda Gamboa	Posgrado A-307	MIERCOLES	07:00	09:00	A	CONFIRMADO	TEORIA	2	0	2
IS-504	Tecnología Web	V	Robert Jerry Sanchez Ticona	Posgrado A-307	MIERCOLES	07:00	09:00	A	CONFIRMADO	TEORIA	1	1	2
IS-504	Tecnología Web	V	Robert Jerry Sanchez Ticona	Lab. 2	JUEVES	07:00	08:00	A	CONFIRMADO	LABORATORIO	1	1	2
IS-504	Tecnología Web	V	Robert Jerry Sanchez Ticona	Lab. 2	VIERNES	07:00	08:00	A	CONFIRMADO	LABORATORIO	1	1	2
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Posgrado A-303	MIERCOLES	09:00	11:00	A	CONFIRMADO	TEORIA	2	2	3
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Lab. 3	JUEVES	09:00	10:00	A	CONFIRMADO	LABORATORIO	2	2	3
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Posgrado A-307	VIERNES	09:00	11:00	A	CONFIRMADO	TEORIA	2	2	3
IS-506	Teleinformática (e)	V	Camilo Suarez Rebaza	Lab. 2	MIERCOLES	14:00	16:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-506	Teleinformática (e)	V	Camilo Suarez Rebaza	Lab. 2	MIERCOLES	16:00	18:00	B	CONFIRMADO	LABORATORIO	1	2	2
IS-507	Investigación de Operaciones	V	Marcos Baca Lopez	Posgrado A-307	MIERCOLES	14:00	16:00	A	CONFIRMADO	TEORIA	1	2	2
IS-507	Investigación de Operaciones	V	Marcos Baca Lopez	Posgrado A-307	MIERCOLES	16:00	18:00	A	CONFIRMADO	PRACTICA	1	2	2
IS-507	Investigación de Operaciones	V	Marcos Baca Lopez	Lab. 4	JUEVES	14:00	16:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-507	Investigación de Operaciones	V	Marcos Baca Lopez	Posgrado A-307	VIERNES	06:00	08:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-508	Contabilidad Gerencial	V	Ana Cuadra Mitzugaray	Lab. 4	MIERCOLES	14:00	16:00	A	CONFIRMADO	TEORIA	1	2	2
IS-508	Contabilidad Gerencial	V	Ana Cuadra Mitzugaray	Lab. 4	MARTES	14:00	15:00	A	CONFIRMADO	PRACTICA	1	2	2
IS-508	Contabilidad Gerencial	V	Ana Cuadra Mitzugaray	Lab. 4	MARTES	19:00	20:00	B	CONFIRMADO	LABORATORIO	1	2	2
IS-701	Ingeniería de Software I	VII	Juan Pedro Santos Fernandez	Posgrado A-303	JUEVES	08:00	09:00	A	CONFIRMADO	TEORIA	2	1	3
IS-701	Ingeniería de Software I	VII	Juan Pedro Santos Fernandez	Lab. 1	MARTES	07:00	08:00	A	CONFIRMADO	LABORATORIO	2	1	3
IS-701B	Ingeniería de Software I	VII	Robert Jerry Sanchez Ticona	Lab. 1	LUNES	07:00	08:00	A	CONFIRMADO	LABORATORIO	0	0	2
IS-701B	Ingeniería de Software I	VII	Robert Jerry Sanchez Ticona	Lab. 1	LUNES	10:00	11:00	B	CONFIRMADO	LABORATORIO	0	0	2
IS-702	Redes y Comunicaciones I	VII	Cesar Arellano Salazar	Lab. 2	LUNES	13:00	15:00	A	CONFIRMADO	LABORATORIO	1	1	3
IS-702	Redes y Comunicaciones I	VII	Cesar Arellano Salazar	Lab. 2	LUNES	15:00	17:00	B	CONFIRMADO	LABORATORIO	1	1	3
IS-702	Redes y Comunicaciones I	VII	Cesar Arellano Salazar	Lab. 3	LUNES	10:00	11:00	C	CONFIRMADO	LABORATORIO	1	1	3
IS-702	Redes y Comunicaciones I	VII	Cesar Arellano Salazar	Posgrado A-311	VIERNES	16:00	18:00	A	CONFIRMADO	TEORIA	1	1	3
IS-704	Negocios Electrónicos (e)	VII	Everson David Agreda Gamboa	Posgrado A-311	MARTES	16:00	18:00	A	CONFIRMADO	TEORIA	2	0	0
IS-704B	Negocios Electrónicos (e)	VII	Paul Cotrina Castellanos	Lab. 4	LUNES	14:00	16:00	A	CONFIRMADO	LABORATORIO	0	0	2
IS-704B	Negocios Electrónicos (e)	VII	Paul Cotrina Castellanos	Lab. 4	LUNES	16:00	18:00	B	CONFIRMADO	LABORATORIO	0	0	2
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Posgrado A-303	VIERNES	07:00	09:00	A	CONFIRMADO	TEORIA	1	2	2
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Lab. 1	VIERNES	10:00	11:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Lab. 1	VIERNES	11:00	12:00	B	CONFIRMADO	LABORATORIO	1	2	2
IS-706	Metodología de la Investigación Científica	VII	Paul Cotrina Castellanos	Posgrado A-307	JUEVES	14:00	18:00	A	CONFIRMADO	TEORIA	2	2	0
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	Posgrado A-307	JUEVES	07:00	08:00	A	CONFIRMADO	TEORIA	1	1	3
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	Lab. 4	JUEVES	18:00	20:00	A	CONFIRMADO	LABORATORIO	1	1	3
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	Lab. 2	VIERNES	18:00	20:00	B	CONFIRMADO	LABORATORIO	1	1	3
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcantara Moreno	Posgrado A-307	MARTES	13:00	15:00	A	CONFIRMADO	TEORIA	1	2	2
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcantara Moreno	Lab. 4	MIERCOLES	13:00	15:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcantara Moreno	Lab. 4	MIERCOLES	15:00	17:00	B	CONFIRMADO	LABORATORIO	1	2	2
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcantara Moreno	Lab. 3	JUEVES	09:00	11:00	C	CONFIRMADO	LABORATORIO	1	2	2
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcantara Moreno	Audiovisuales	MIERCOLES	17:00	19:00	C	CONFIRMADO	TEORIA	1	2	2
EP-701	Cadena de Suministros (e)	VII	Jhoe Gonzalez Vasquez	Lab. 4	MIERCOLES	07:00	11:00	A	CONFIRMADO	TEORIA	2	2	0
IS-901	Tesis I	IX	Juan Pedro Santos Fernandez	Posgrado A-303	JUEVES	08:00	09:00	A	CONFIRMADO	TEORIA	2	2	2
IS-901	Tesis I	IX	Juan Pedro Santos Fernandez	Lab. 2	JUEVES	11:00	12:00	A	CONFIRMADO	LABORATORIO	2	2	2
IS-902	Tesis I	IX	Ricardo Mendoza Rivera	Posgrado A-311	JUEVES	14:00	16:00	A	CONFIRMADO	TEORIA	2	2	1
IS-903	Analítica de Negocios	IX	Ricardo Mendoza Rivera	Posgrado A-303	VIERNES	10:00	11:00	A	CONFIRMADO	TEORIA	1	2	2
IS-903	Analítica de Negocios	IX	Ricardo Mendoza Rivera	Lab. 4	VIERNES	14:00	15:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-904	Auditoría Informática	IX	Alberto Mendoza de los Santos	Lab. 3	MARTES	10:00	11:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-904	Auditoría Informática	IX	Alberto Mendoza de los Santos	Lab. 3	MIERCOLES	08:00	09:00	A	CONFIRMADO	LABORATORIO	1	2	2
IS-905	Gestión de Proyectos de TI	IX	Jose Gomez Avila	Posgrado A-303	JUEVES	08:00	09:00	A	CONFIRMADO	TEORIA	1	2	3
IS-905	Gestión de Proyectos de TI	IX	Jose Gomez Avila	Posgrado A-303	LUNES	10:00	11:00	A	CONFIRMADO	TEORIA	1	2	3
IS-905	Gestión de Proyectos de TI	IX	Jose Gomez Avila	Posgrado A-303	MARTES	14:00	16:00	A	CONFIRMADO	PRACTICA	1	2	3
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcantara Moreno	Posgrado A-303	VIERNES	10:00	11:00	A	CONFIRMADO	TEORIA	2	0	2
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcantara Moreno	Lab. 4	MARTES	10:00	11:00	A	CONFIRMADO	LABORATORIO	2	0	2
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcantara Moreno	Audiovisuales	MARTES	10:00	11:00	A	CONFIRMADO	LABORATORIO	2	0	2
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Posgrado A-303	LUNES	18:00	20:00	A	CONFIRMADO	TEORIA	1	1	3
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Lab. 3	MARTES	08:00	09:00	A	CONFIRMADO	LABORATORIO	1	1	3
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Lab. 3	MIERCOLES	06:00	08:00	A	CONFIRMADO	LABORATORIO	1	1	3
IS-908	Computación en la Nube	IX	Jose Gomez Avila	Posgrado A-303	MARTES	14:00	16:00	A	CONFIRMADO	TEORIA	1	1	3
IS-908	Computación en la Nube	IX	Jose Gomez Avila	Lab. 3	MIERCOLES	06:00	08:00	A	CONFIRMADO	LABORATORIO	1	1	3
IS-908	Computación en la Nube	IX	Jose Gomez Avila	Lab. 4	MIERCOLES	06:00	08:00	B	CONFIRMADO	LABORATORIO	1	1	3
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	Posgrado A-303	LUNES	14:00	16:00	A	CONFIRMADO	TEORIA	2	0	2
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	Lab. 2	VIERNES	14:00	15:00	A	CONFIRMADO	LABORATORIO	2	0	2
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	Lab. 2	VIERNES	15:00	16:00	B	CONFIRMADO	LABORATORIO	2	0	2`;

// ==================== FUNCIONES AUXILIARES DE NORMALIZACIÓN ====================

const cleanStringForMatch = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]/g, "");     // quitar espacios y caracteres especiales
};

const normalizarAmbiente = (nombre: string): { codigo: string; nombre: string; tipo: TipoAmbiente } => {
  const n = nombre.trim().replace(/\s+/g, ' ').replace(/"/g, '');
  if (n.includes('Posgrado A-307')) return { codigo: 'A-307', nombre: 'Posgrado A-307', tipo: TipoAmbiente.AULA };
  if (n.includes('Posgrado A-303')) return { codigo: 'A-303', nombre: 'Posgrado A-303', tipo: TipoAmbiente.AULA };
  if (n.includes('Posgrado A-311')) return { codigo: 'A-311', nombre: 'Posgrado A-311', tipo: TipoAmbiente.AULA };
  if (n.includes('Lab. 1')) return { codigo: 'Lab-1', nombre: 'Laboratorio 1', tipo: TipoAmbiente.LABORATORIO };
  if (n.includes('Lab. 2')) return { codigo: 'Lab-2', nombre: 'Laboratorio 2', tipo: TipoAmbiente.LABORATORIO };
  if (n.includes('Lab. 3')) return { codigo: 'Lab-3', nombre: 'Laboratorio 3', tipo: TipoAmbiente.LABORATORIO };
  if (n.includes('Lab. 4')) return { codigo: 'Lab-4', nombre: 'Laboratorio 4', tipo: TipoAmbiente.LABORATORIO };
  if (n.includes('Lab. Fisica')) return { codigo: 'Lab-Fisica', nombre: 'Laboratorio de Física', tipo: TipoAmbiente.LABORATORIO };
  
  // Unificador potente para Taller de Confecciones (Ing. Industrial) y similares
  if (n.toLowerCase().includes('taller confecciones') || n.toLowerCase().includes('taller de confecciones')) {
    return { codigo: 'Lab-Taller', nombre: 'Taller de Confecciones - Ing. Industrial', tipo: TipoAmbiente.LABORATORIO };
  }
  
  if (n.includes('I-4')) return { codigo: 'I-4', nombre: 'Aula I-4', tipo: TipoAmbiente.AULA };
  
  // Unificador para aulas II-2
  if (
    n.includes('I I - 2') || n.includes('II - 2') || n.includes('II-2') || 
    n.includes('I I-2') || n.includes('I I 2') || n.includes('II 2')
  ) {
    return { codigo: 'II-2', nombre: 'Aula II-2 (Pabellón Ing. Industrial)', tipo: TipoAmbiente.AULA };
  }
  
  if (n.includes('Audiovisuales')) return { codigo: 'AUD', nombre: 'Audiovisuales', tipo: TipoAmbiente.AUDITORIO };
  
  const cleanCode = n.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 10);
  return { codigo: cleanCode, nombre: n, tipo: TipoAmbiente.AULA };
};

const mapCiclo = (ciclo: string): number => {
  if (ciclo === 'I') return 1;
  if (ciclo === 'III') return 3;
  if (ciclo === 'V') return 5;
  if (ciclo === 'VII') return 7;
  if (ciclo === 'IX') return 9;
  return 1;
};

const mapDia = (dia: string): DiaSemana => {
  const d = dia.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (d === 'MIERCOLES') return DiaSemana.MIERCOLES;
  if (d === 'SABADO') return DiaSemana.SABADO;
  return d as DiaSemana;
};

const mapHora = (hora: string): string => {
  let [h, m] = hora.trim().split(':');
  let hNum = parseInt(h, 10);
  // Si la hora es menor a 7 (e.g. 2:00, 6:00), asumimos que es de la tarde y sumamos 12
  if (hNum < 7) {
    hNum += 12;
  }
  return `${hNum.toString().padStart(2, '0')}:${m}`;
};

const calcularHoras = (inicio: string, fin: string): number => {
  const [hIni, mIni] = mapHora(inicio).split(':').map(Number);
  const [hFin, mFin] = mapHora(fin).split(':').map(Number);
  return (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60;
};

const obtenerMetadatosCurso = (nombre: string): { creditos: number; horasTeoria: number; horasPractica: number; horasLaboratorio: number } => {
  const n = cleanStringForMatch(nombre);
  
  if (n.includes('introduccionaprogramacion')) {
    return { creditos: 4, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 2 };
  }
  if (n.includes('introduccionalaing') || n.includes('introduccionalaingdesistemas')) {
    return { creditos: 2, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('desarrollopersonal')) {
    return { creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('desarrollodelpensamientologicomatematico')) {
    return { creditos: 4, horasTeoria: 1, horasPractica: 4, horasLaboratorio: 0 };
  }
  if (n.includes('lecturacritica')) {
    return { creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('introduccionalanalisismatematico')) {
    return { creditos: 5, horasTeoria: 2, horasPractica: 4, horasLaboratorio: 0 };
  }
  if (n.includes('estadisticageneral')) {
    return { creditos: 4, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('programacionorientadaaobjetos')) {
    return { creditos: 5, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 4 };
  }
  if (n.includes('sistemica')) {
    return { creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 2 };
  }
  if (n.includes('ingenieriagrafica')) {
    return { creditos: 3, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 2 };
  }
  if (n.includes('matematicaaplicada')) {
    return { creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 };
  }
  if (n.includes('estadisticaaplicada')) {
    return { creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 };
  }
  if (n.includes('administraciongeneral')) {
    return { creditos: 2, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('fisicaelectronica')) {
    return { creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 };
  }
  if (n.includes('psicologiaorganizacional')) {
    return { creditos: 2, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('ingenieriadesoftware')) {
    return { creditos: 4, horasTeoria: 2, horasPractica: 1, horasLaboratorio: 3 };
  }
  if (n.includes('redesycomunicaciones')) {
    return { creditos: 4, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3 };
  }
  if (n.includes('negocioselectronicos')) {
    return { creditos: 2, horasTeoria: 2, horasPractica: 0, horasLaboratorio: 0 };
  }
  if (n.includes('gestiondeservicios')) {
    return { creditos: 3, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 };
  }
  if (n.includes('metodologiadelainvestigacion')) {
    return { creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  if (n.includes('administraciondebasedatos')) {
    return { creditos: 4, horasTeoria: 1, horasPractica: 1, horasLaboratorio: 3 };
  }
  if (n.includes('planeamientoestrategico')) {
    return { creditos: 4, horasTeoria: 1, horasPractica: 2, horasLaboratorio: 2 };
  }
  if (n.includes('cadenadesuministros')) {
    return { creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
  }
  
  return { creditos: 3, horasTeoria: 2, horasPractica: 2, horasLaboratorio: 0 };
};

// ==================== PROCEDIMIENTO PRINCIPAL ====================

async function main() {
  console.log('🌱 Iniciando generación de datos semilla...');

  // ==================== PARSEO DE TABLA ====================
  const lines = rawSchedulesText.trim().split('\n');
  const parsedSchedules = lines.map(line => {
    const cols = line.split(/\t/);
    return {
      codigoCurso: cols[0].trim(),
      curso: cols[1].trim(),
      ciclo: cols[2].trim(),
      docente: cols[3].trim(),
      ambiente: cols[4].trim(),
      dia: cols[5].trim(),
      inicio: cols[6].trim(),
      fin: cols[7].trim(),
      grupo: cols[8].trim(),
      estado: cols[9].trim(),
      tipoComponente: cols[10]?.trim() ?? 'TEORIA',
      horasT: parseInt(cols[11] ?? '0'),
      horasP: parseInt(cols[12] ?? '0'),
      horasL: parseInt(cols[13] ?? '0'),
    };
  });

  console.log(`📊 Total registros de grilla analizados: ${parsedSchedules.length}`);

  // ==================== LIMPIEZA ====================
  await prisma.seleccionTemporal.deleteMany();
  await prisma.envioNotificacion.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.atencionVentana.deleteMany();
  await prisma.ventanaAtencion.deleteMany();
  await prisma.validacionHorario.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.matricula.deleteMany();
  await prisma.estudiante.deleteMany();
  await prisma.disponibilidadDocente.deleteMany();
  await prisma.restriccionAmbiente.deleteMany();
  await prisma.mantenimientoAmbiente.deleteMany();
  await prisma.preferenciasNotificacion.deleteMany();
  await prisma.cursoDocente.deleteMany();
  await prisma.grupo.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.docente.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.configuracionPeriodo.deleteMany();
  await prisma.diaNoLaborable.deleteMany();
  await prisma.ambiente.deleteMany();
  await prisma.periodoAcademico.deleteMany();
  await prisma.registroAuditoria.deleteMany();

  console.log('✅ Datos anteriores limpiados');

  // ==================== USUARIOS ADMINISTRATIVOS ====================
  const passwordHash = await bcrypt.hash('unt123456', 12);

  const adminUser = await prisma.usuario.create({
    data: { email: 'admin@unitru.edu.pe', password: passwordHash, nombre: 'Administrador', apellidos: 'Sistema', rol: Rol.ADMINISTRADOR, verificado: true }
  });
  const operadorUser = await prisma.usuario.create({
    data: { email: 'operador@unitru.edu.pe', password: passwordHash, nombre: 'Operador', apellidos: 'Sistema', rol: Rol.OPERADOR, verificado: true }
  });
  const superAdminUser = await prisma.usuario.create({
    data: { email: 'superadmin@unitru.edu.pe', password: passwordHash, nombre: 'Super', apellidos: 'Admin', rol: Rol.SUPER_ADMIN, verificado: true }
  });
  const monitorUser = await prisma.usuario.create({
    data: { email: 'monitor@unitru.edu.pe', password: passwordHash, nombre: 'Monitor', apellidos: 'Sistema', rol: Rol.MONITOR, verificado: true }
  });

  console.log('✅ Usuarios administrativos creados');

  // ==================== DOCENTES ====================
  const docentesData = [
    // Ciclo I
    { email: 'marcelino.torres@unitru.edu.pe', nombre: 'Marcelino', apellidos: 'Torres Villanueva', codigo: 'DOC001', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas' },
    { email: 'alberto.mendoza@unitru.edu.pe', nombre: 'Alberto', apellidos: 'Mendoza de los Santos', codigo: 'DOC002', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'paul.cotrina@unitru.edu.pe', nombre: 'Paul', apellidos: 'Cotrina Castellanos', codigo: 'DOC003', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'bertha.urtecho@unitru.edu.pe', nombre: 'Bertha', apellidos: 'Urtecho Zavaleta', codigo: 'DOC004', categoria: CategoriaDocente.AUXILIAR, departamento: 'CC. Psicológicas' },
    { email: 'jose.ponte@unitru.edu.pe', nombre: 'Jose Luis', apellidos: 'Ponte Bejarano', codigo: 'DOC005', categoria: CategoriaDocente.ASOCIADO, departamento: 'Matemáticas' },
    { email: 'jorge.rios@unitru.edu.pe', nombre: 'Jorge Luis', apellidos: 'Rios Gonzales', codigo: 'DOC006', categoria: CategoriaDocente.AUXILIAR, departamento: 'Lengua Nacional y Literatura' },
    { email: 'segundo.guibar@unitru.edu.pe', nombre: 'Segundo', apellidos: 'Guibar Obeso', codigo: 'DOC007', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Matemáticas' },
    { email: 'miguel.ipanaque@unitru.edu.pe', nombre: 'Miguel', apellidos: 'Ipanaque Zapata', codigo: 'DOC008', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Estadística' },
    { email: 'martha.cardoso@unitru.edu.pe', nombre: 'Martha', apellidos: 'Cardoso', codigo: 'DOC009', categoria: CategoriaDocente.AUXILIAR, departamento: 'Estadística' },

    // Ciclo III
    { email: 'zoraida.vidal@unitru.edu.pe', nombre: 'Zoraida', apellidos: 'Vidal Melgarejo', codigo: 'DOC010', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'everson.agreda@unitru.edu.pe', nombre: 'Everson David', apellidos: 'Agreda Gamboa', codigo: 'DOC011', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas' },
    { email: 'juan.obando@unitru.edu.pe', nombre: 'Juan Carlos', apellidos: 'Obando Roldan', codigo: 'DOC012', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'marcos.ferrer@unitru.edu.pe', nombre: 'Marcos', apellidos: 'Ferrer Reyna', codigo: 'DOC013', categoria: CategoriaDocente.ASOCIADO, departamento: 'Matemáticas' },
    { email: 'teresita.rojas@unitru.edu.pe', nombre: 'Teresita', apellidos: 'Rojas Garcia', codigo: 'DOC014', categoria: CategoriaDocente.AUXILIAR, departamento: 'Estadística' },
    { email: 'juan.carrascal@unitru.edu.pe', nombre: 'Juan', apellidos: 'Carrascal Cabanillas', codigo: 'DOC015', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Administración' },
    { email: 'vilma.mendez@unitru.edu.pe', nombre: 'Vilma', apellidos: 'Mendez Gil', codigo: 'DOC016', categoria: CategoriaDocente.ASOCIADO, departamento: 'Física' },
    { email: 'sheyla.laura@unitru.edu.pe', nombre: 'Sheyla', apellidos: 'Laura Escobedo Rodriguez', codigo: 'DOC017', categoria: CategoriaDocente.AUXILIAR, departamento: 'CC. Psicológicas' },

    // Ciclo V
    { email: 'luis.boy@unitru.edu.pe', nombre: 'Luis', apellidos: 'Boy Chavil', codigo: 'DOC018', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'juan.obando.v@unitru.edu.pe', nombre: 'Juan Carlos', apellidos: 'Obando Roldan', codigo: 'DOC029', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'robert.sanchez@unitru.edu.pe', nombre: 'Robert Jerry', apellidos: 'Sanchez Ticona', codigo: 'DOC019', categoria: CategoriaDocente.AUXILIAR, departamento: 'Ing. de Sistemas' },
    { email: 'cesar.arellano@unitru.edu.pe', nombre: 'Cesar', apellidos: 'Arellano Salazar', codigo: 'DOC020', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas' },
    { email: 'camilo.suarez@unitru.edu.pe', nombre: 'Camilo', apellidos: 'Suarez Rebaza', codigo: 'DOC021', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'marcos.baca@unitru.edu.pe', nombre: 'Marcos', apellidos: 'Baca Lopez', codigo: 'DOC022', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ingeniería Industrial' },
    { email: 'ana.cuadra@unitru.edu.pe', nombre: 'Ana', apellidos: 'Cuadra Mitzugaray', codigo: 'DOC023', categoria: CategoriaDocente.AUXILIAR, departamento: 'Contabilidad y Finanzas' },

    // Ciclo VII
    { email: 'juan.santos@unitru.edu.pe', nombre: 'Juan Pedro', apellidos: 'Santos Fernandez', codigo: 'DOC024', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas' },
    { email: 'ricardo.mendoza@unitru.edu.pe', nombre: 'Ricardo', apellidos: 'Mendoza Rivera', codigo: 'DOC025', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
    { email: 'oscar.alcantara@unitru.edu.pe', nombre: 'Oscar Romel', apellidos: 'Alcantara Moreno', codigo: 'DOC026', categoria: CategoriaDocente.AUXILIAR, departamento: 'Ing. de Sistemas' },
    { email: 'jhoe.gonzalez@unitru.edu.pe', nombre: 'Jhoe', apellidos: 'Gonzalez Vasquez', codigo: 'DOC027', categoria: CategoriaDocente.CONTRATADO, departamento: 'Ing. Industrial' },

    // Ciclo IX
    { email: 'jose.gomez@unitru.edu.pe', nombre: 'Jose', apellidos: 'Gomez Avila', codigo: 'DOC028', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas' },
  ];

  const fechasIngreso: Record<string, string> = {
    'DOC001': '1998-03-15', 'DOC005': '2001-08-20', 'DOC007': '1995-11-05', 'DOC008': '2003-04-10',
    'DOC011': '1999-07-01', 'DOC015': '2000-02-28', 'DOC018': '2004-09-12', 'DOC020': '1997-06-18',
    'DOC022': '2002-12-03', 'DOC024': '2005-03-22', 'DOC002': '2008-04-05', 'DOC003': '2012-08-14',
    'DOC010': '2009-03-01', 'DOC012': '2011-07-20', 'DOC013': '2007-10-15', 'DOC016': '2010-01-10',
    'DOC021': '2013-05-25', 'DOC023': '2014-02-18', 'DOC025': '2006-09-08', 'DOC028': '2015-11-30',
    'DOC004': '2017-04-12', 'DOC006': '2016-08-01', 'DOC009': '2019-03-05', 'DOC014': '2015-06-20',
    'DOC017': '2020-01-15', 'DOC019': '2018-09-10', 'DOC026': '2013-12-01', 'DOC027': '2022-04-01'
  };

  const docentes: any[] = [];
  for (const docenteData of docentesData) {
    const user = await prisma.usuario.create({
      data: {
        email: docenteData.email,
        password: passwordHash,
        nombre: docenteData.nombre,
        apellidos: docenteData.apellidos,
        rol: Rol.DOCENTE,
        verificado: true,
      }
    });

    const docente = await prisma.docente.create({
      data: {
        usuarioId: user.id,
        codigo: docenteData.codigo,
        categoria: docenteData.categoria,
        dedicacion: docenteData.categoria === CategoriaDocente.PRINCIPAL || docenteData.categoria === CategoriaDocente.ASOCIADO ? 'TIEMPO_COMPLETO_40H' : 'TIEMPO_PARCIAL_20H',
        departamento: docenteData.departamento,
        telefono: '999123456',
        fechaIngreso: new Date(fechasIngreso[docenteData.codigo] ?? '2015-01-01'),
        preferenciasNotificacion: {
          create: {
            correoActivo: true,
            whatsappActivo: true,
            telegramActivo: false,
            sistemaActivo: true,
          }
        }
      }
    });

    docentes.push({
      ...docente,
      nombre: docenteData.nombre,
      apellidos: docenteData.apellidos,
    });
  }

  console.log(`✅ ${docentes.length} docentes creados`);

  // ==================== AMBIENTES DINÁMICOS ====================
  const ambientesMap = new Map<string, { codigo: string; nombre: string; tipo: TipoAmbiente }>();
  for (const item of parsedSchedules) {
    const norm = normalizarAmbiente(item.ambiente);
    if (!ambientesMap.has(norm.codigo)) {
      ambientesMap.set(norm.codigo, norm);
    }
  }

  const ambientes: any[] = [];
  for (const [_, envInfo] of ambientesMap) {
    const ambiente = await prisma.ambiente.create({
      data: {
        codigo: envInfo.codigo,
        nombre: envInfo.nombre,
        tipo: envInfo.tipo,
        capacidad: 40,
        ubicacion: 'Campus Universitario UNT'
      }
    });
    ambientes.push(ambiente);
  }

  console.log(`✅ ${ambientes.length} ambientes dinámicos creados`);

  // ==================== CURSOS Y GRUPOS DINÁMICOS ====================
  const cursosMap = new Map<string, { codigo: string; nombre: string; ciclo: number; horasT: number; horasP: number; horasL: number }>();
  const uniqueGroupsMap = new Map<string, Set<string>>();

  for (const item of parsedSchedules) {
    if (!cursosMap.has(item.codigoCurso)) {
      cursosMap.set(item.codigoCurso, {
        codigo: item.codigoCurso,
        nombre: item.curso,
        ciclo: mapCiclo(item.ciclo),
        horasT: item.horasT,
        horasP: item.horasP,
        horasL: item.horasL,
      });
    }
    if (!uniqueGroupsMap.has(item.codigoCurso)) {
      uniqueGroupsMap.set(item.codigoCurso, new Set());
    }
    uniqueGroupsMap.get(item.codigoCurso)!.add(item.grupo);
  }

  const cursos: any[] = [];
  for (const [codigo, cursoInfo] of cursosMap) {
    const uniqueGroups = Array.from(uniqueGroupsMap.get(codigo) || new Set(['A']));
    const gruposData = uniqueGroups.map(g => ({ nombre: g, capacidad: 40 }));
    
    const curso = await prisma.curso.create({
      data: {
        codigo: cursoInfo.codigo,
        nombre: cursoInfo.nombre,
        ciclo: cursoInfo.ciclo,
        creditos: cursoInfo.horasT + cursoInfo.horasP + cursoInfo.horasL,
        horasTeoria: cursoInfo.horasT,
        horasPractica: cursoInfo.horasP,
        horasLaboratorio: cursoInfo.horasL,
        grupos: {
          create: gruposData
        }
      },
      include: {
        grupos: true
      }
    });
    cursos.push(curso);
  }

  console.log(`✅ ${cursos.length} cursos dinámicos creados`);

  // ==================== ASIGNACIONES CURSO-DOCENTE ====================
  const assignmentsMap = new Map<string, { cursoId: string; docenteId: string; horas: number }>();
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(`${d.nombre} ${d.apellidos}`) === cleanStringForMatch(item.docente));
    if (curso && docente) {
      const key = `${curso.id}_${docente.id}`;
      const horas = calcularHoras(item.inicio, item.fin);
      if (assignmentsMap.has(key)) {
        assignmentsMap.get(key)!.horas += horas;
      } else {
        assignmentsMap.set(key, { cursoId: curso.id, docenteId: docente.id, horas });
      }
    }
  }

  let totalAssignments = 0;
  for (const [_, val] of assignmentsMap) {
    await prisma.cursoDocente.create({
      data: {
        cursoId: val.cursoId,
        docenteId: val.docenteId,
        horasAsignadas: val.horas || 4,
      }
    });
    totalAssignments++;
  }

  console.log(`✅ ${totalAssignments} asignaciones curso-docente dinámicas creadas`);

  // ==================== PERÍODO ACADÉMICO ====================
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-I',
      fechaInicio: new Date('2026-04-13'),
      fechaFin: new Date('2026-08-08'),
      estado: EstadoPeriodo.ACTIVO,
      activo: true,
      configuraciones: {
        create: {
          horasMaxDiariasDocente: 8,
          horasMaxContinuas: 4,
          descansoMinEntreHoras: 1,
          ordenCategorias: ['PRINCIPAL', 'ASOCIADO', 'AUXILIAR', 'CONTRATADO', 'INVITADO']
        }
      }
    }
  });

  console.log('✅ Período académico 2026-I creado');

  // ==================== DISPONIBILIDAD DE DOCENTES ====================
  const diasSemana: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  for (const docente of docentes) {
    for (const dia of diasSemana) {
      await prisma.disponibilidadDocente.create({
        data: {
          docenteId: docente.id,
          diaSemana: dia,
          horaInicio: '08:00',
          horaFin: '18:00',
          prioridad: 1
        }
      });
    }
  }

  console.log('✅ Disponibilidad de docentes creada');

  // ==================== HORARIOS REALES (ESTADO CONFIRMADO) ====================
  let totalHorariosCreados = 0;
  for (const item of parsedSchedules) {
    const curso = cursos.find(c => c.codigo === item.codigoCurso);
    const docente = docentes.find(d => cleanStringForMatch(`${d.nombre} ${d.apellidos}`) === cleanStringForMatch(item.docente));
    const grupo = curso?.grupos.find((g: any) => g.nombre === item.grupo);
    const normEnv = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === normEnv.codigo);

    if (!curso || !docente || !grupo || !ambiente) {
      console.warn(`⚠️ Omisión de registro por inconsistencia en: Curso=${item.codigoCurso}, Docente=${item.docente}, Grupo=${item.grupo}, Ambiente=${item.ambiente}`);
      continue;
    }

    try {
      const mapTipo = (t: string): TipoComponente => {
        if (t === 'PRACTICA') return TipoComponente.PRACTICA;
        if (t === 'LABORATORIO') return TipoComponente.LABORATORIO;
        return TipoComponente.TEORIA;
      };
      
      const tipoComponente: TipoComponente = mapTipo(item.tipoComponente);

      await prisma.horario.create({
        data: {
          periodoId: periodo.id,
          cursoId: curso.id,
          docenteId: docente.id,
          grupoId: grupo.id,
          ambienteId: ambiente.id,
          diaSemana: mapDia(item.dia),
          horaInicio: mapHora(item.inicio),
          horaFin: mapHora(item.fin),
          tipoComponente,
          estado: EstadoHorario.CONFIRMADO,
          publicado: true,
          creadoPor: adminUser.id,
          fechaConfirmacion: new Date(),
          confirmadoPor: adminUser.id,
        }
      });
      totalHorariosCreados++;
    } catch (err: any) {
      console.warn(`⚠️ Conflicto al crear horario para ${curso.codigo} (${item.dia} ${item.inicio}-${item.fin}): ${err.message}`);
    }
  }

  console.log(`` + `✅ ${totalHorariosCreados} horarios reales registrados en estado CONFIRMADO`);

  // ==================== ESTUDIANTES Y MATRÍCULAS ====================
  const estudiantesData = [
    { codigo: '1020100126', nombre: 'Carlos Alberto', apellidos: 'Sánchez Ruiz', email: 'csanchez@unitru.edu.pe', dni: '71234561', ciclo: 1 },
    { codigo: '1020100226', nombre: 'Ana Lucía', apellidos: 'Torres Paredes', email: 'atorres@unitru.edu.pe', dni: '71234562', ciclo: 1 },
    { codigo: '1020100326', nombre: 'Roberto Carlos', apellidos: 'García Mendoza', email: 'rgarcia@unitru.edu.pe', dni: '71234563', ciclo: 1 },
    { codigo: '1020100426', nombre: 'María Fernanda', apellidos: 'López Castro', email: 'mlopez@unitru.edu.pe', dni: '71234564', ciclo: 1 },
    { codigo: '1020100526', nombre: 'Diego Armando', apellidos: 'Morales Villa', email: 'dmorales@unitru.edu.pe', dni: '71234565', ciclo: 1 },
    { codigo: '1020100626', nombre: 'Valeria Andrea', apellidos: 'Rojas Pineda', email: 'vrojas@unitru.edu.pe', dni: '71234566', ciclo: 3 },
    { codigo: '1020100726', nombre: 'Javier Alejandro', apellidos: 'Castro Herrera', email: 'jcastro@unitru.edu.pe', dni: '71234567', ciclo: 3 },
    { codigo: '1020100826', nombre: 'Daniela Fernanda', apellidos: 'Mendoza Ríos', email: 'dmendoza@unitru.edu.pe', dni: '71234568', ciclo: 5 },
    { codigo: '1020100926', nombre: 'Sebastián', apellidos: 'Flores Vargas', email: 'sflores@unitru.edu.pe', dni: '71234569', ciclo: 7 },
    { codigo: '1020101026', nombre: 'Camila', apellidos: 'Nuñez Rojas', email: 'cnunez@unitru.edu.pe', dni: '71234570', ciclo: 9 },
  ];

  const estudiantes: any[] = [];
  for (const est of estudiantesData) {
    const estudiante = await prisma.estudiante.create({
      data: est
    });
    estudiantes.push(estudiante);
  }

  let totalMatriculas = 0;
  for (const estudiante of estudiantes) {
    const cursosDelCiclo = cursos.filter(c => c.ciclo === estudiante.ciclo);

    for (const curso of cursosDelCiclo) {
      if (curso.grupos.length > 0) {
        const grupo = curso.grupos[Math.floor(Math.random() * curso.grupos.length)];
        await prisma.matricula.create({
          data: {
            estudianteId: estudiante.id,
            cursoId: curso.id,
            grupoId: grupo.id,
            periodoId: periodo.id,
            estado: 'ACTIVO'
          }
        });
        totalMatriculas++;
      }
    }
  }

  console.log(`✅ ${estudiantes.length} estudiantes registrados con ${totalMatriculas} matrículas`);

  // ==================== REPORTE FINAL ====================
  console.log('\n🎉 ========== DATOS SEMILLA GENERADOS ==========');
  console.log(`📊 Resumen:`);
  console.log(`   👨‍🏫 Docentes: ${docentes.length}`);
  console.log(`   📚 Cursos: ${cursos.length}`);
  console.log(`   🏛️ Ambientes: ${ambientes.length}`);
  console.log(`   📅 Horarios confirmados: ${totalHorariosCreados}`);
  console.log(`   👨‍🎓 Estudiantes: ${estudiantes.length}`);
  console.log(`   📅 Período: 2026-I (13 Abril - 08 Agosto 2026)`);
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error generando datos semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });