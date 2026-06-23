# Sistema de Gestión de Horarios – UNT - v3

Aplicación full-stack construida con Next.js (App Router) para gestionar la planificación, asignación y publicación de horarios académicos, incluyendo notificaciones, reportes y monitoreo en tiempo real.

## Stack

- Next.js 14 (React 18, TypeScript)
- API interna con Route Handlers: `src/app/api/**`
- Prisma + PostgreSQL
- Redis + BullMQ (colas)
- WebSockets (`ws`) para tiempo real
- Tailwind CSS (PostCSS)
- Puppeteer (generación/automatización de reportes)
- Vitest (tests unitarios/integración/e2e)

## Requisitos

- Node.js 20+ (recomendado). En Docker se usa Node 20.
- Docker Desktop (recomendado para levantar Postgres/Redis y la app fácilmente).
- PostgreSQL 16+ y Redis 7+ (si no usas Docker).

## Variables de entorno

1. Copia el template:

```bash
copy .env.example .env.local
```

2. Ajusta valores en `.env.local` (no subas este archivo al repo).

Principales variables (ver `.env.example`):

- Aplicación: `APP_URL`, `APP_PORT`
- DB: `DATABASE_URL`, `DB_*`
- Redis: `REDIS_URL`, `REDIS_*`
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, expiraciones
- Notificaciones: `SMTP_*`, `WHATSAPP_*`, `TELEGRAM_*`
- Logging: `LOG_LEVEL`

## Correr en local (recomendado): Docker Compose

Levanta Postgres, Redis y la app:

```bash
docker compose up -d --build
```

Luego abre:

- App: http://localhost:3000

Servicios (host):

- Postgres: `localhost:5432`
- Redis: `localhost:6380` (en el contenedor corre en `6379`, pero se expone a `6380` para evitar choques con Redis local)

Logs de la app:

```bash
docker compose logs -f --tail 100 app
```

Apagar todo:

```bash
docker compose down
```

### Prisma dentro de Docker

El contenedor ejecuta:

- `npx prisma generate`
- `npx prisma db push`
- `npm run dev`

Nota: este proyecto no incluye una carpeta `prisma/migrations` en el repo. Por eso el flujo por defecto usa `db push` (sin migraciones versionadas).

## Correr en local (sin Docker)

1. Levanta PostgreSQL y Redis en tu máquina y configura `.env.local` para apuntar a `localhost`.
2. Instala dependencias:

```bash
npm install
```

3. Genera Prisma Client y sincroniza el esquema:

```bash
npx prisma generate
npx prisma db push
```

4. Inicia Next.js:

```bash
npm run dev
```

Abrir: http://localhost:3000

## Scripts útiles

- Dev: `npm run dev`
- Build/Start: `npm run build` / `npm run start`
- Lint/Types: `npm run lint` / `npm run type-check`
- Prisma: `npm run db:generate`, `npm run db:push`, `npm run db:migrate`, `npm run db:studio`
- Tests: `npm test`, `npm run test:unit`, `npm run test:integration`
- Docker: `npm run docker:build`, `npm run docker:up`, `npm run docker:down`

## Estructura del proyecto (resumen)

- `src/app`: páginas/layouts con App Router
- `src/app/api`: endpoints (auth, cursos, docentes, horarios, reportes, notificaciones, etc.)
- `src/components`: componentes UI y módulos del dashboard
- `src/services`: capa de dominio/servicios (horarios, notificaciones, reportes, websocket, etc.)
- `src/lib`: utilidades, tipos, constantes y Prisma/Redis clients
- `src/middleware`: middlewares (auth, autorización, rate limit, auditoría)
- `prisma/schema.prisma`: modelos de datos
- `tests`: unitarias, integración y e2e

## Notas

- Si ves warnings de engines (por ejemplo `swagger-client` pidiendo Node >= 22), la app puede seguir funcionando en Node 20; en Docker se mantiene Node 20 por compatibilidad.
