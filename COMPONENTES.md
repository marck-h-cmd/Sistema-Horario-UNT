# Estructura de Componentes del Sistema E-PROJECT

Los diagramas presentados a continuación representan la arquitectura de componentes del sistema E-PROJECT. **Sí, son los diagramas correctos e indicados** porque reflejan de forma precisa la separación de responsabilidades, la alta cohesión y el bajo acoplamiento que provee el framework Next.js (App Router) tanto en el cliente (Frontend) como en el servidor (Backend).

## 1. Diagrama de Componentes a Nivel de Sistema (Alto Nivel)

**Explicación:**
Este diagrama muestra los grandes bloques funcionales (macro-componentes) del sistema completo y cómo se comunican a través de interfaces bien definidas. Es la representación ideal para entender la topología del sistema.
- **Cliente Web:** El punto de entrada para los usuarios (navegador).
- **Frontend App (Next.js React):** Renderiza las interfaces gráficas, maneja el estado del lado del cliente y realiza peticiones asíncronas.
- **Backend API (Next.js Routes):** Actúa como middleware; recibe las solicitudes HTTP del frontend y valida la seguridad/autenticación.
- **Capa de Servicios:** Contiene toda la lógica de negocio pura y pesada.
- **Infraestructura de Datos:** Prisma ORM, PostgreSQL y Redis, que son los encargados de la persistencia de datos y la caché.
- **WebSocket Server:** Maneja la comunicación bidireccional en tiempo real (esencial para bloquear horarios simultáneamente entre varios docentes).

```mermaid
graph TD
    subgraph Cliente
        C[Cliente Web / Navegador]
    end

    subgraph Aplicacion Next.js
        subgraph Frontend
            UI[Componentes UI / Páginas]
            Hooks[Hooks y Estado]
        end
        
        subgraph Backend
            API[API Routes / Controladores]
            Serv[Capa de Servicios de Negocio]
            WS[Servidor WebSocket]
        end
    end

    subgraph Datos
        ORM[Prisma Client]
        DB[(PostgreSQL)]
        Cache[(Redis)]
    end

    C -- HTTP REST --> API
    C -- Eventos WS --> WS
    UI -- Acciones --> Hooks
    Hooks -- Fetch --> API
    
    API -- Invocación --> Serv
    WS -- Invocación --> Serv
    
    Serv -- Consultas --> ORM
    Serv -- Sincronización --> Cache
    ORM -- SQL --> DB
```

## 2. Diagrama de Componentes del Frontend

**Explicación:**
Este diagrama detalla cómo se organizan internamente los componentes de la interfaz de usuario en React. Es la arquitectura correcta porque sigue el patrón de separación entre componentes "Smart" o Contenedores (Páginas y Contextos que manejan estado) y componentes "Dumb" o Presentacionales (UI base reutilizable).
- **Páginas (src/app):** Componentes raíz de cada ruta (Dashboard, Horarios, Reportes). Son el punto de orquestación.
- **Proveedores de Contexto:** Proveen datos y estado global a toda la app sin necesidad de pasarlos por `props` (Sesión, Temas, Estado del Periodo actual).
- **Componentes de Funcionalidad:** Encapsulan lógica específica y pesada de una vista (ej. Grilla de Horarios interactiva, Tabla de Usuarios, Colas de Notificaciones).
- **Componentes UI Base:** Elementos atómicos, aislados y reutilizables creados típicamente con Tailwind (Botones, Modales, Inputs).

```mermaid
graph TD
    subgraph Pages [Páginas / Rutas de Next.js]
        P_Dash[Página Dashboard]
        P_Horarios[Página Horarios]
        P_Reportes[Página Reportes]
    end

    subgraph Contexts [Contextos Globales]
        C_Auth[AuthContext]
        C_Periodo[PeriodoContext]
    end

    subgraph FeatureComponents [Componentes de Funcionalidad]
        F_Grilla[GrillaHorario]
        F_Conflictos[VisorConflictos]
        F_Tabla[TablaDatos]
        F_Cola[ColaNotificaciones]
    end

    subgraph BaseUI [Componentes UI Base / Tailwind]
        U_Btn[Boton]
        U_Modal[Modal]
        U_Input[Input]
    end

    P_Dash --> C_Auth
    P_Horarios --> C_Periodo
    
    P_Horarios --> F_Grilla
    P_Horarios --> F_Conflictos
    P_Reportes --> F_Tabla
    
    F_Grilla --> U_Btn
    F_Conflictos --> U_Modal
    F_Tabla --> U_Input
```

## 3. Diagrama de Componentes del Backend (Servicios)

**Explicación:**
En el backend, la arquitectura de componentes está regida por un patrón clásico de "Arquitectura de Servicios por Capas". Es el enfoque más profesional y correcto porque permite que las **API Routes** sirvan únicamente como controladores de tráfico (validan inputs y tokens), delegando el procesamiento real a módulos especializados (**Servicios**). Esto hace que el código sea escalable, testeable unitariamente y fácil de mantener.
- **API Controllers:** Rutas en `src/app/api` que exponen los endpoints REST.
- **Servicios Core:** Servicios centrales como la asignación de horarios, validación de conflictos o cálculo de carga lectiva.
- **Servicios Transversales (Auxiliares):** Servicios de propósito general utilizados por todo el sistema, como notificaciones por correo/WhatsApp, generación de archivos PDF o registros de auditoría.
- **Capa de Acceso a Datos (Prisma):** El componente único encargado de traducir la lógica de los servicios en consultas SQL seguras para la base de datos.

```mermaid
graph TD
    subgraph API [Controladores / API Routes]
        API_Auth[/api/auth/]
        API_Horarios[/api/horarios/]
        API_Docentes[/api/docentes/]
        API_Reportes[/api/reportes/]
    end

    subgraph CoreServices [Servicios Core de Negocio]
        S_Horario[ServicioHorario]
        S_Validacion[ValidadorConflictos]
        S_Carga[CargaLectivaService]
        S_Auth[AuthService]
    end

    subgraph AuxServices [Servicios Transversales]
        S_Notif[GestorNotificaciones]
        S_Reportes[GeneradorPDF]
        S_Audit[ServicioAuditoria]
        S_WS[ServidorWebSocket]
    end

    subgraph Repositories [Capa de Acceso a Datos]
        Prisma[Prisma Client]
    end

    API_Horarios --> S_Horario
    API_Auth --> S_Auth
    API_Docentes --> S_Carga
    API_Reportes --> S_Reportes
    
    S_Horario --> S_Validacion
    S_Horario --> S_Notif
    S_Horario --> S_WS
    S_Horario --> S_Audit
    
    S_Horario --> Prisma
    S_Carga --> Prisma
    S_Auth --> Prisma
    S_Validacion --> Prisma
    S_Notif --> Prisma
```
