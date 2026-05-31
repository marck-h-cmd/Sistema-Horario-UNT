#!/bin/sh
# =============================================================================
# Docker entrypoint para el contenedor de la app (Next.js + Prisma).
# Garantiza que el schema de Prisma se aplique a la BD ANTES de arrancar
# Next.js, sin importar la plataforma de deploy (docker-compose, Render,
# Railway, Coolify, Fly.io, etc.).
#
# Pasos:
#   1) Valida DATABASE_URL
#   2) Espera a que Postgres acepte conexiones
#   3) Genera el Prisma Client (idempotente)
#   4) Aplica el schema con `prisma db push` (crea/actualiza tablas)
#   5) (Opcional) ejecuta el seed mínimo si RUN_SEED_ON_BOOT=true
#   6) Arranca `npm start` con exec para que reciba señales (SIGTERM, etc.)
# =============================================================================

set -e

log() {
  echo "[entrypoint] $*"
}

# -----------------------------------------------------------------------------
# 1) DATABASE_URL obligatoria
# -----------------------------------------------------------------------------
if [ -z "${DATABASE_URL}" ]; then
  log "ERROR: DATABASE_URL no está definida. Abortando."
  exit 1
fi

# Extraer host y puerto para pg_isready (formato postgres://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+).*#\1#')
DB_PORT=$(echo "$DATABASE_URL" | sed -nE 's#.*@[^:/]+:([0-9]+).*#\1#p')
DB_PORT="${DB_PORT:-5432}"

log "Host BD: ${DB_HOST}:${DB_PORT}"

# -----------------------------------------------------------------------------
# 2) Esperar a Postgres
# -----------------------------------------------------------------------------
log "Esperando a que Postgres acepte conexiones..."
MAX_TRIES=60
TRY=0
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  TRY=$((TRY + 1))
  if [ "$TRY" -ge "$MAX_TRIES" ]; then
    log "ERROR: Postgres no respondió tras ${MAX_TRIES} intentos. Abortando."
    exit 1
  fi
  sleep 1
done
log "Postgres listo (tras ${TRY} segundos)."

# -----------------------------------------------------------------------------
# 3) Generar el Prisma Client (por si la imagen viene sin él)
# -----------------------------------------------------------------------------
log "Generando Prisma Client..."
npx --no-install prisma generate

# -----------------------------------------------------------------------------
# 4) Aplicar schema a la BD
#    - Si el repo tuviera migraciones en prisma/migrations usamos migrate deploy.
#    - Si no, usamos db push (estado actual del proyecto).
# -----------------------------------------------------------------------------
if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  log "Detectadas migraciones formales. Ejecutando 'prisma migrate deploy'..."
  npx --no-install prisma migrate deploy
else
  log "Sincronizando schema con 'prisma db push'..."
  npx --no-install prisma db push --accept-data-loss --skip-generate
fi

# -----------------------------------------------------------------------------
# 5) Seed opcional (controlado por env)
# -----------------------------------------------------------------------------
if [ "${RUN_SEED_ON_BOOT}" = "true" ]; then
  log "RUN_SEED_ON_BOOT=true → ejecutando seed mínimo..."
  node scripts/docker-seed-min.js || log "Aviso: el seed devolvió un error (continuando)."
fi

# -----------------------------------------------------------------------------
# 6) Arrancar la app
# -----------------------------------------------------------------------------
log "Arrancando Next.js: $*"
exec "$@"
