# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado actual del repositorio

Este repositorio **todavía no contiene código**: hoy solo existe `turismo-marcuzzi-spec.md`, la especificación completa del proyecto. No hay `package.json`, no hay repo git inicializado, y no hay comandos de build/lint/test porque no hay nada que construir todavía. Cuando se agregue código, esta sección (y el resto del archivo) debe actualizarse con los comandos reales.

## Qué es Turismo Marcuzzi

Plataforma web de turismo para Puerto Madryn, Chubut (Argentina) con tres servicios integrados: alquiler de **departamentos**, **experiencias/excursiones** reservables y **traslados** al aeropuerto. El diferenciador central del producto es el trato personalizado frente a plataformas masivas (Airbnb/Booking) — esto debe guiar decisiones de UX y de qué automatizar vs. dejar con intervención humana/admin.

La especificación completa (alcance, modelo de datos, roadmap por fases) está en `turismo-marcuzzi-spec.md`. Léela antes de planificar o implementar cualquier módulo.

## Stack recomendado (aún no implementado)

La spec recomienda **un solo lenguaje de backend** para no duplicar complejidad operativa:
- **Opción A (recomendada):** Next.js (React + TS) en frontend, Node + TS (NestJS o Fastify) en backend.
- **Opción B:** Next.js en frontend, Go (chi/Echo/Fiber) en backend.

No mezclar ambos backends. PostgreSQL es la base de datos elegida específicamente por su soporte de `daterange` + exclusion constraints (ver más abajo).

## Detalle técnico crítico: evitar dobles reservas

El requisito no obvio más importante del proyecto: las reservas de alojamiento **deben** impedirse a nivel de base de datos, no solo con lógica de aplicación, usando un exclusion constraint de PostgreSQL sobre un rango de fechas:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reserva
  ADD CONSTRAINT sin_solapamiento
  EXCLUDE USING gist (
    alojamiento_id WITH =,
    rango_fechas WITH &&
  )
  WHERE (estado <> 'cancelada');
```

El mismo problema de concurrencia aplica a los **cupos de experiencias** (`SLOT.cupos_disponibles`), que no tiene una constraint tan directa en la spec — cualquier implementación de reserva de experiencias necesita su propio mecanismo (transacción con locking) para no sobrevender cupos.

## Decisiones todavía no confirmadas con el cliente

La spec (sección 10) deja explícitamente abiertas estas decisiones. No asumir una respuesta por defecto sin chequear si ya fueron resueltas fuera de este documento:
- Pagos online en el MVP vs. reserva + seña manual.
- Sitio bilingüe ES/EN vs. solo español.
- Lista concreta de experiencias a ofrecer.
- Google Maps (pago) vs. Leaflet/OSM (gratis).
- Quién carga/mantiene el contenido (define cuánto invertir en el panel admin).
- Stack de backend definitivo: TypeScript vs. Go.

## Alcance del MVP vs. fases posteriores

El MVP (Fase 1 del roadmap) es: landing + alojamiento completo (listado, detalle, mapa, calendario, reseñas) + auth + panel admin básico + reservas con confirmación por email. Pagos online (Mercado Pago), chat/WhatsApp, fidelización, app móvil e i18n completo están explícitamente **fuera del MVP** — no implementar estas features salvo pedido explícito, aunque aparezcan mencionadas en el modelo de datos o la arquitectura como preparación futura (p. ej. la entidad `PAGO` existe en el modelo pero su integración real es de Fase 3).
