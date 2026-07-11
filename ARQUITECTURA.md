# Arquitectura Completa y Exhaustiva del Sistema E-PROJECT

Este documento es la representación más detallada y completa de la arquitectura del sistema, cubriendo todos los directorios del frontend, todos los módulos de servicios del backend, y absolutamente todas las entidades y atributos de la base de datos (Prisma Schema).

## 1. Arquitectura General e Infraestructura (C4)

**Explicación:** Este diagrama ilustra a un alto nivel cómo interactúan las piezas fundamentales de la aplicación. Muestra el flujo de información desde el cliente (Navegador y WebSocket), pasando por el framework Next.js (App Router y API Routes), hasta llegar a la capa de servicios backend, que a su vez orquesta la persistencia en la base de datos PostgreSQL mediante Prisma y el manejo de estado temporal en Redis.

```mermaid
graph TD
    Browser[Navegador del Usuario]
    WSClient[Cliente WebSocket]
    
    subgraph "Frontend (Next.js App Router)"
        Pages[Rutas src/app]
        Components[Componentes UI]
        Hooks[Custom Hooks]
        Contexts[React Contexts]
    end

    subgraph "Backend (Next.js Node Server)"
        APIRoutes[Rutas API src/app/api]
        Middlewares[Middlewares / Auth]
        Services[Capa de Servicios src/services]
        WSServer[Servidor WebSocket]
        PrismaORM[Prisma Client]
    end

    subgraph "Persistencia y Caché"
        PostgreSQL[(PostgreSQL - DB Principal)]
        Redis[(Redis - Selecciones Temporales)]
    end

    Browser -->|HTTP REST| Pages
    Browser -->|HTTP| APIRoutes
    WSClient <-->|Eventos Bidireccionales| WSServer
    
    Pages --> Components
    Components --> Hooks
    Hooks --> Contexts
    
    APIRoutes --> Middlewares
    Middlewares --> Services
    WSServer --> Services
    Services --> PrismaORM
    Services --> Redis
    PrismaORM --> PostgreSQL
```

## 2. Mapa de Directorios y Componentes Frontend

**Explicación:** Aquí se desglosa visualmente la estructura interna del código fuente del lado del cliente (`src/app` y `src/components`). Detalla cómo se agrupan funcionalmente los componentes de React, enrutamiento, hooks y contextos de la aplicación. Es útil para entender la jerarquía del frontend y la modularización de la interfaz, como los paneles de administración, herramientas de reportes y las grillas de horarios interactivas.

```mermaid
mindmap
  root((src))
    app
      api
      auth
      dashboard
      horarios
      vista_previa_reportes
    components
      admin
        PanelUsuarios
        ConfiguracionSistema
      auth
        FormLogin
        FormRecuperarPassword
      dashboard
        PanelResumen
        WidgetEstadisticas
      horarios
        GrillaHorario
        PanelDistribucionHoraria
        VisorConflictos
      layout
        DashboardShell
        Sidebar
        BarraSuperior
      notificaciones
        ColaNotificaciones
        ConfiguracionPlantillas
      reportes
        VisorPDF
        SelectorTipoReporte
      ventanas
        MonitorVentanas
        ControladorCola
      ui
        Boton
        Modal
        TablaDatos
    hooks
      useAuth
      useHorarios
      useWebsocket
      useTour
    lib
      formatters
      theme_storage
      validators
    contexts
      AuthContext
      ThemeContext
      PeriodoContext
```

## 3. Arquitectura Detallada de la Capa de Servicios (Backend)

**Explicación:** Este grafo detalla los dominios lógicos que conforman la capa de negocio del sistema, ubicados en `src/services`. La arquitectura basada en servicios permite aislar la lógica compleja (como el motor de asignación de horarios, validación de conflictos, y gestión de carga lectiva) de los controladores web (API Routes). Esto fomenta la reutilización del código, el testing modular y la escalabilidad de cada área.

```mermaid
graph LR
    subgraph "Capa de Servicios (src/services)"
        Auth[Auth]
        Auth --> AuthService
        Auth --> SesionService
        Auth --> TokenService
        
        Horarios[Horarios]
        Horarios --> ServicioHorario
        Horarios --> GestorDisponibilidad
        Horarios --> ValidadorConflictos
        Horarios --> MotorAsignacion
        
        Carga[Carga Académica]
        Carga --> CargaLectivaService
        Carga --> CargaNoLectivaService
        
        Ventanas[Ventanas Atención]
        Ventanas --> GestorVentanasAtencion
        Ventanas --> TemporizadorService
        Ventanas --> ControladorColaDocentes
        
        Reportes[Reportes y PDF]
        Reportes --> GeneradorPDF
        Reportes --> ReporteHorariosConfirmados
        Reportes --> ReporteCargaDocente
        
        Notif[Notificaciones]
        Notif --> GestorNotificaciones
        Notif --> ServicioWhatsApp
        Notif --> ServicioTelegram
        Notif --> ServicioCorreo
        
        Estadisticas[Estadísticas]
        Estadisticas --> GeneradorGraficos
        Estadisticas --> CalculadorEstadisticas
        
        WS[WebSocket]
        WS --> ServidorWebSocket
        WS --> CanalDisponibilidad
        WS --> CanalNotificaciones
    end
```

## 4. Diagrama ER Exhaustivo - Parte 1: Core Académico

**Explicación:** Este primer diagrama entidad-relación modela el núcleo de las operaciones universitarias de la plataforma. Define todas las entidades principales, atributos y restricciones (como llaves foráneas y primarias) necesarias para manejar facultades, departamentos académicos, planes de estudio, docentes, cursos, grupos, ambientes (aulas/laboratorios) y la entidad central de `HORARIO`.

```mermaid
erDiagram
    USUARIO {
        String id PK
        String email UK
        String password
        String nombre
        String apellidos
        Rol rol
        Boolean activo
        Boolean verificado
        Int tokenVersion
        DateTime ultimoAcceso
        DateTime createdAt
        DateTime updatedAt
    }

    SESION {
        String id PK
        String usuarioId FK
        String token UK
        String refreshToken UK
        DateTime expiraEn
        String ipAddress
        String userAgent
        Boolean activa
    }

    FACULTAD {
        Int id PK
        String nombre UK
        String decano
        DateTime fechaCreacion
    }

    DEPARTAMENTO_ACADEMICO {
        Int id PK
        String nombre
        Int facultadId FK
        String jefeDepartamento
    }

    DOCENTE {
        String id PK
        String usuarioId FK UK
        String codigo UK
        CategoriaDocente categoria
        DedicacionDocente dedicacion
        String dni UK
        Int departamentoId FK
        String telefono
        String whatsapp
        String telegramId
        Boolean verificadoWhatsapp
        Boolean verificadoTelegram
        DateTime fechaIngreso
    }

    CURSO {
        String id PK
        String codigo UK
        String nombre
        Boolean activo
    }

    PLAN_ESTUDIO {
        String id PK
        String nombre
        Int anio
        Boolean activo
    }

    PLAN_ESTUDIO_CURSO {
        String id PK
        String planEstudioId FK
        String cursoId FK
        Int ciclo
        Int creditos
        Int horasTeoria
        Int horasPractica
        Int horasLaboratorio
        TipoCursoUNT tipoCurso
        Int departamentoId FK
    }

    CURSO_DOCENTE {
        String id PK
        String planEstudioCursoId FK
        String docenteId FK
        String periodoId FK
        Int horasAsignadas
        Boolean activo
    }

    GRUPO {
        String id PK
        String nombre UK
        Boolean activo
    }

    CURSO_DOCENTE_GRUPO {
        String id PK
        String cursoDocenteId FK
        String grupoId FK
        Int capacidad
        Boolean activo
    }

    AMBIENTE {
        String id PK
        String codigo UK
        String nombre
        TipoAmbiente tipo
        Int capacidad
        String ubicacion
        TipoSede sede
        SedeDescentralizada sedeDescentralizadaRef
        Boolean activo
    }

    PERIODO_ACADEMICO {
        String id PK
        String nombre
        DateTime fechaInicio
        DateTime fechaFin
        EstadoPeriodo estado
        Boolean activo
    }

    HORARIO {
        String id PK
        String cursoDocenteGrupoId FK
        String periodoId FK
        String ambienteId FK
        TipoSede sede
        SedeDescentralizada sedeDescentralizadaRef
        DiaSemana diaSemana
        String horaInicio
        String horaFin
        TipoComponente tipoComponente
        EstadoHorario estado
        Boolean publicado
        String creadoPor
        DateTime fechaCreacion
        String confirmadoPor
        DateTime fechaConfirmacion
    }

    USUARIO ||--o{ SESION : "tiene"
    USUARIO ||--o| DOCENTE : "vinculado a"
    FACULTAD ||--o{ DEPARTAMENTO_ACADEMICO : "posee"
    DEPARTAMENTO_ACADEMICO ||--o{ DOCENTE : "aloja"
    CURSO ||--o{ PLAN_ESTUDIO_CURSO : "detallado en"
    PLAN_ESTUDIO ||--o{ PLAN_ESTUDIO_CURSO : "compuesto por"
    DEPARTAMENTO_ACADEMICO ||--o{ PLAN_ESTUDIO_CURSO : "gestiona"
    PLAN_ESTUDIO_CURSO ||--o{ CURSO_DOCENTE : "asignado a"
    DOCENTE ||--o{ CURSO_DOCENTE : "enseña"
    PERIODO_ACADEMICO ||--o{ CURSO_DOCENTE : "durante"
    CURSO_DOCENTE ||--o{ CURSO_DOCENTE_GRUPO : "dividido en"
    GRUPO ||--o{ CURSO_DOCENTE_GRUPO : "instanciado en"
    CURSO_DOCENTE_GRUPO ||--o{ HORARIO : "programado como"
    PERIODO_ACADEMICO ||--o{ HORARIO : "vigente en"
    AMBIENTE ||--o{ HORARIO : "ubicado en"
```

## 5. Diagrama ER Exhaustivo - Parte 2: Administrativo, Validaciones y Auditoría

**Explicación:** Este segundo diagrama abarca toda la información auxiliar, de cumplimiento y auditoría. Mapea cómo el sistema registra la carga docente no lectiva, comisiones de servicio, disponibilidad de docentes, incidencias (incumplimientos de los horarios), sistema de colas y turnos virtuales (ventanas de atención), envíos de notificaciones multicanal, y los registros exhaustivos de auditoría de actividad dentro del sistema.

```mermaid
erDiagram
    CARGO_ADMINISTRATIVO {
        String id PK
        String docenteId FK
        TipoCargoAdministrativo tipoCargo
        DateTime fechaInicio
        DateTime fechaFin
        Boolean activo
        String resolucion
        String observaciones
    }

    BECA_DOCENTE {
        String id PK
        String docenteId FK
        TipoBeca tipoBeca
        DateTime fechaInicio
        DateTime fechaFin
        String institucion
        String resolucion
        Boolean activo
    }

    COMISION_SERVICIO {
        String id PK
        String docenteId FK
        SedeDescentralizada sedeDestino
        DateTime fechaInicio
        DateTime fechaFin
        String licenciaDocumento
        String docenteReemplazoId FK
        Boolean activo
    }

    DECLARACION_NO_LECTIVA {
        String id PK
        String docenteId FK
        String periodoId FK
        DateTime fechaDeclaracion
        Int totalHoras
        String observaciones
    }

    DECLARACION_NO_LECTIVA_ITEM {
        String id PK
        String declaracionId FK
        TipoActividadNoLectiva tipoActividad
        Int horasSemanales
        String descripcion
        Json metadata
    }

    DISPONIBILIDAD_DOCENTE {
        String id PK
        String docenteId FK
        DiaSemana diaSemana
        String horaInicio
        String horaFin
        Int prioridad
    }

    RESTRICCION_AMBIENTE {
        String id PK
        String ambienteId FK
        DiaSemana diaSemana
        String horaInicio
        String horaFin
        String motivo
    }

    VALIDACION_HORARIO {
        String id PK
        String horarioId FK
        TipoReglaValidacion tipoRegla
        Boolean cumple
        String mensaje
        Json metadata
    }

    INCUMPLIMIENTO {
        String id PK
        String docenteId FK
        String horarioId FK
        TipoReglaValidacion tipoRegla
        String descripcion
        EstadoIncumplimiento estado
        String detectadoPor
        String sancionAplicada
        String resolucion
    }

    VENTANA_ATENCION {
        String id PK
        String periodoId FK
        String nombre
        Json categorias
        DateTime fechaInicio
        DateTime fechaFin
        EstadoVentana estado
    }

    ATENCION_VENTANA {
        String id PK
        String ventanaId FK
        String docenteId FK
        Int posicion
        EstadoAtencion estado
        DateTime horaInicio
        DateTime horaFin
    }

    NOTIFICACION {
        String id PK
        String usuarioId FK
        TipoNotificacion tipo
        String titulo
        String mensaje
        PrioridadNotificacion prioridad
        CanalNotificacion canal
        EstadoNotificacion estado
        Json metadata
    }

    ENVIO_NOTIFICACION {
        String id PK
        String notificacionId FK
        CanalNotificacion canal
        EstadoNotificacion estado
        Int intento
        String error
        DateTime enviadoEn
    }

    PREFERENCIAS_NOTIFICACION {
        String id PK
        String docenteId FK UK
        Boolean correoActivo
        Boolean whatsappActivo
        Boolean telegramActivo
        Boolean sistemaActivo
        Int frecuenciaMaxDiaria
    }

    REGISTRO_AUDITORIA {
        String id PK
        String usuarioId FK
        String accion
        String entidad
        String entidadId
        Json datos
        String ipAddress
        DateTime createdAt
    }

    CONFIGURACION_PERIODO {
        String id PK
        String periodoId FK UK
        Int horasMaxDiariasDocente
        Int horasMaxContinuas
        Int descansoMinEntreHoras
        Json ordenCategorias
    }

    CHAT_SESION {
        String id PK
        String usuarioId FK
        String titulo
    }

    CHAT_MENSAJE {
        String id PK
        String sesionId FK
        String role
        String contenido
    }

    DOCENTE ||--o{ CARGO_ADMINISTRATIVO : "ocupa"
    DOCENTE ||--o{ BECA_DOCENTE : "obtiene"
    DOCENTE ||--o{ COMISION_SERVICIO : "es comisionado a"
    DOCENTE ||--o{ DECLARACION_NO_LECTIVA : "realiza"
    DECLARACION_NO_LECTIVA ||--o{ DECLARACION_NO_LECTIVA_ITEM : "contiene"
    DOCENTE ||--o{ DISPONIBILIDAD_DOCENTE : "informa"
    AMBIENTE ||--o{ RESTRICCION_AMBIENTE : "bloqueado por"
    HORARIO ||--o{ VALIDACION_HORARIO : "sujeto a"
    DOCENTE ||--o{ INCUMPLIMIENTO : "infringe"
    HORARIO ||--o{ INCUMPLIMIENTO : "relacionado a"
    PERIODO_ACADEMICO ||--o{ VENTANA_ATENCION : "abre"
    VENTANA_ATENCION ||--o{ ATENCION_VENTANA : "organiza turnos de"
    DOCENTE ||--o{ ATENCION_VENTANA : "recibe turno"
    USUARIO ||--o{ NOTIFICACION : "recibe"
    NOTIFICACION ||--o{ ENVIO_NOTIFICACION : "ejecuta a través de"
    DOCENTE ||--o| PREFERENCIAS_NOTIFICACION : "configura"
    USUARIO ||--o{ REGISTRO_AUDITORIA : "registra"
    PERIODO_ACADEMICO ||--o| CONFIGURACION_PERIODO : "estipula"

    USUARIO ||--o{ CHAT_SESION : "conversa en"
    CHAT_SESION ||--o{ CHAT_MENSAJE : "contiene"
```
