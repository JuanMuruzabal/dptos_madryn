# apps/web — Next.js dentro de un monorepo pnpm (depende de
# packages/shared-types vía "workspace:*"), así que el build NECESITA
# contexto de la raíz del repo, no solo apps/web.
#
# Build context: raíz del monorepo (ver docker-compose.yml,
# build.context: . / build.dockerfile: apps/web/Dockerfile).
#
# Sigue el patrón oficial de Next.js para "output: standalone" en
# monorepos: https://nextjs.org/docs/app/api-reference/config/next-config-js/output

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# --- deps: instala node_modules de todo el workspace, cacheable por
# separado de los cambios de código fuente ---
FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

# --- build: código fuente + `next build` (genera .next/standalone) ---
FROM base AS build
WORKDIR /repo
COPY --from=deps /repo ./
COPY apps/web apps/web
COPY packages/shared-types packages/shared-types
# Bug real detectado 2026-08-18: las NEXT_PUBLIC_* tienen que existir
# como env var EN EL MOMENTO del build (`next build` las inlinea en el
# JS del cliente) — una variable cargada solo en el dashboard de Render
# (entorno del CONTENEDOR YA CORRIENDO) nunca llega a este paso, así que
# hasta ahora siempre se compilaba con el fallback hardcodeado de cada
# una (p. ej. NEXT_PUBLIC_TURNSTILE_SITE_KEY siempre caía en la site key
# de PRUEBA, aunque se cargara una real en Render — pasaba desapercibido
# porque esa siempre "funciona" mostrando el cartel de modo test; con
# NEXT_PUBLIC_GOOGLE_CLIENT_ID, sin fallback posible, el botón quedaba
# deshabilitado siempre). Render pasa las env vars del dashboard como
# --build-arg automáticamente cuando el Dockerfile declara un ARG con
# el mismo nombre — de ahí este bloque.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN pnpm --filter @turismo-marcuzzi/web build

# --- runtime: solo lo que server.js standalone necesita para correr ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# 0.0.0.0: el server standalone escucha en localhost por defecto, lo que
# lo dejaría inalcanzable desde fuera del contenedor.
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
