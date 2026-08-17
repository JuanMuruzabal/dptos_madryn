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
pnpm run test:web             # vitest run — ver sección "Tests" más abajo
pnpm run test:coverage:web

pnpm run dev:api              # go run ./cmd/api
pnpm run build:api            # go build ./...
pnpm run vet:api              # go vet ./...
pnpm run migrate:api          # go run ./cmd/migrate (idempotente)
pnpm run test:api             # go test ./internal/... — ver sección "Tests"
pnpm run test:coverage:api
```

Lint de Go (no tiene atajo en `package.json`, correr dentro de
`apps/api`): `golangci-lint run ./...`.

## Tests

Suite de tests unitarios para ambos lados, con un piso de **80% de code
coverage** (statements/branches/functions/lines) que CI hace cumplir —
ver "Integración continua" más abajo. `docs/implementation-plan.md` §12
tiene el detalle completo de cómo se armó esta suite (decisiones,
sprints, riesgos); acá solo los comandos para correrla.

### Backend (Go)

Los tests de `apps/api` usan **Postgres real, no mocks** (TR-038 en
`docs/tradeoffs.md`) — GORM genera queries que un mock hay que
sincronizar a mano, y el exclusion constraint de reservas (ver arriba)
no se puede simular con sentido de otra forma. `internal/testdb` conecta
a una base separada de la de desarrollo y la crea/migra sola si hace
falta; cada test corre en su propia transacción que se revierte al
terminar, así que no hace falta limpiar nada a mano entre corridas.

1. Postgres tiene que estar corriendo (alcanza con `docker compose up -d
   postgres`, no hace falta levantar `api`/`web`/`migrate`).
2. La base de test se resuelve de `TEST_DATABASE_URL` — el default ya
   apunta a `turismo_marcuzzi_test` en el mismo Postgres de
   `docker-compose.yml`, así que la mayoría de los casos no necesita
   configurar nada. Para un valor distinto, copiar
   [`apps/api/.env.test.example`](apps/api/.env.test.example) a
   `apps/api/.env.test`.
3. Correr desde la raíz:
   ```bash
   pnpm run test:api            # go test ./internal/...
   pnpm run test:coverage:api   # + coverage, imprime el % total al final
   ```
   `-race` (detector de condiciones de carrera) no está en el script de
   arriba porque alarga bastante la corrida — CI sí lo usa siempre; para
   correrlo local: `cd apps/api && go test ./internal/... -race`.

**IMPORTANTE**: el nombre de la base en `TEST_DATABASE_URL` tiene que
terminar en `_test` — `internal/testdb` lo valida y aborta si no, para
que nunca sea posible correr la suite contra la base de desarrollo o
producción por accidente (ya pasó una vez, 2026-08-13, aunque por un
`docker compose down -v` manual, no por tests).

### Frontend (Next.js/TypeScript)

Vitest 4 + Testing Library + jsdom (TR-039 en `docs/tradeoffs.md`, sin
Postgres ni backend de por medio — todo mockeado a nivel de
`fetch`/Server Actions). No hace falta nada levantado de antemano.

```bash
pnpm run test:web             # vitest run
pnpm run test:coverage:web    # + coverage (falla si algún indicador < 80%)
```

Alcance del gate de coverage (TR-040): excluye `src/app/**/page.tsx` y
`layout.tsx` — son Server Components async, no unit-testeables vía
Testing Library/jsdom; van a quedar cubiertos por tests end-to-end más
adelante (`docs/implementation-plan.md` T5.4), no por esta suite.

Para iterar rápido en un archivo puntual: `pnpm --filter
@turismo-marcuzzi/web test <patrón del archivo>` (modo watch:
`pnpm --filter @turismo-marcuzzi/web test:watch`).

## Integración continua

`.github/workflows/ci.yml` corre en cada push a `main` (y en cualquier
pull request) con cinco jobs:

- **`api`**: `go vet`, `golangci-lint`, `go build`.
- **`web`**: `eslint`, `next typegen && tsc --noEmit`, typecheck de
  `packages/shared-types`, `next build`.
- **`test-api`** ("Run tests and quality gates (api)"): los tests de Go
  contra un Postgres real levantado como `services:` del job, con
  coverage — falla el build si el total baja de 80%.
- **`test-web`** ("Run tests and quality gates (web)"): la suite de
  Vitest con coverage — el propio `coverage.thresholds` de
  `apps/web/vitest.config.mts` hace fallar el comando por debajo de 80%.
- **`deploy`**: `needs: [web, api, test-api, test-web]` — solo corre en
  un push directo a `main` (nunca en un pull_request), y solo si los
  cuatro jobs de arriba pasaron. Dispara el Sync Hook del Blueprint de
  Render (secret `RENDER_SYNC_HOOK_URL`, ver sección "Deploy" abajo) —
  así el deploy a producción queda gateado por CI, no por un push
  cualquiera.

Los primeros cuatro son la Etapa 1 del pipeline ("Run tests and quality
gates"); `deploy` es la Etapa 3 (Etapa 2, análisis estático con
SonarCloud, salteada por decisión del cliente) — ver
`docs/implementation-plan.md` §12.

Antes de abrir un PR, correr localmente el mismo pipeline que corre CI
(los comandos de arriba, en el mismo orden, incluyendo esta sección de
Tests) evita sorpresas — en particular, `pnpm run typecheck:web` genera
los tipos de rutas de Next (`next typegen`) antes de tipar, porque un
checkout limpio (como el de CI) no tiene un `.next/` con esos tipos
generado todavía a diferencia de una máquina de desarrollo donde casi
siempre queda uno de una corrida anterior.

## Deploy

Producción corre en [Render](https://render.com) — Postgres administrado
+ los dos `Dockerfile` ya existentes (mismas imágenes que
`docker-compose.yml`, sin una segunda definición de build paralela). Todo
la topología vive versionada en [`render.yaml`](render.yaml) (Blueprint,
Infrastructure as Code) en la raíz del repo — decisión completa con sus
alternativas en TR-042 (`docs/tradeoffs.md`).

**Los valores de los secrets nunca están en el repo.** `render.yaml` solo
declara qué variables existen; cada una marcada `sync: false` se carga
una única vez desde el dashboard de Render al aplicar el blueprint (o
`generateValue: true` para `JWT_SECRET`, que Render genera y guarda solo,
sin que nadie lo vea en texto plano).

> ⚠️ **`turismo-marcuzzi-db` está en el plan `free` de Postgres a
> propósito** (decisión del cliente, 2026-08-16, mientras se prueba el
> deploy sin datos reales todavía) — **se borra solo a los 30 días de
> creado**, no es una degradación de performance. Subir a `starter` (o
> superior) en el dashboard de Render **antes de la primera reserva real
> cargada**, no antes.

### Antes de desplegar por primera vez

1. **Bucket de Cloudflare R2** (TR-041 — storage de fotos en producción,
   reemplaza el disco local de desarrollo/TR-013 porque los contenedores
   de Render son efímeros): crear un bucket en el dashboard de Cloudflare
   → R2 Object Storage, habilitar acceso público (r2.dev o un dominio
   propio), y generar un API Token con permiso *Object Read & Write*
   (`Access Key ID` + `Secret Access Key`). Guardar junto con el
   `Account ID`, el nombre del bucket y la URL pública — van al dashboard
   de Render en el paso 3, nunca al repo.
2. **Cuenta de Render** conectada al repo de GitHub (`New +` → `Blueprint`
   → elegir este repo → Render detecta `render.yaml` solo y muestra un
   preview de los 3 servicios antes de crear nada).
3. **Cargar los secrets** que el blueprint dejó pendientes
   (`sync: false`) en cada servicio, pestaña *Environment*:
   - `turismo-marcuzzi-api`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
     `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` (del paso 1).
   - `turismo-marcuzzi-web`: `CONTACTO_WHATSAPP`, `CONTACTO_EMAIL` (los
     datos reales del cliente, reemplazan los placeholders de desarrollo).
4. **Deploy automático gateado por CI** (job `deploy` en `ci.yml`, ver
   "Integración continua" abajo): en el dashboard de Render, sección
   **Blueprints** → tu blueprint → copiar el **Sync Hook** (sincroniza
   `api` y `web` de una sola llamada — no el "Deploy Hook" de un
   servicio individual, ese solo cubre uno de los dos). Cargarlo como
   secret del repo en GitHub: **Settings → Secrets and variables →
   Actions → pestaña "Secrets"** (no "Variables", son dos cosas
   distintas en la misma página) → nombre exacto `RENDER_SYNC_HOOK_URL`.
   Sin este secret, CI sigue pasando igual pero el job `deploy` falla —
   hay que segui deployando a mano desde Render mientras tanto.
5. Deploy inicial. El primer request a `/health` puede tardar (plan free
   duerme los servicios sin tráfico — cold start) — no es un error.

Si algún día cambia el nombre de un servicio o se conecta un dominio
propio, `CORS_ALLOWED_ORIGINS` (en `turismo-marcuzzi-api`) y `API_URL`
(en `turismo-marcuzzi-web`) están hardcodeados en `render.yaml` a las
URLs `*.onrender.com` por defecto — actualizarlos a mano (Render no
permite interpolar la URL de un servicio dentro de otro en el blueprint).

## Flujo de ramas

- **`main`** — lo que está en producción (juega el rol de "prod"). Es la
  rama default del repo y la que dispara CI en cada push (`ci.yml`). Solo
  recibe merges desde `dev` cuando se decide hacer un release.
- **`dev`** — rama de integración de desarrollo. Todo el trabajo en curso
  converge acá antes de pasar a `main`.
- **`feature/<nombre-corto>`** — reservada para funcionalidades **grandes y
  generales**, sale de `dev` y vuelve a `dev` por PR (p. ej.
  `feature/editor`, `feature/panel-admin-vehiculos`). Agrupa varios
  cambios relacionados bajo la misma rama en vez de abrir una rama nueva
  por cada retoque puntual dentro de esa funcionalidad.
- **`fix/<nombre-corto>`** — reservada para bugs **grandes**, mismo
  circuito que `feature/*` (sale de `dev`, PR de vuelta a `dev`).
- **Cambios chicos** (ajustes de UI, reordenar algo, un tweak puntual,
  bugs menores) — commit directo a `dev`, sin abrir rama. No todo cambio
  necesita su propia `feature/*`/`fix/*`.

```
main  ──────────────────────●───────────────●──────  (releases)
                              \\             /
dev   ──●────●────●────●──────●─────●───────●──────
         \\    \\    /    /
feature/x ●────●    fix/y
```

No se usa una rama `prod` separada a propósito: `main` ya es la default de
GitHub y la que dispara CI, así que darle el rol de "prod" directamente
evita mantener dos ramas sincronizadas a mano por el mismo estado.

## Regla de negocio clave: acceso a servicios atado a alojamiento vigente

Un usuario solo puede **reservar** una experiencia, un servicio turístico o
un traslado si tiene una reserva de alojamiento `confirmada` con
`fecha_fin >= hoy`. Sin eso puede ver los listados con normalidad, pero no
reservar. Detalle completo: `docs/turismo-marcuzzi-spec.md` §4 y
`docs/tradeoffs.md` TR-002/TR-007.
