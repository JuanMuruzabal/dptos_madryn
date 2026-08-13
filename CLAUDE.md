# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Turismo Marcuzzi: plataforma de turismo para Puerto Madryn (Chubut, Argentina) — alquiler de departamentos, experiencias (actividades simples), servicio turístico (excursiones más complejas, pestaña propia separada de experiencias) y traslados al aeropuerto con selección de vehículo entre la gama del cliente, con un panel de administración. La especificación completa vive en `docs/turismo-marcuzzi-spec.md`; el plan de implementación fase por fase en `docs/implementation-plan.md`; las decisiones de arquitectura/alcance con sus alternativas descartadas en `docs/tradeoffs.md`. Leé esos tres antes de planificar o tocar un módulo nuevo — son la fuente de verdad, este archivo es solo el mapa rápido.

## Stack (decidido, no "a evaluar")

- **Backend:** Go + [chi](https://github.com/go-chi/chi) (router) + GORM (acceso a datos), en `apps/api`. TR-001/TR-006 en `docs/tradeoffs.md`.
- **Frontend:** Next.js 16 + TypeScript + Tailwind, en `apps/web`. Next.js genera `apps/web/AGENTS.md` con un aviso de que esta versión tiene cambios de breaking respecto a lo que un LLM puede tener entrenado — leerlo antes de escribir código de Next.js.
- **DB:** PostgreSQL, con la extensión `btree_gist` y un exclusion constraint que impide reservas de alojamiento solapadas a nivel de base de datos (no solo en la app). Ver `apps/api/internal/db/migrate.go`.
- **Package manager JS:** `pnpm` (no `npm`) — bloquea scripts de instalación de terceros por defecto; ver `allowBuilds` en `pnpm-workspace.yaml` si una instalación falla por un build script bloqueado.
- Sin Docker corriendo, `apps/api` no levanta: `docker compose up -d` para Postgres local.

## Comandos

Desde la raíz del repo (`package.json` tiene los atajos):

- `pnpm run dev:web` / `pnpm run build:web` / `pnpm run lint:web` / `pnpm run typecheck:web`
- `pnpm run typecheck:shared-types`
- `pnpm run dev:api` (`go run ./cmd/api`) / `pnpm run build:api` (`go build ./...`) / `pnpm run vet:api`
- `pnpm run migrate:api` — aplica el esquema (AutoMigrate de GORM + SQL crudo para la extensión/constraint). Idempotente, se puede correr de nuevo sin romper nada.
- Lint de Go: `golangci-lint run ./...` dentro de `apps/api` (config en `apps/api/.golangci.yml`, formato v2).

No hay `.git` inicializado todavía (decisión explícita, no un olvido) — no asumir comandos de git ni intentar `git init` sin que lo pidan.

## El requisito no obvio más importante: evitar dobles reservas

Las reservas de alojamiento **no** se validan solo en la aplicación. `reservas.rango_fechas` es una columna generada (`daterange` a partir de `fecha_inicio`/`fecha_fin`) con un exclusion constraint GiST que Postgres hace cumplir siempre, incluso ante bugs de concurrencia en el backend. Si tocás el modelo de `Reserva` o el flujo de creación, no rompas esa garantía — está en `apps/api/internal/db/migrate.go` y validada con un test manual de inserts solapados (ver `docs/implementation-plan.md` T0.3).

Los **cupos de experiencias y servicio turístico** (`SLOT.cupos_disponibles` / `SLOT_SERVICIO.cupos_disponibles`, Sprint 6 y Sprint 8) no tienen una constraint tan directa — cualquier código de reserva de experiencias/servicio turístico necesita su propio locking explícito (transacción + `SELECT ... FOR UPDATE` o decremento atómico) para no sobrevender cupos (riesgo R2 del plan).

Los **vehículos** (Sprint 7, agregado 2026-08-11: el cliente pidió que el usuario elija un vehículo específico al reservar traslado o servicio turístico) sí tienen una constraint tan directa como alojamiento — un segundo `EXCLUDE USING gist` sobre `(vehiculo_id, rango_horario)` con `tstzrange` (horas, no días), análogo al de alojamiento pero a nivel horario. Ver "Nota clave sobre asignación de vehículos" en `docs/turismo-marcuzzi-spec.md` §5 y TR-010 en `docs/tradeoffs.md`.

## Regla de negocio: acceso a servicios atado a alojamiento confirmado vigente (FR-11)

Decisión del cliente (2026-08-11), no un detalle menor de UI: un usuario solo puede **reservar** una experiencia, un servicio turístico o un traslado si tiene una reserva de alojamiento `confirmada` con `fecha_fin >= hoy` ("vigente" — estadía actual o futura, no una del pasado). Sin eso, puede ver los listados/detalles de experiencias, servicio turístico y traslados con normalidad, pero no reservarlos. La confirmación (`pendiente` → `confirmada`) la hace el administrador a mano desde el panel, después de que el pago se coordinó por fuera de la plataforma directamente entre cliente y dueño — no hay pago online en el MVP. La home muestra un banner condicional cuando esto se cumple. Detalle completo en `docs/turismo-marcuzzi-spec.md` §4.1/§4.3/§4.4/§4.5/§4.7 y `docs/tradeoffs.md` TR-002/TR-007.

## Servicio Turístico vs. Experiencias (agregado 2026-08-11, aclaración del cliente)

Son dos módulos separados a propósito (entidades/tablas distintas, cada uno con su pestaña principal en la navegación — no un filtro dentro del otro): **Experiencias** son actividades simples y de corta duración (p. ej. un paseo por la playa); **Servicio Turístico** son excursiones más complejas y de mayor duración (p. ej. Península Valdés, avistaje de ballenas de día completo). Ambos comparten el mismo mecanismo de reserva con cupos/`SLOT` y la misma regla de acceso (FR-11, arriba). Ver TR-009/TR-011 en `docs/tradeoffs.md`.

Para comparar "¿la estadía sigue vigente?" (`fecha_fin >= hoy`) usar siempre `apps/api/internal/clock.Today()`, nunca `time.Now()` directo — fija la zona horaria a Argentina (UTC-3) independientemente de en qué timezone corra el contenedor de deploy.

## Alcance del MVP vs. fases posteriores

MVP (Fase 1, spec §9): landing + alojamiento completo + auth + panel admin básico + reservas con confirmación manual por email — **sin** pagos online. Experiencias y traslados (con la regla de acceso de arriba) son Fase 2. Mercado Pago, chat/WhatsApp, fidelización, app móvil e i18n completo siguen fuera de alcance salvo pedido explícito — no las implementes solo porque aparecen en el modelo de datos o la arquitectura como preparación futura (p. ej. la entidad `Pago` existe pero su integración real es posterior).
