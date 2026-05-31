# Etapa de desarrollo
FROM node:20-alpine AS development

WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    openssl \
    ttf-freefont \
    postgresql-client \
    python3 \
    make \
    g++ \
    git

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY tailwind.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY .eslintrc.json ./
COPY .prettierrc ./

RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Normalizar saltos de línea del entrypoint y darle permisos (soluciona
# problemas cuando el repo se clona en Windows con CRLF).
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
    && chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Builder: compila la app con todas las dependencias
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Producción: solo runtime, mucho menos RAM que "next dev"
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    openssl \
    ttf-freefont \
    postgresql-client

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY next.config.js ./
COPY scripts ./scripts

# Normalizar saltos de línea del entrypoint y darle permisos (soluciona
# problemas cuando el repo se clona en Windows con CRLF).
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
    && chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000

# El entrypoint se ejecuta SIEMPRE antes de CMD: espera a Postgres,
# genera el cliente Prisma y aplica el schema antes de arrancar Next.js.
# Esto garantiza que cualquier plataforma (Render, Railway, Coolify,
# Fly.io, docker run, docker-compose, etc.) ejecute las migraciones.
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "start"]
