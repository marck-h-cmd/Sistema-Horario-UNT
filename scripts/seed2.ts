import { PrismaClient, Rol, CategoriaDocente, TipoAmbiente, DiaSemana, EstadoPeriodo, EstadoHorario, TipoCursoUNT } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==================== INFORMACIÓN DE HORARIOS VÁLIDOS ====================
// Formato: codigo_horario \t nombre_curso \t ciclo_romano \t docente \t ambiente \t dia \t inicio \t fin \t grupo \t estado
const rawSchedulesText = `IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Posgrado A-307	LUNES	07:00	09:00	A	CONFIRMADO
IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Lab. 3	LUNES	14:00	16:00	A	CONFIRMADO
IS-101	Introducción a la Programación	I	Marcelino Torres Villanueva	Lab. 3	LUNES	16:00	18:00	B	CONFIRMADO
IS-102	Introducción a la Ing. de Sistemas	I	Alberto Mendoza de los Santos	Posgrado A-307	MARTES	7:00	10:00	A	CONFIRMADO
EG-101	Introducción a la Programación (EG)	I	Paul Cotrina Castellanos	Lab. 4	JUEVES	09:00	11:00	A	CONFIRMADO
EG-101	Introducción a la Programación (EG)	I	Paul Cotrina Castellanos	Lab. 4	JUEVES	11:00	13:00	B	CONFIRMADO
EG-102	Desarrollo Personal	I	Bertha Urtecho Zavaleta	Taller Confecciones Ing. Industrial	VIERNES	9:00	13:00	A	CONFIRMADO
EG-103	Desarrollo del Pensamiento Lógico Matemático	I	Jose Luis Ponte Bejarano	Posgrado A-307	MARTES	10:00	13:00	A	CONFIRMADO
EG-103	Desarrollo del Pensamiento Lógico Matemático	I	Jose Luis Ponte Bejarano	Posgrado A-307	VIERNES	7:00	9:00	A	CONFIRMADO
EG-104	Lectura Crítica y Redac. Textos Académicos	I	Jorge Luis Rios Gonzales	Posgrado A-303	JUEVES	2:00	6:00	A	CONFIRMADO
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	LUNES	09:00	11:00	A	CONFIRMADO
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	LUNES	11:00	13:00	A	CONFIRMADO
EG-105	Introducción al Análisis Matemático	I	Segundo Guibar Obeso	Posgrado A-307	MARTES	16:00	18:00	A	CONFIRMADO
EG-106	Estadística General	I	Miguel Ipanaque Zapata	Taller de Confecciones - Ing. Industrial	JUEVES	7:00	09:00	A	CONFIRMADO
EG-106B	Estadística General	I	Martha Cardoso	posgrado B-104	VIERNES	14:00	16:00	A	CONFIRMADO
EG-106B	Estadística General	I	Martha Cardoso	Taller Confecciones Ing. Industrial	VIERNES	16:00	18:00	A	CONFIRMADO

IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 2	LUNES	9:00	13:00	A	CONFIRMADO
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 2	MARTES	9:00	13:00	C	CONFIRMADO
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	I-4	MARTES	14:00	16:00	A	CONFIRMADO
IS-301	Programación Orientada a Objetos II	III	Zoraida Vidal Melgarejo	Lab. 4	VIERNES	9:00	13:00	B	CONFIRMADO
IS-302	Sistémica	III	Everson David Agreda Gamboa	Posgrado A-307	MIÉRCOLES	9:00	12:00	A	CONFIRMADO
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	MIÉRCOLES	14:00	16:00	A	CONFIRMADO
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	MIÉRCOLES	16:00	18:00	B	CONFIRMADO
IS-302	Sistémica	III	Everson David Agreda Gamboa	Lab. 3	JUEVES	16:00	18:00	C	CONFIRMADO
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldán	Posgrado A-303	MIÉRCOLES	7:00	9:00	A	CONFIRMADO
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldán	Lab. 1	JUEVES	7:00	10:00	A	CONFIRMADO
IS-303	Ingeniería Gráfica (e)	III	Juan Carlos Obando Roldán	Lab. 1	JUEVES	10:00	13:00	B	CONFIRMADO

MAT-301	Matemática Aplicada	III	Marcos Ferrer Reyna	posgrado B-104	MIÉRCOLES	18:00	21:00	A	CONFIRMADO
MAT-301	Matemática Aplicada	III	Marcos Ferrer Reyna	Taller Confecciones Ing. Indust.	JUEVES	14:00	16:00	A	CONFIRMADO
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	posgrado B-105	MARTES	16:00	18:00	A	CONFIRMADO
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Taller Confecciones - Ing. Industrial	JUEVES	18:00	21:00	A	CONFIRMADO
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	Taller Confecciones (Ing. Industrial)	VIERNES	7:00	9:00	B	CONFIRMADO
EST-301	Estadística Aplicada	III	Teresita Rojas Garcia	posgrado B-104	VIERNES	16:00	18:00	C	CONFIRMADO
ADM-301	Administración General	III	Juan Carrascal Cabanillas	Taller Confecciones - Ing. Indust.	LUNES	07:00	9:00	A	CONFIRMADO
ADM-301	Administración General	III	Juan Carrascal Cabanillas	I I 2 (Pabellon Ing. Industrial)	MARTES	07:00	9:00	A	CONFIRMADO
FIS-301	Física Electrónica	III	Vilma Mendez Gil	posgrado B-105	LUNES	15:00	20:00	A	CONFIRMADO
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	JUEVES	7:00	9:00	A	CONFIRMADO
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	JUEVES	09:00	11:00	B	CONFIRMADO
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	MIÉRCOLES	14:00	16:00	B	CONFIRMADO
FIS-301	Física Electrónica	III	Vilma Mendez Gil	Lab. Fisica	MIÉRCOLES	16:00	18:00	B	CONFIRMADO
PSI-301	Psicología Organizacional (e)	III	Sheyla Laura Escobedo Rodriguez	Posgrado A-311	MARTES	18:00	20:00	A	CONFIRMADO
PSI-301	Psicología Organizacional (e)	III	Sheyla Laura Escobedo Rodriguez	Posgrado A-311	VIERNES	18:00	20:00	A	CONFIRMADO


IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	posgrado B-104	LUNES	7:00	10:00	A	CONFIRMADO
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	LAB	LUNES	10:00	13:00	A	CONFIRMADO
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	LAB	MARTES	7:00	10:00	B	CONFIRMADO
IS-501	Ingeniería de Datos I	V	Luis Boy Chavil	LAB	MARTES	10:00	13:00	C	CONFIRMADO
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	posgrado B-104	MIÉRCOLES	9:00	13:00	A	CONFIRMADO
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Lab. 1	MIÉRCOLES	14:00	16:00	A	CONFIRMADO
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Lab. 1	MIÉRCOLES	16:00	18:00	B	CONFIRMADO
IS-502	Sistemas de Información	V	Juan Carlos Obando Roldan	Lab. 1	MIÉRCOLES	18:00	20:00	C	CONFIRMADO
IS-503	Transformación Digital	V	Everson David Agreda Gamboa	Lab. 3	JUEVES	07:00	09:00	A	CONFIRMADO
IS-503	Transformación Digital	V	Everson David Agreda Gamboa	I-5	JUEVES	09:00	11:00	A	CONFIRMADO
IS-503	Transformación Digital	V	Everson David Agreda Gamboa	Lab. 3	JUEVES	11:00	13:00	B	CONFIRMADO
IS-504	Tecnología Web	V	Robert Jerry Sánchez Ticona	Lab. 1	LUNES	15:00	18:00	A	CONFIRMADO
IS-504	Tecnología Web	V	Robert Jerry Sánchez Ticona	Lab. 1	MARTES	15:00	18:00	B	CONFIRMADO
IS-504	Tecnología Web	V	Robert Jerry Sánchez Ticona	posgrado B-105	MIÉRCOLES	7:00	9:00	A	CONFIRMADO
IS-504	Tecnología Web	V	Robert Jerry Sánchez Ticona	Lab. 4	JUEVES	15:00	18:00	C	CONFIRMADO
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	posgrado B-105	VIERNES	09:00	12:00	A	CONFIRMADO
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Lab. 2	MIÉRCOLES	14:00	16:00	A	CONFIRMADO
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Lab. 2	MIÉRCOLES	16:00	18:00	B	CONFIRMADO
IS-505	Arquitectura de Computadoras	V	Cesar Arellano Salazar	Lab. 2	MIÉRCOLES	18:00	20:00	C	CONFIRMADO
IS-506	Teleinformática (e)	V	Camilo Suárez Rebaza	posgrado B-105	VIERNES	17:00	20:00	A	CONFIRMADO
IS-506	Teleinformática (e)	V	Camilo Suárez Rebaza	Lab. 2	MARTES	13:00	15:00	A	CONFIRMADO
IS-506	Teleinformática (e)	V	Camilo Suárez Rebaza	Lab. 2	MARTES	19:00	21:00	A	CONFIRMADO
IND-501	Investigación de Operaciones	V	Marcos Baca Lopez	posgrado B-105	JUEVES	11:00	14:00	A	CONFIRMADO
IND-501	Investigación de Operaciones	V	Marcos Baca Lopez	Lab. 2	JUEVES	7:00	9:00	A	CONFIRMADO
IND-501	Investigación de Operaciones	V	Marcos Baca Lopez	Lab. 2	JUEVES	9:00	11:00	B	CONFIRMADO
IND-501	Investigación de Operaciones	V	Marcos Baca Lopez	Lab. 2	VIERNES	7:00	9:00	C	CONFIRMADO
CF-501	Contabilidad Gerencial	V	Ana Cuadra Mitzugaray	posgrado B-105	VIERNES	14:00	17:00	A	CONFIRMADO
CF-501	Contabilidad Gerencial	V	Ana Cuadra Mitzugaray	posgrado B-105	JUEVES	18:00	20:00	A	CONFIRMADO


IS-701	Ingeniería de Software I	VII	Juan Pedro Santos Fernández	Lab. 1	MARTES	7:00	10:00	C	CONFIRMADO
IS-701	Ingeniería de Software I	VII	Juan Pedro Santos Fernández	Posgrado A-303	MARTES	10:00	13:00	A	CONFIRMADO
IS-702	Redes y Comunicaciones I	VII	César Arellano Salazar	Lab. 2	LUNES	13:00	16:00	A	CONFIRMADO
IS-702	Redes y Comunicaciones I	VII	César Arellano Salazar	Lab. 2	LUNES	16:00	19:00	B	CONFIRMADO
IS-702	Redes y Comunicaciones I	VII	César Arellano Salazar	Lab. 3	LUNES	10:00	13:00	C	CONFIRMADO
IS-702	Redes y Comunicaciones I	VII	César Arellano Salazar	Posgrado A-311	VIERNES	16:00	18:00	A	CONFIRMADO
IS-701B	Ingeniería de Software I	VII	Robert Jerry Sánchez Ticona	Lab. 1	LUNES	7:00	10:00	A	CONFIRMADO
IS-701B	Ingeniería de Software I	VII	Robert Jerry Sánchez Ticona	Lab. 1	LUNES	10:00	13:00	B	CONFIRMADO
IS-704	Negocios Electrónicos (e)	VII	Everson David Agreda Gamboa	Posgrado A-311	MARTES	16:00	18:00	A	CONFIRMADO
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Lab. 1	VIERNES	10:00	12:00	A	CONFIRMADO
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Lab. 1	VIERNES	12:00	14:00	B	CONFIRMADO
IS-705	Gestión de Servicios de TI	VII	Alberto Mendoza de los Santos	Posgrado A-303	VIERNES	7:00	10:00	A	CONFIRMADO
IS-706	Metodología de la Investigación Científica	VII	Paul Cotrina Castellanos	posgrado B-105	JUEVES	14:00	18:00	A	CONFIRMADO
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	posgrado B-105	JUEVES	7:00	9:00	A	CONFIRMADO
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	Lab. 4	JUEVES	18:00	21:00	A	CONFIRMADO
IS-707	Administración de Base de Datos	VII	Ricardo Mendoza Rivera	Lab. 2	VIERNES	18:00	21:00	B	CONFIRMADO
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcántara Moreno	Posgrado A-307	MARTES	13:00	16:00	A	CONFIRMADO
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcántara Moreno	Lab. 4	MIÉRCOLES	13:00	15:00	A	CONFIRMADO
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcántara Moreno	Lab. 4	MIÉRCOLES	15:00	17:00	B	CONFIRMADO
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcántara Moreno	Lab. 3	JUEVES	9:00	11:00	C	CONFIRMADO
IS-708	Planeamiento Estratégico de TI	VII	Oscar Romel Alcántara Moreno	Audiovisuales	MIÉRCOLES	17:00	19:00	C	CONFIRMADO
IS-704B	Negocios Electrónicos (e)	VII	Paul Cotrina Castellanos	Lab. 4	LUNES	14:00	16:00	A	CONFIRMADO
IS-704B	Negocios Electrónicos (e)	VII	Paul Cotrina Castellanos	Lab. 4	LUNES	16:00	18:00	B	CONFIRMADO
EP-701	Cadena de Suministros (e)	VII	Jhoe Gonzalez Vasquez	Taller de Confecciones - Ing. Industria	MIÉRCOLES	7:00	11:00	A	CONFIRMADO


IS-901	Tesis I	IX	Juan Pedro Santos Fernández	Lab 2	JUEVES	11:00	13:00	A	CONFIRMADO
IS-901	Tesis I	IX	Juan Pedro Santos Fernández	posgrado B-104	JUEVES	7:00	11:00	A	CONFIRMADO
IS-901B	Tesis I	IX	Ricardo Mendoza Rivera	posgrado B-304	JUEVES	14:00	18:00	A	CONFIRMADO
IS-902B	Analítica de Negocios	IX	Ricardo Mendoza Rivera	Lab 4	VIERNES	10:00	13:00	A	CONFIRMADO
IS-902B	Analítica de Negocios	IX	Ricardo Mendoza Rivera	Lab 4	VIERNES	14:00	16:00	A	CONFIRMADO
IS-901B	Tesis I	IX	Ricardo Mendoza Rivera	Lab 4	VIERNES	16:00	18:00	A	CONFIRMADO
IS-904	Auditoría Informática	IX	Alberto Mendoza de los Santos	posgrado B-104	LUNES	10:00	13:00	A	CONFIRMADO
IS-904	Auditoría Informática	IX	Alberto Mendoza de los Santos	Lab. 3	MARTES	10:00	12:00	A	CONFIRMADO
IS-904	Auditoría Informática	IX	Alberto Mendoza de los Santos	Lab. 3	MARTES	12:00	14:00	B	CONFIRMADO
IS-905	Gestión de Proyectos de TI	IX	José Gómez Ávila	posgrado B-104	LUNES	14:00	17:00	A	CONFIRMADO
IS-905	Gestión de Proyectos de TI	IX	José Gómez Ávila	Audiovisuales	MARTES	10:00	12:00	A	CONFIRMADO
IS-905	Gestión de Proyectos de TI	IX	José Gómez Ávila	Lab. 1	MARTES	13:00	15:00	B	CONFIRMADO
IS-905	Gestión de Proyectos de TI	IX	José Gómez Ávila	Lab 1	MARTES	19:00	21:00	C	CONFIRMADO
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcántara Moreno	Lab. 2	VIERNES	14:00	16:00	A	CONFIRMADO
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcántara Moreno	Lab. 2	VIERNES	16:00	18:00	B	CONFIRMADO
IS-906	Emprendimiento Tecnológico	IX	Oscar Romel Alcántara Moreno	posgrado B-104	VIERNES	18:00	20:00	A	CONFIRMADO
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Lab. 4	MARTES	14:00	17:00	A	CONFIRMADO
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Lab. 4	MARTES	17:00	20:00	B	CONFIRMADO
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	Lab. 4	MIÉRCOLES	10:00	13:00	C	CONFIRMADO
IS-907	Ingeniería Web	IX	Marcelino Torres Villanueva	posgrado B-104	LUNES	18:00	20:00	A	CONFIRMADO
IS-908	Computación en la Nube	IX	José Gómez Ávila	Lab. 3	LUNES	7:00	10:00	A	CONFIRMADO
IS-908	Computación en la Nube	IX	José Gómez Ávila	Lab. 3	MIÉRCOLES	7:00	10:00	B	CONFIRMADO
IS-908	Computación en la Nube	IX	José Gómez Ávila	Lab. 4	MIÉRCOLES	17:00	20:00	C	CONFIRMADO
IS-908	Computación en la Nube	IX	José Gómez Ávila	posgrado B-104	JUEVES	18:00	20:00	A	CONFIRMADO
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	posgrado B-104	MARTES	8:00	10:00	A	CONFIRMADO
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	Lab. 2	MARTES	15:00	17:00	A	CONFIRMADO
IS-909	Hackeo Ético (e)	IX	Camilo Suarez Rebaza	Lab. 2	MARTES	17:00	19:00	B	CONFIRMADO`;

// ==================== MAPA: codigo_horario -> codigo_oficial (parsedCoursesData) ====================
// Este mapa vincula los códigos usados en rawSchedulesText con los códigos oficiales del plan de estudios
const codigoHorarioToOficial: Record<string, string> = {
  // Ciclo I
  'IS-101': '2347',  // Introducción a la Programación
  'EG-101': '2347',  // Introducción a la Programación (EG) -> mismo curso
  'IS-102': '1939',  // Introducción a la Ing. de Sistemas
  'EG-102': '1854',  // Desarrollo Personal
  'EG-103': '1855',  // Desarrollo del Pensamiento Lógico Matemático
  'EG-104': '1857',  // Lectura Crítica y Redacción de Textos Académicos
  'EG-105': '1863',  // Introducción al Análisis Matemático
  'EG-106': '1867',  // Estadística General
  'EG-106B': '1867',  // Estadística General (grupo B)
  // Ciclo III
  'IS-301': '2145',  // Programación Orientada a Objetos II
  'IS-302': '2141',  // Sistémica
  'IS-303': '2146',  // Ingeniería Gráfica
  'MAT-301': '2143',  // Matemática Aplicada
  'EST-301': '2142',  // Estadística Aplicada
  'ADM-301': '2140',  // Administración General
  'FIS-301': '2144',  // Física Electrónica
  'PSI-301': '2147',  // Psicología Organizacional
  // Ciclo V
  'IS-501': '2692',  // Ingeniería de Datos I
  'IS-502': '2694',  // Sistemas de Información
  'IS-503': '2696',  // Transformación Digital
  'IS-504': '2690',  // Tecnologías Web
  'IS-505': '2693',  // Arquitectura y Organización de Computadoras
  'IS-506': '2695',  // Teleinformática
  'IND-501': '2691',  // Investigación de Operaciones
  'CF-501': '2689',  // Contabilidad Gerencial
  // Ciclo VII
  'IS-701': '3449',  // Ingeniería del Software I
  'IS-701B': '3449',  // Ingeniería del Software I (segundo docente)
  'IS-702': '3448',  // Redes y Comunicaciones I
  'IS-704': '3451',  // Negocios Electrónicos
  'IS-704B': '3451',  // Negocios Electrónicos (segundo docente)
  'IS-705': '3445',  // Gestión de Servicios de TIC
  'IS-706': '3446',  // Metodología de la Investigación Científica
  'IS-707': '3450',  // Administración de Base de Datos
  'IS-708': '3447',  // Planeamiento Estratégico de la Información
  'EP-701': '3444',  // Cadena de Suministro
  // Ciclo IX
  'IS-901': '4492',  // Tesis I
  'IS-901B': '4492',  // Tesis I (segundo docente)
  'IS-902B': '4493',  // Analítica de Negocios
  'IS-904': '4491',  // Auditoría Informática
  'IS-905': '4490',  // Gestión de Proyectos de TIC
  'IS-906': '4496',  // Emprendedurismo Tecnológico
  'IS-907': '4495',  // Ingeniería Web
  'IS-908': '4494',  // Computación en la Nube
  'IS-909': '4497',  // Hackeo Ético
};

// ==================== MALLA CURRICULAR OFICIAL (Plan de Estudios 2018) ====================
const parsedCoursesData = [
  // CICLO 1
  { codigo: '1939', ciclo: 1, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INTRODUCCION A LA INGENIERIA DE SISTEMAS', t: 3, p: 2, l: 0, c: 2, departamento: 'Ing. de Sistemas' },
  { codigo: '2347', ciclo: 1, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INTRODUCCION A LA PROGRAMACION', t: 1, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '1854', ciclo: 1, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'DESARROLLO PERSONAL', t: 2, p: 2, l: 0, c: 3, departamento: 'CC. Psicológicas' },
  { codigo: '1855', ciclo: 1, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'DESARROLLO DEL PENSAMIENTO LOGICO MATEMATICO', t: 1, p: 4, l: 0, c: 3, departamento: 'Matemáticas' },
  { codigo: '1857', ciclo: 1, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'LECTURA CRITICA Y REDACCION DE TEXTOS ACADEMICOS', t: 2, p: 2, l: 0, c: 3, departamento: 'Lengua Nacional y Literatura' },
  { codigo: '1863', ciclo: 1, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'INTRODUCCION AL ANALISIS MATEMATICO', t: 2, p: 4, l: 0, c: 4, departamento: 'Matemáticas' },
  { codigo: '1867', ciclo: 1, tipoCurso: 'EG_OP' as TipoCursoUNT, nombre: 'ESTADISTICA GENERAL', t: 2, p: 4, l: 0, c: 4, departamento: 'Estadística' },
  { codigo: '1883', ciclo: 1, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE TECNICAS DE COMUNICACION EFICAZ', t: 0, p: 2, l: 0, c: 1, departamento: 'Lengua Nacional y Literatura' },
  { codigo: '1884', ciclo: 1, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE MUSICA', t: 0, p: 2, l: 0, c: 1, departamento: 'CC. Psicológicas' },
  { codigo: '1908', ciclo: 1, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE LIDERAZGO Y TRABAJO EN EQUIPO', t: 0, p: 2, l: 0, c: 1, departamento: 'CC. Psicológicas' },
  { codigo: '2055', ciclo: 1, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE DEPORTE (I)', t: 0, p: 2, l: 0, c: 1, departamento: 'Lengua Nacional y Literatura' },
  { codigo: '2056', ciclo: 1, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE TEATRO', t: 0, p: 2, l: 0, c: 1, departamento: 'CC. Psicológicas' },
  // CICLO 2
  { codigo: '2051', ciclo: 2, tipoCurso: 'O' as TipoCursoUNT, nombre: 'PROGRAMACION ORIENTADO A OBJETOS I', t: 2, p: 0, l: 4, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '1858', ciclo: 2, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'SOCIEDAD CULTURA Y ECOLOGIA', t: 1, p: 4, l: 0, c: 3, departamento: 'CC. Psicológicas' },
  { codigo: '1859', ciclo: 2, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'CULTURA INVESTIGATIVA Y PENSAMIENTO CRITICO', t: 2, p: 2, l: 0, c: 3, departamento: 'Lengua Nacional y Literatura' },
  { codigo: '1860', ciclo: 2, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'ETICA, CONVIVENCIA HUMANA Y CIUDADANIA', t: 2, p: 2, l: 0, c: 3, departamento: 'CC. Psicológicas' },
  { codigo: '1861', ciclo: 2, tipoCurso: 'EG_OB' as TipoCursoUNT, nombre: 'ANALISIS MATEMATICO', t: 2, p: 4, l: 0, c: 4, departamento: 'Matemáticas' },
  { codigo: '1875', ciclo: 2, tipoCurso: 'EG_OP' as TipoCursoUNT, nombre: 'FISICA GENERAL', t: 2, p: 4, l: 0, c: 4, departamento: 'Física' },
  { codigo: '1888', ciclo: 2, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE MANEJO DE TIC', t: 0, p: 2, l: 0, c: 1, departamento: 'Ing. de Sistemas' },
  { codigo: '1889', ciclo: 2, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE DANZAS FOLCLORICAS', t: 0, p: 2, l: 0, c: 1, departamento: 'CC. Psicológicas' },
  { codigo: '1890', ciclo: 2, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE DEPORTE (II)', t: 0, p: 2, l: 0, c: 1, departamento: 'Lengua Nacional y Literatura' },
  { codigo: '2057', ciclo: 2, tipoCurso: 'EG_EL' as TipoCursoUNT, nombre: 'TALLER DE MUSICA II', t: 0, p: 2, l: 0, c: 1, departamento: 'CC. Psicológicas' },
  // CICLO 3
  { codigo: '2140', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ADMINISTRACION GENERAL', t: 2, p: 2, l: 0, c: 3, departamento: 'Administración' },
  { codigo: '2141', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMICA', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2142', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ESTADISTICA APLICADA', t: 1, p: 2, l: 2, c: 3, departamento: 'Estadística' },
  { codigo: '2143', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'MATEMATICA APLICADA', t: 1, p: 2, l: 2, c: 3, departamento: 'Matemáticas' },
  { codigo: '2144', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'FISICA ELECTRONICA', t: 1, p: 2, l: 2, c: 3, departamento: 'Física' },
  { codigo: '2145', ciclo: 3, tipoCurso: 'O' as TipoCursoUNT, nombre: 'PROGRAMACION ORIENTADA A OBJETOS II', t: 2, p: 0, l: 4, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '2146', ciclo: 3, tipoCurso: 'E' as TipoCursoUNT, nombre: 'INGENIERIA GRAFICA', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2147', ciclo: 3, tipoCurso: 'E' as TipoCursoUNT, nombre: 'SICOLOGIA ORGANIZACIONAL', t: 2, p: 2, l: 0, c: 3, departamento: 'CC. Psicológicas' },
  // CICLO 4
  { codigo: '2650', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ECONOMIA GENERAL', t: 2, p: 2, l: 0, c: 3, departamento: 'Administración' },
  { codigo: '2651', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'DISEÑO WEB', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2652', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'PENSAMIENTO DE DISEÑO', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2653', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'GESTION DE PROCESOS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2654', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMAS DIGITALES', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2655', ciclo: 4, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ESTRUCTURA DE DATOS ORIENTADO A OBJETOS', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '2656', ciclo: 4, tipoCurso: 'E' as TipoCursoUNT, nombre: 'COMPUTACION GRAFICA Y VISUAL', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2657', ciclo: 4, tipoCurso: 'E' as TipoCursoUNT, nombre: 'PLATAFORMAS TECNOLOGICAS', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  // CICLO 5
  { codigo: '2689', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'CONTABILIDAD GERENCIAL', t: 1, p: 2, l: 2, c: 3, departamento: 'Contabilidad y Finanzas' },
  { codigo: '2690', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'TECNOLOGIAS WEB', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2691', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INVESTIGACION DE OPERACIONES', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. Industrial' },
  { codigo: '2692', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA DE DATOS I', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '2693', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ARQUITECTURA Y ORGANIZACION DE COMPUTADORAS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2694', ciclo: 5, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMAS DE INFORMACION', t: 2, p: 2, l: 2, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '2695', ciclo: 5, tipoCurso: 'E' as TipoCursoUNT, nombre: 'TELEINFORMATICA', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '2696', ciclo: 5, tipoCurso: 'E' as TipoCursoUNT, nombre: 'TRANSFORMACION DIGITAL', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  // CICLO 6
  { codigo: '3125', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'FINANZAS CORPORATIVAS', t: 1, p: 2, l: 2, c: 3, departamento: 'Contabilidad y Finanzas' },
  { codigo: '3126', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMAS INTELIGENTES', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3127', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA ECONOMICA', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. Industrial' },
  { codigo: '3128', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA DE DATOS II', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '3129', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMAS OPERATIVOS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3130', ciclo: 6, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA DE REQUERIMIENTOS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3131', ciclo: 6, tipoCurso: 'E' as TipoCursoUNT, nombre: 'INGENIERIA AMBIENTAL', t: 2, p: 2, l: 0, c: 3, departamento: 'Ing. Industrial' },
  { codigo: '3132', ciclo: 6, tipoCurso: 'E' as TipoCursoUNT, nombre: 'GESTION DEL TALENTO HUMANO', t: 2, p: 2, l: 0, c: 3, departamento: 'Administración' },
  // CICLO 7
  { codigo: '3444', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'CADENA DE SUMINISTRO', t: 2, p: 2, l: 0, c: 3, departamento: 'Ing. Industrial' },
  { codigo: '3445', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'GESTION DE SERVICIOS DE TIC', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3446', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'METODOLOGIA DE LA INVESTIGACION CIENTIFICA', t: 2, p: 2, l: 0, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3447', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'PLANEAMIENTO ESTRATEGICO DE LA INFORMACION', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3448', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'REDES Y COMUNICACIONES I', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3449', ciclo: 7, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA DEL SOFTWARE I', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '3450', ciclo: 7, tipoCurso: 'E' as TipoCursoUNT, nombre: 'ADMINISTRACION DE BASE DE DATOS', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '3451', ciclo: 7, tipoCurso: 'E' as TipoCursoUNT, nombre: 'NEGOCIOS ELECTRONICOS', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  // CICLO 8
  { codigo: '4482', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'MARKETING Y MEDIOS SOCIALES', t: 1, p: 2, l: 2, c: 3, departamento: 'Administración' },
  { codigo: '4483', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SEGURIDAD DE LA INFORMACION', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4484', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INTERNET DE LAS COSAS', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4485', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INTELIGENCIA DE NEGOCIOS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4486', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'REDES Y COMUNICACIONES II', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4487', ciclo: 8, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA DEL SOFTWARE II', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '4488', ciclo: 8, tipoCurso: 'E' as TipoCursoUNT, nombre: 'DEONTOLOGIA Y DERECHO INFORMATICO', t: 2, p: 2, l: 0, c: 3, departamento: 'Administración' },
  { codigo: '4489', ciclo: 8, tipoCurso: 'E' as TipoCursoUNT, nombre: 'ARQUITECTURA BASADA EN MICROSERVICIOS', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  // CICLO 9
  { codigo: '4490', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'GESTION DE PROYECTOS DE TIC', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4491', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'AUDITORIA INFORMATICA', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4492', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'TESIS I', t: 2, p: 2, l: 2, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '4493', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ANALITICA DE NEGOCIOS', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4494', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'COMPUTACION EN LA NUBE', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4495', ciclo: 9, tipoCurso: 'O' as TipoCursoUNT, nombre: 'INGENIERIA WEB', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4496', ciclo: 9, tipoCurso: 'E' as TipoCursoUNT, nombre: 'EMPRENDEDURISMO TECNOLOGICO', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4497', ciclo: 9, tipoCurso: 'E' as TipoCursoUNT, nombre: 'HACKEO ETICO', t: 2, p: 0, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  // CICLO 10
  { codigo: '4498', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'SISTEMAS DE INFORMACION EMPRESARIAL', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '4499', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'GOBIERNO DE TIC', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4501', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'ARQUITECTURA EMPRESARIAL', t: 1, p: 2, l: 2, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4502', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'RESPONSABILIDAD SOCIAL CORPORATIVA', t: 2, p: 2, l: 0, c: 3, departamento: 'Ing. Industrial' },
  { codigo: '4503', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'APLICACIONES MOVILES', t: 1, p: 1, l: 3, c: 3, departamento: 'Ing. de Sistemas' },
  { codigo: '4504', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'PRACTICAS PRE PROFESIONALES', t: 2, p: 1, l: 3, c: 4, departamento: 'Ing. de Sistemas' },
  { codigo: '5265', ciclo: 10, tipoCurso: 'O' as TipoCursoUNT, nombre: 'TRABAJO DE INVESTIGACION', t: 2, p: 2, l: 2, c: 4, departamento: 'Ing. de Sistemas' },
];

// ==================== FUNCIONES AUXILIARES ====================

const cleanStr = (str: string): string =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const normalizarAmbiente = (nombre: string): { codigo: string; nombre: string; tipo: TipoAmbiente } => {
  const n = nombre.trim().replace(/\s+/g, ' ');
  if (n.includes('Posgrado A-307') || n.includes('posgrado A-307')) return { codigo: 'A-307', nombre: 'Posgrado A-307', tipo: TipoAmbiente.AULA };
  if (n.includes('Posgrado A-303') || n.includes('posgrado A-303')) return { codigo: 'A-303', nombre: 'Posgrado A-303', tipo: TipoAmbiente.AULA };
  if (n.includes('Posgrado A-311') || n.includes('posgrado A-311')) return { codigo: 'A-311', nombre: 'Posgrado A-311', tipo: TipoAmbiente.AULA };
  if (/[Ll]ab\.?\s*1|Lab\s*1\b/.test(n)) return { codigo: 'Lab-1', nombre: 'Laboratorio 1', tipo: TipoAmbiente.LABORATORIO };
  if (/[Ll]ab\.?\s*2|Lab\s*2\b/.test(n)) return { codigo: 'Lab-2', nombre: 'Laboratorio 2', tipo: TipoAmbiente.LABORATORIO };
  if (/[Ll]ab\.?\s*3|Lab\s*3\b/.test(n)) return { codigo: 'Lab-3', nombre: 'Laboratorio 3', tipo: TipoAmbiente.LABORATORIO };
  if (/[Ll]ab\.?\s*4|Lab\s*4\b/.test(n)) return { codigo: 'Lab-4', nombre: 'Laboratorio 4', tipo: TipoAmbiente.LABORATORIO };
  if (/[Ll]ab\.?\s*[Ff]isica/.test(n)) return { codigo: 'Lab-Fisica', nombre: 'Laboratorio de Física', tipo: TipoAmbiente.LABORATORIO };
  if (n.toLowerCase().includes('taller confecciones') || n.toLowerCase().includes('taller de confecciones'))
    return { codigo: 'Lab-Taller', nombre: 'Taller de Confecciones Ing. Industrial', tipo: TipoAmbiente.LABORATORIO };
  if (n.includes('I-4')) return { codigo: 'I-4', nombre: 'Aula I-4', tipo: TipoAmbiente.AULA };
  if (n.includes('I-5')) return { codigo: 'I-5', nombre: 'Aula I-5', tipo: TipoAmbiente.AULA };
  if (n === 'LAB') return { codigo: 'Lab-Gral', nombre: 'Laboratorio General', tipo: TipoAmbiente.LABORATORIO };
  if (/I\s*I[\s-]*2/.test(n)) return { codigo: 'II-2', nombre: 'Aula II-2 (Pabellón Ing. Industrial)', tipo: TipoAmbiente.AULA };
  if (n.toLowerCase().includes('audiovisuales')) return { codigo: 'AUD', nombre: 'Sala Audiovisuales', tipo: TipoAmbiente.AUDITORIO };
  if (n.toLowerCase().includes('posgrado b-104')) return { codigo: 'B-104', nombre: 'Posgrado B-104', tipo: TipoAmbiente.AULA };
  if (n.toLowerCase().includes('posgrado b-105')) return { codigo: 'B-105', nombre: 'Posgrado B-105', tipo: TipoAmbiente.AULA };
  if (n.toLowerCase().includes('posgrado b-304')) return { codigo: 'B-304', nombre: 'Posgrado B-304', tipo: TipoAmbiente.AULA };
  const cleanCode = n.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15);
  return { codigo: cleanCode, nombre: n, tipo: TipoAmbiente.AULA };
};

const mapCicloRomano = (ciclo: string): number => {
  const map: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
  return map[ciclo.trim()] ?? 1;
};

const mapDia = (dia: string): DiaSemana => {
  const d = dia.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (d === 'MIERCOLES') return DiaSemana.MIERCOLES;
  if (d === 'SABADO') return DiaSemana.SABADO;
  return d as DiaSemana;
};

const mapHora = (hora: string): string => {
  const [h, m] = hora.trim().split(':');
  let hNum = parseInt(h, 10);
  if (hNum < 7) hNum += 12;  // 2:00 -> 14:00, etc.
  return `${hNum.toString().padStart(2, '0')}:${m || '00'}`;
};

// ==================== PROCEDIMIENTO PRINCIPAL ====================

async function main() {
  console.log('🌱 Iniciando generación de datos semilla (v3 - Plan Oficial 2018)...');

  // ==================== LIMPIEZA COMPLETA ====================
  console.log('🗑️  Limpiando datos anteriores...');
  // Limpiar en orden correcto respetando dependencias de FK (CASCADE lo maneja todo desde las raíces)
  await prisma.$executeRawUnsafe('TRUNCATE TABLE horarios, validaciones_horarios, incumplimientos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE matriculas CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE curso_docente_grupos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE cursos_docentes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE plan_estudio_cursos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE planes_estudio CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE cursos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE estudiantes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE disponibilidad_docentes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE preferencias_notificaciones CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE atencion_ventanas CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE ventanas_atencion CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE declaraciones_no_lectiva CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE distribuciones_no_lectivas CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE cargos_administrativos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE becas_docentes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE comisiones_servicio CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE docentes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE ambientes CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE periodos_academicos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE grupos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE selecciones_temporales CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE notificaciones CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE chat_sesiones CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE registros_auditoria CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sesiones CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE usuarios CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE departamentos_academicos CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE facultades CASCADE');
  console.log('✅ Limpieza completa');

  // ==================== PARSEO DE TABLA DE HORARIOS ====================
  const lines = rawSchedulesText.trim().split('\n').filter(l => l.trim() !== '');
  const parsedSchedules = lines.map(line => {
    const cols = line.split(/\t/);
    const codigoHorario = (cols[0] || '').trim();
    const codigoOficial = codigoHorarioToOficial[codigoHorario] || null;
    const ambienteStr = (cols[4] || '').trim();
    const esLaboratorio = ambienteStr.toLowerCase().includes('lab') || ambienteStr === 'LAB';
    const tipoComponente: 'TEORIA' | 'PRACTICA' | 'LABORATORIO' = esLaboratorio ? 'LABORATORIO' : 'TEORIA';
    return {
      codigoHorario,
      codigoOficial,
      curso: (cols[1] || '').trim(),
      cicloRomano: (cols[2] || '').trim(),
      docente: (cols[3] || '').trim(),
      ambiente: ambienteStr,
      dia: (cols[5] || '').trim(),
      inicio: (cols[6] || '').trim(),
      fin: (cols[7] || '').trim(),
      grupo: (cols[8] || '').trim(),
      estado: (cols[9] || '').trim(),
      tipoComponente,
    };
  }).filter(s => {
    const docenteLower = s.docente.toLowerCase();
    if (docenteLower.includes('marcelino torres')) return false; // PRINCIPAL
    if (docenteLower.includes('alberto mendoza')) return false; // ASOCIADO
    if (docenteLower.includes('bertha urtecho')) return false; // AUXILIAR
    return true;
  });

  const noMapeados = parsedSchedules.filter(s => !s.codigoOficial);
  if (noMapeados.length > 0) {
    console.warn('⚠️  Los siguientes códigos de horario no tienen mapa a curso oficial:', [...new Set(noMapeados.map(s => s.codigoHorario))]);
  }
  console.log(`📊 Total registros de horario: ${parsedSchedules.length}, mapeados: ${parsedSchedules.filter(s => s.codigoOficial).length}`);

  // ==================== PERIODO Y PLAN DE ESTUDIOS ====================
  const periodo = await prisma.periodoAcademico.create({
    data: {
      nombre: '2026-I',
      fechaInicio: new Date('2026-04-01'),
      fechaFin: new Date('2026-07-31'),
      estado: EstadoPeriodo.ACTIVO,
      activo: true,
    }
  });
  console.log(`✅ Período académico creado: ${periodo.nombre}`);

  const planEstudio = await prisma.planEstudio.create({
    data: {
      nombre: 'PLAN DE ESTUDIOS DE INGENIERIA DE SISTEMAS 2018',
      anio: 2018,
      activo: true,
    }
  });
  console.log(`✅ Plan de estudios creado: ${planEstudio.nombre}`);

  // ==================== GRUPOS ESTÁTICOS ====================
  const gruposEstaticos = [];
  for (const nombre of ['A', 'B', 'C']) {
    const g = await prisma.grupo.create({ data: { nombre } });
    gruposEstaticos.push(g);
  }
  console.log('✅ Grupos estáticos creados: A, B, C');

  // ==================== USUARIOS ADMINISTRATIVOS ====================
  const passwordHash = await bcrypt.hash('unt123456', 12);

  const adminUser = await prisma.usuario.create({
    data: { email: 'secretaria@unitru.edu.pe', password: passwordHash, nombre: 'Secretaria', apellidos: 'Sistema', rol: Rol.SECRETARIA, verificado: true }
  });
  await prisma.usuario.create({
    data: { email: 'operador@unitru.edu.pe', password: passwordHash, nombre: 'Operador', apellidos: 'Sistema', rol: Rol.OPERADOR, verificado: true }
  });
  await prisma.usuario.create({
    data: { email: 'admin@unitru.edu.pe', password: passwordHash, nombre: 'Administrador', apellidos: 'Sistema', rol: Rol.ADMINISTRADOR, verificado: true }
  });
  await prisma.usuario.create({
    data: { email: 'monitor@unitru.edu.pe', password: passwordHash, nombre: 'Monitor', apellidos: 'Sistema', rol: Rol.MONITOR, verificado: true }
  });
  console.log('✅ Usuarios administrativos creados');

  // ==================== FACULTADES ====================
  const facultadesDef = [
    { nombre: 'Facultad de Ingeniería', decano: 'Dr. Donato Cárdenas Alayo' },
    { nombre: 'Facultad de Ciencias Físicas y Matemáticas', decano: 'Dr. Edwin L. Arroyo Cruz' },
    { nombre: 'Facultad de Ciencias Sociales', decano: 'Dra. Elena Gonzales Medina' },
    { nombre: 'Facultad de Educación y CC. de la Comunicación', decano: 'Dr. Jorge Flores Ruiz' },
    { nombre: 'Facultad de Ciencias Económicas', decano: 'Dr. Manuel Ramos Quiroz' },
  ];
  const facultadesMap: Record<string, any> = {};
  for (const fac of facultadesDef) {
    const f = await prisma.facultad.create({ data: fac });
    facultadesMap[fac.nombre] = f;
  }
  console.log('✅ Facultades creadas');

  // ==================== DEPARTAMENTOS ====================
  // Todos los departamentos usados en parsedCoursesData + docentes
  const deptosDef: { nombre: string; facultadNombre: string; jefe?: string }[] = [
    { nombre: 'Ing. de Sistemas', facultadNombre: 'Facultad de Ingeniería', jefe: 'Dr. Marcelino Torres Villanueva' },
    { nombre: 'Ing. Industrial', facultadNombre: 'Facultad de Ingeniería', jefe: 'Dr. Marcos Baca López' },
    { nombre: 'CC. Psicológicas', facultadNombre: 'Facultad de Ciencias Sociales', jefe: 'Dra. Bertha Urtecho Zavaleta' },
    { nombre: 'Matemáticas', facultadNombre: 'Facultad de Ciencias Físicas y Matemáticas', jefe: 'Dr. Jose Luis Ponte Bejarano' },
    { nombre: 'Física', facultadNombre: 'Facultad de Ciencias Físicas y Matemáticas', jefe: 'Dra. Vilma Méndez Gil' },
    { nombre: 'Estadística', facultadNombre: 'Facultad de Ciencias Físicas y Matemáticas', jefe: 'Dr. Miguel Ipanaque Zapata' },
    { nombre: 'Lengua Nacional y Literatura', facultadNombre: 'Facultad de Educación y CC. de la Comunicación', jefe: 'Dr. Jorge Luis Rios Gonzales' },
    { nombre: 'Administración', facultadNombre: 'Facultad de Ciencias Económicas', jefe: 'Dr. Juan Carrascal Cabanillas' },
    { nombre: 'Contabilidad y Finanzas', facultadNombre: 'Facultad de Ciencias Económicas', jefe: 'Dra. Ana Cuadra Mitzugaray' },
  ];

  const deptsMap: Record<string, any> = {};
  for (const dept of deptosDef) {
    const fac = facultadesMap[dept.facultadNombre];
    const d = await prisma.departamentoAcademico.create({
      data: { nombre: dept.nombre, facultadId: fac.id, jefeDepartamento: dept.jefe }
    });
    deptsMap[dept.nombre] = d;
  }
  console.log('✅ Departamentos académicos creados');

  const getDeptId = (nombre: string): number => {
    return deptsMap[nombre]?.id ?? deptsMap['Ing. de Sistemas'].id;
  };

  // ==================== DOCENTES ====================
  const docentesData = [
    // Ciclo I
    { email: 'marcelino.torres@unitru.edu.pe', nombre: 'Marcelino', apellidos: 'Torres Villanueva', codigo: 'DOC001', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas', dni: '70000001', fechaIngreso: '1998-03-15' },
    { email: 'alberto.mendoza@unitru.edu.pe', nombre: 'Alberto', apellidos: 'Mendoza de los Santos', codigo: 'DOC002', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000002', fechaIngreso: '2008-04-05' },
    { email: 'paul.cotrina@unitru.edu.pe', nombre: 'Paul', apellidos: 'Cotrina Castellanos', codigo: 'DOC003', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000003', fechaIngreso: '2012-08-14' },
    { email: 'bertha.urtecho@unitru.edu.pe', nombre: 'Bertha', apellidos: 'Urtecho Zavaleta', codigo: 'DOC004', categoria: CategoriaDocente.AUXILIAR, departamento: 'CC. Psicológicas', dni: '70000004', fechaIngreso: '2017-04-12' },
    { email: 'jose.ponte@unitru.edu.pe', nombre: 'Jose Luis', apellidos: 'Ponte Bejarano', codigo: 'DOC005', categoria: CategoriaDocente.ASOCIADO, departamento: 'Matemáticas', dni: '70000005', fechaIngreso: '2001-08-20' },
    { email: 'jorge.rios@unitru.edu.pe', nombre: 'Jorge Luis', apellidos: 'Rios Gonzales', codigo: 'DOC006', categoria: CategoriaDocente.AUXILIAR, departamento: 'Lengua Nacional y Literatura', dni: '70000006', fechaIngreso: '2016-08-01' },
    { email: 'segundo.guibar@unitru.edu.pe', nombre: 'Segundo', apellidos: 'Guibar Obeso', codigo: 'DOC007', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Matemáticas', dni: '70000007', fechaIngreso: '1995-11-05' },
    { email: 'miguel.ipanaque@unitru.edu.pe', nombre: 'Miguel', apellidos: 'Ipanaque Zapata', codigo: 'DOC008', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Estadística', dni: '70000008', fechaIngreso: '2003-04-10' },
    { email: 'martha.cardoso@unitru.edu.pe', nombre: 'Martha', apellidos: 'Cardoso', codigo: 'DOC009', categoria: CategoriaDocente.AUXILIAR, departamento: 'Estadística', dni: '70000009', fechaIngreso: '2019-03-05' },
    // Ciclo III
    { email: 'zoraida.vidal@unitru.edu.pe', nombre: 'Zoraida', apellidos: 'Vidal Melgarejo', codigo: 'DOC010', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000010', fechaIngreso: '2009-03-01' },
    { email: 'everson.agreda@unitru.edu.pe', nombre: 'Everson David', apellidos: 'Agreda Gamboa', codigo: 'DOC011', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas', dni: '70000011', fechaIngreso: '1999-07-01' },
    { email: 'juan.obando@unitru.edu.pe', nombre: 'Juan Carlos', apellidos: 'Obando Roldan', codigo: 'DOC012', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000012', fechaIngreso: '2011-07-20' },
    { email: 'marcos.ferrer@unitru.edu.pe', nombre: 'Marcos', apellidos: 'Ferrer Reyna', codigo: 'DOC013', categoria: CategoriaDocente.ASOCIADO, departamento: 'Matemáticas', dni: '70000013', fechaIngreso: '2007-10-15' },
    { email: 'teresita.rojas@unitru.edu.pe', nombre: 'Teresita', apellidos: 'Rojas Garcia', codigo: 'DOC014', categoria: CategoriaDocente.AUXILIAR, departamento: 'Estadística', dni: '70000014', fechaIngreso: '2015-06-20' },
    { email: 'juan.carrascal@unitru.edu.pe', nombre: 'Juan', apellidos: 'Carrascal Cabanillas', codigo: 'DOC015', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Administración', dni: '70000015', fechaIngreso: '2000-02-28' },
    { email: 'vilma.mendez@unitru.edu.pe', nombre: 'Vilma', apellidos: 'Mendez Gil', codigo: 'DOC016', categoria: CategoriaDocente.ASOCIADO, departamento: 'Física', dni: '70000016', fechaIngreso: '2010-01-10' },
    { email: 'sheyla.laura@unitru.edu.pe', nombre: 'Sheyla', apellidos: 'Laura Escobedo Rodriguez', codigo: 'DOC017', categoria: CategoriaDocente.AUXILIAR, departamento: 'CC. Psicológicas', dni: '70000017', fechaIngreso: '2020-01-15' },
    // Ciclo V
    { email: 'luis.boy@unitru.edu.pe', nombre: 'Luis', apellidos: 'Boy Chavil', codigo: 'DOC018', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000018', fechaIngreso: '2004-09-12' },
    { email: 'robert.sanchez@unitru.edu.pe', nombre: 'Robert Jerry', apellidos: 'Sanchez Ticona', codigo: 'DOC019', categoria: CategoriaDocente.AUXILIAR, departamento: 'Ing. de Sistemas', dni: '70000019', fechaIngreso: '2018-09-10' },
    { email: 'cesar.arellano@unitru.edu.pe', nombre: 'Cesar', apellidos: 'Arellano Salazar', codigo: 'DOC020', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas', dni: '70000020', fechaIngreso: '1997-06-18' },
    { email: 'camilo.suarez@unitru.edu.pe', nombre: 'Camilo', apellidos: 'Suarez Rebaza', codigo: 'DOC021', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000021', fechaIngreso: '2013-05-25' },
    { email: 'marcos.baca@unitru.edu.pe', nombre: 'Marcos', apellidos: 'Baca Lopez', codigo: 'DOC022', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. Industrial', dni: '70000022', fechaIngreso: '2002-12-03' },
    { email: 'ana.cuadra@unitru.edu.pe', nombre: 'Ana', apellidos: 'Cuadra Mitzugaray', codigo: 'DOC023', categoria: CategoriaDocente.AUXILIAR, departamento: 'Contabilidad y Finanzas', dni: '70000023', fechaIngreso: '2014-02-18' },
    // Ciclo VII
    { email: 'juan.santos@unitru.edu.pe', nombre: 'Juan Pedro', apellidos: 'Santos Fernandez', codigo: 'DOC024', categoria: CategoriaDocente.PRINCIPAL, departamento: 'Ing. de Sistemas', dni: '70000024', fechaIngreso: '2005-03-22' },
    { email: 'ricardo.mendoza@unitru.edu.pe', nombre: 'Ricardo', apellidos: 'Mendoza Rivera', codigo: 'DOC025', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000025', fechaIngreso: '2006-09-08' },
    { email: 'oscar.alcantara@unitru.edu.pe', nombre: 'Oscar Romel', apellidos: 'Alcantara Moreno', codigo: 'DOC026', categoria: CategoriaDocente.AUXILIAR, departamento: 'Ing. de Sistemas', dni: '70000026', fechaIngreso: '2013-12-01' },
    { email: 'jhoe.gonzalez@unitru.edu.pe', nombre: 'Jhoe', apellidos: 'Gonzalez Vasquez', codigo: 'DOC027', categoria: CategoriaDocente.CONTRATADO, departamento: 'Ing. Industrial', dni: '70000027', fechaIngreso: '2022-04-01' },
    // Ciclo IX
    { email: 'jose.gomez@unitru.edu.pe', nombre: 'Jose', apellidos: 'Gomez Avila', codigo: 'DOC028', categoria: CategoriaDocente.ASOCIADO, departamento: 'Ing. de Sistemas', dni: '70000028', fechaIngreso: '2015-11-30' },
  ];

  const docentes: any[] = [];
  for (const dd of docentesData) {
    const user = await prisma.usuario.create({
      data: { email: dd.email, password: passwordHash, nombre: dd.nombre, apellidos: dd.apellidos, rol: Rol.DOCENTE, verificado: true }
    });
    const doc = await prisma.docente.create({
      data: {
        usuarioId: user.id,
        codigo: dd.codigo,
        categoria: dd.categoria,
        departamentoId: getDeptId(dd.departamento),
        dni: dd.dni,
        telefono: '999000000',
        fechaIngreso: new Date(dd.fechaIngreso),
        preferenciasNotificacion: { create: { correoActivo: true, whatsappActivo: false, telegramActivo: false, sistemaActivo: true } }
      }
    });
    docentes.push({ ...doc, nombre: dd.nombre, apellidos: dd.apellidos });
  }
  console.log(`✅ ${docentes.length} docentes creados`);

  // ==================== AMBIENTES DINÁMICOS ====================
  const ambientesMap = new Map<string, { codigo: string; nombre: string; tipo: TipoAmbiente }>();
  for (const item of parsedSchedules) {
    const norm = normalizarAmbiente(item.ambiente);
    if (!ambientesMap.has(norm.codigo)) ambientesMap.set(norm.codigo, norm);
  }

  const ambientes: any[] = [];
  for (const [, envInfo] of ambientesMap) {
    const a = await prisma.ambiente.create({
      data: { codigo: envInfo.codigo, nombre: envInfo.nombre, tipo: envInfo.tipo, capacidad: 40, ubicacion: 'Campus Universitario UNT' }
    });
    ambientes.push(a);
  }
  console.log(`✅ ${ambientes.length} ambientes creados`);

  // ==================== CURSOS DEL PLAN OFICIAL ====================
  // Crear cursos únicos (upsert por codigo)
  const cursosOficialMap = new Map<string, any>(); // codigo -> {curso, planEstudioCursoId}
  for (const cData of parsedCoursesData) {
    let curso = await prisma.curso.findUnique({ where: { codigo: cData.codigo } });
    if (!curso) {
      curso = await prisma.curso.create({ data: { codigo: cData.codigo, nombre: cData.nombre } });
    }
    const planCur = await prisma.planEstudioCurso.create({
      data: {
        planEstudioId: planEstudio.id,
        cursoId: curso.id,
        ciclo: cData.ciclo,
        tipoCurso: cData.tipoCurso,
        horasTeoria: cData.t,
        horasPractica: cData.p,
        horasLaboratorio: cData.l,
        creditos: cData.c,
        departamentoId: getDeptId(cData.departamento),
      }
    });
    cursosOficialMap.set(cData.codigo, { ...curso, planEstudioCursoId: planCur.id, ciclo: cData.ciclo, horasTotal: cData.t + cData.p + cData.l });
  }
  console.log(`✅ ${cursosOficialMap.size} cursos del Plan de Estudios 2018 creados`);

  // ==================== ASIGNACIONES CURSO-DOCENTE ====================
  // Mapear horarios: codigoHorario -> codigoOficial -> cursoInfo
  const assignmentsMap = new Map<string, {
    planEstudioCursoId: string;
    docenteId: string;
    grupos: Set<string>;
    horasAsignadas: number;
  }>();

  for (const item of parsedSchedules) {
    if (!item.codigoOficial) continue;

    const cursoInfo = cursosOficialMap.get(item.codigoOficial);
    if (!cursoInfo) {
      console.warn(`⚠️  Curso oficial ${item.codigoOficial} no encontrado en mapa`);
      continue;
    }

    // Buscar docente por nombre (normalizado)
    const docente = docentes.find(d => {
      const dbName = cleanStr(`${d.nombre} ${d.apellidos}`);
      const itemName = cleanStr(item.docente);
      return dbName === itemName || dbName.startsWith(itemName) || itemName.startsWith(dbName);
    });

    if (!docente) {
      console.warn(`⚠️  Docente no encontrado: "${item.docente}"`);
      continue;
    }

    const key = `${cursoInfo.planEstudioCursoId}_${docente.id}`;
    const [hIni] = item.inicio.split(':').map(Number);
    const [hFin] = item.fin.split(':').map(Number);
    const horas = Math.abs(hFin - hIni);

    if (assignmentsMap.has(key)) {
      assignmentsMap.get(key)!.horasAsignadas += horas;
      assignmentsMap.get(key)!.grupos.add(item.grupo);
    } else {
      assignmentsMap.set(key, {
        planEstudioCursoId: cursoInfo.planEstudioCursoId,
        docenteId: docente.id,
        grupos: new Set([item.grupo]),
        horasAsignadas: horas,
      });
    }
  }

  // Crear CursoDocente y CursoDocenteGrupo
  const cdgIndexMap = new Map<string, string>(); // `${planCursoId}_${docenteId}_${grupoNombre}` -> cursoDocenteGrupoId

  let totalAsignaciones = 0;
  for (const [, val] of assignmentsMap) {
    const cursoInfo = cursosOficialMap.get(
      [...cursosOficialMap.entries()].find(([, v]) => v.planEstudioCursoId === val.planEstudioCursoId)?.[0] ?? ''
    );
    const horasTotal = cursoInfo?.horasTotal ?? 4;

    const cd = await prisma.cursoDocente.create({
      data: {
        planEstudioCursoId: val.planEstudioCursoId,
        periodoId: periodo.id,
        docenteId: val.docenteId,
        horasAsignadas: horasTotal,
      }
    });

    for (const grupoNombre of val.grupos) {
      const gEstatico = gruposEstaticos.find(g => g.nombre === grupoNombre) ?? gruposEstaticos[0];
      const cdg = await prisma.cursoDocenteGrupo.create({
        data: { cursoDocenteId: cd.id, grupoId: gEstatico.id, capacidad: 40 }
      });
      cdgIndexMap.set(`${val.planEstudioCursoId}_${val.docenteId}_${grupoNombre}`, cdg.id);
    }
    totalAsignaciones++;
  }
  console.log(`✅ ${totalAsignaciones} asignaciones curso-docente creadas`);

  // ==================== DISPONIBILIDAD DE DOCENTES ====================
  const diasSemana: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  for (const docente of docentes) {
    for (const dia of diasSemana) {
      await prisma.disponibilidadDocente.create({
        data: { docenteId: docente.id, diaSemana: dia, horaInicio: '07:00', horaFin: '21:00', prioridad: 1 }
      });
    }
  }
  console.log('✅ Disponibilidad de docentes creada');

  // ==================== HORARIOS REALES ====================
  let totalHorariosCreados = 0;
  let totalHorariosOmitidos = 0;

  for (const item of parsedSchedules) {
    if (!item.codigoOficial) { totalHorariosOmitidos++; continue; }

    const cursoInfo = cursosOficialMap.get(item.codigoOficial);
    if (!cursoInfo) { totalHorariosOmitidos++; continue; }

    const docente = docentes.find(d => {
      const dbName = cleanStr(`${d.nombre} ${d.apellidos}`);
      const itemName = cleanStr(item.docente);
      return dbName === itemName || dbName.startsWith(itemName) || itemName.startsWith(dbName);
    });
    if (!docente) { totalHorariosOmitidos++; continue; }

    const cdgId = cdgIndexMap.get(`${cursoInfo.planEstudioCursoId}_${docente.id}_${item.grupo}`);
    if (!cdgId) { totalHorariosOmitidos++; continue; }

    const ambienteNorm = normalizarAmbiente(item.ambiente);
    const ambiente = ambientes.find(a => a.codigo === ambienteNorm.codigo);
    if (!ambiente) { totalHorariosOmitidos++; continue; }

    try {
      await prisma.horario.create({
        data: {
          periodoId: periodo.id,
          cursoDocenteGrupoId: cdgId,
          ambienteId: ambiente.id,
          diaSemana: mapDia(item.dia),
          horaInicio: mapHora(item.inicio),
          horaFin: mapHora(item.fin),
          tipoComponente: item.tipoComponente,
          estado: EstadoHorario.PUBLICADO,
          publicado: true,
          creadoPor: adminUser.id,
          confirmadoPor: adminUser.id,
          fechaConfirmacion: new Date(),
        }
      });
      totalHorariosCreados++;
    } catch (err: any) {
      console.warn(`⚠️  Error al crear horario ${item.codigoHorario} (${item.dia} ${item.inicio}-${item.fin}): ${err.message}`);
      totalHorariosOmitidos++;
    }
  }
  console.log(`✅ ${totalHorariosCreados} horarios creados (${totalHorariosOmitidos} omitidos)`);

  // ==================== ESTUDIANTES Y MATRÍCULAS ====================
  const estudiantesData = [
    { codigo: '1020100126', nombre: 'Carlos Alberto', apellidos: 'Sánchez Ruiz', email: 'csanchez@unitru.edu.pe', dni: '71234561', ciclo: 1 },
    { codigo: '1020100226', nombre: 'Ana Lucía', apellidos: 'Torres Paredes', email: 'atorres@unitru.edu.pe', dni: '71234562', ciclo: 1 },
    { codigo: '1020100326', nombre: 'Roberto Carlos', apellidos: 'García Mendoza', email: 'rgarcia@unitru.edu.pe', dni: '71234563', ciclo: 3 },
    { codigo: '1020100426', nombre: 'María Fernanda', apellidos: 'López Castro', email: 'mlopez@unitru.edu.pe', dni: '71234564', ciclo: 5 },
    { codigo: '1020100526', nombre: 'Diego Armando', apellidos: 'Morales Villa', email: 'dmorales@unitru.edu.pe', dni: '71234565', ciclo: 7 },
    { codigo: '1020100626', nombre: 'Valeria Andrea', apellidos: 'Rojas Pineda', email: 'vrojas@unitru.edu.pe', dni: '71234566', ciclo: 9 },
  ];

  const estudiantes: any[] = [];
  for (const est of estudiantesData) {
    const estudiante = await prisma.estudiante.create({ data: est });
    estudiantes.push(estudiante);
  }

  let totalMatriculas = 0;
  for (const estudiante of estudiantes) {
    // Buscar un curso del ciclo del estudiante que tenga CursoDocenteGrupo activo
    for (const [, cursoInfo] of cursosOficialMap) {
      if (cursoInfo.ciclo !== estudiante.ciclo) continue;
      // Buscar cdg para este curso
      const cdgKey = [...cdgIndexMap.entries()].find(([k]) => k.startsWith(cursoInfo.planEstudioCursoId + '_'));
      if (!cdgKey) continue;
      try {
        await prisma.matricula.create({
          data: {
            estudianteId: estudiante.id,
            cursoDocenteGrupoId: cdgKey[1],
            periodoId: periodo.id,
            estado: 'ACTIVO',
          }
        });
        totalMatriculas++;
        break; // 1 matrícula por estudiante para ejemplo
      } catch {
        // ignorar duplicados
      }
    }
  }
  console.log(`✅ ${estudiantes.length} estudiantes y ${totalMatriculas} matrículas creadas`);

  // ==================== REPORTE FINAL ====================
  console.log('\n🎉 ========== DATOS SEMILLA v3 GENERADOS ==========');
  console.log(`📊 Resumen:`);
  console.log(`   👨‍🏫 Docentes: ${docentes.length}`);
  console.log(`   📚 Cursos (Plan 2018): ${cursosOficialMap.size}`);
  console.log(`   🏛️  Ambientes: ${ambientes.length}`);
  console.log(`   📋 Asignaciones: ${totalAsignaciones}`);
  console.log(`   📅 Horarios confirmados: ${totalHorariosCreados}`);
  console.log(`   👨‍🎓 Estudiantes: ${estudiantes.length}`);
  console.log(`   📅 Período: ${periodo.nombre}`);
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error generando datos semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });