# Turismo Marcuzzi

Plataforma de turismo para Puerto Madryn (Chubut, Argentina): alquiler de
departamentos, experiencias, servicio turístico (excursiones) y traslados
al aeropuerto, con panel de administración.

La especificación completa del producto vive en
[`docs/turismo-marcuzzi-spec.md`](docs/turismo-marcuzzi-spec.md), el plan de
implementación fase por fase en
[`docs/implementation-plan.md`](docs/implementation-plan.md), y las
decisiones de arquitectura/alcance (con sus alternativas descartadas) en
[`docs/tradeoffs.md`](docs/tradeoffs.md). Antes de tocar un módulo nuevo,
esos tres son la fuente de verdad — este README es solo la puerta de
entrada.

## Stack

| Capa       | Tecnología                                                                 |
|------------|-----------------------------------------------------------------------------|
| Backend    | Go + [chi](https://github.com/go-chi/chi) (router) + GORM (acceso a datos) |
| Frontend   | Next.js 16 + TypeScript + Tailwind CSS                                      |
| Base de datos | PostgreSQL 16, extensión `btree_gist` + exclusion constraints           |
| Monorepo   | pnpm workspaces (`apps/web`, `packages/shared-types`) + módulo Go independiente (`apps/api`) |

Decisiones y alternativas descartadas de cada elección: `docs/tradeoffs.md`
(TR-001 backend en Go, TR-006 chi+GORM, TR-005 exclusion constraint de
reservas, TR-013 storage local, TR-014 email de desarrollo).

El requisito no obvio más importante del proyecto: las reservas de
alojamiento **no** se validan solo en la aplicación — `reservas.rango_fechas`
tiene un `EXCLUDE USING gist` a nivel de Postgres que impide solapamientos
incluso ante bugs de concurrencia en el backend. Ver
`apps/api/internal/db/migrate.go` y la sección homónima en `CLAUDE.md`.

## Estructura del repo

```
apps/
  api/            # Backend Go (módulo independiente, no es un workspace pnpm)
    cmd/api/      # Entry point del servidor HTTP
    cmd/migrate/  # Entry point que aplica el esquema (idempotente)
    internal/     # Handlers, modelos, storage, email, etc.
  web/            # Frontend Next.js 16 (App Router, Cache Components/PPR)
packages/
  shared-types/   # Interfaces TS que reflejan a mano los structs de apps/api
docs/             # Spec, plan de implementación, tradeoffs
docker-compose.yml
```

## Cómo correr el proyecto

### Opción A — Docker Compose (recomendada para levantar todo de una)

Requisito: Docker Desktop corriendo. No hace falta tener Go, Node ni pnpm
instalados en la máquina — todo se buildea dentro de los contenedores.

```bash
docker compose up --build
```

Esto levanta, en orden, con las dependencias correctas entre servicios:

1. **`postgres`** — Postgres 16 (puerto `5432`).
2. **`migrate`** — aplica el esquema (`AutoMigrate` + SQL crudo del
   exclusion constraint) y termina. Es idempotente: corre en cada
   `docker compose up` sin romper nada, incluso si el esquema ya existe.
3. **`api`** — backend Go (puerto `8080`), arranca recién cuando `migrate`
   terminó bien.
4. **`web`** — frontend Next.js (puerto `3000`), le habla a `api` por la red
   interna de Docker (`http://api:8080`), no por `localhost`.

Con eso arriba: **http://localhost:3000** es el sitio, **http://localhost:8080**
es la API.

Variables opcionales (JWT_SECRET, CONTACTO_WHATSAPP, CONTACTO_EMAIL): copiar
[`.env.example`](.env.example) a `.env` en la raíz antes de levantar el
stack si hace falta cambiar algún default de desarrollo.

Para bajar todo (y borrar los volúmenes de Postgres/uploads, si se quiere
empezar de cero):

```bash
docker compose down        # conserva los volúmenes (datos persistidos)
docker compose down -v     # borra también postgres_data y api_uploads
```

### Opción B — Cada app suelta (mejor para iterar rápido con hot-reload)

Requisitos: Go ≥ 1.25 (el `go.mod` fija la versión, `go` la descarga sola
si hace falta con `GOTOOLCHAIN=auto`, el default), Node ≥ 20, pnpm ≥ 9.

1. Levantar solo Postgres:
   ```bash
   docker compose up -d postgres
   ```
2. Instalar dependencias del monorepo JS (desde la raíz):
   ```bash
   pnpm install
   ```
3. Copiar los `.env.example` de cada app:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
4. Aplicar el esquema:
   ```bash
   pnpm run migrate:api
   ```
5. Levantar backend y frontend en dos terminales:
   ```bash
   pnpm run dev:api   # go run ./cmd/api — http://localhost:8080
   pnpm run dev:web   # next dev         — http://localhost:3000
   ```

### Comandos útiles (desde la raíz del repo)

```bash
pnpm run dev:web              # next dev
pnpm run build:web            # next build
pnpm run lint:web             # eslint
pnpm run typecheck:web        # next typegen && tsc --noEmit
pnpm run typecheck:shared-types

pnpm run dev:api              # go run ./cmd/api
pnpm run build:api            # go build ./...
pnpm run vet:api              # go vet ./...
pnpm run migrate:api          # go run ./cmd/migrate (idempotente)
```

Lint de Go (no tiene atajo en `package.json`, correr dentro de
`apps/api`): `golangci-lint run ./...`.

## Integración continua

`.github/workflows/ci.yml` corre en cada push/PR a `main` con dos jobs
independientes:

- **`api`**: `go vet`, `golangci-lint`, `go build`.
- **`web`**: `eslint`, `next typegen && tsc --noEmit`, typecheck de
  `packages/shared-types`, `next build`.

Antes de abrir un PR, correr localmente el mismo pipeline que corre CI
(los comandos de arriba, en el mismo orden) evita sorpresas — en
particular, `pnpm run typecheck:web` genera los tipos de rutas de Next
(`next typegen`) antes de tipar, porque un checkout limpio (como el de CI)
no tiene un `.next/` con esos tipos generado todavía a diferencia de una
máquina de desarrollo donde casi siempre queda uno de una corrida anterior.

## Flujo de ramas

- **`prod`** — lo que está en producción. Solo recibe merges desde `dev`
  cuando se decide hacer un release.
- **`dev`** — rama de integración de desarrollo. Todo el trabajo en curso
  converge acá antes de pasar a `prod`.
- **`feature/<nombre-corto>`** — una rama por feature nueva, sale de `dev`
  y vuelve a `dev` por PR (p. ej. `feature/panel-admin-vehiculos`).
- **`fix/<nombre-corto>`** — una rama por corrección de bug, mismo circuito
  que `feature/*` (sale de `dev`, PR de vuelta a `dev`).

```
prod  ──────────────────────●───────────────●──────  (releases)
                              \\             /
dev   ──●────●────●────●──────●─────●───────●──────
         \\    \\    /    /
feature/x ●────●    fix/y
```

`main` es el nombre histórico de la rama por defecto de este repo (todavía
no existen `prod`/`dev` como ramas separadas) — al adoptar este flujo,
`main` pasa a jugar el rol de `prod` y se crea `dev` a partir de su estado
actual.

## Regla de negocio clave: acceso a servicios atado a alojamiento vigente

Un usuario solo puede **reservar** una experiencia, un servicio turístico o
un traslado si tiene una reserva de alojamiento `confirmada` con
`fecha_fin >= hoy`. Sin eso puede ver los listados con normalidad, pero no
reservar. Detalle completo: `docs/turismo-marcuzzi-spec.md` §4 y
`docs/tradeoffs.md` TR-002/TR-007.
