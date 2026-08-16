# Plan de Implementación — Turismo Marcuzzi

> Basado en `turismo-marcuzzi-spec.md`. Cubre desde el arranque del proyecto (repo vacío) hasta el cierre de la Fase 2 del roadmap de la spec, con la Fase 3 y 4 resumidas como backlog.

---

## 1. Resumen y objetivo

Producir un plan accionable, ordenado por dependencias, para construir Turismo Marcuzzi: landing + alojamiento + experiencias + servicio turístico + traslados con selección de vehículo + auth + reservas + panel admin, sobre el modelo de datos y la arquitectura ya definidos en la spec (sección 5 y 6).

Este plan asume el **stack de la Opción B** de la spec (frontend Next.js/TypeScript + backend en **Go**) y toma una postura sobre las decisiones abiertas de la spec (sección 10) para poder planificar sin bloquearse. Esas posturas son supuestos, no decisiones del cliente — están registradas y justificadas en `docs/tradeoffs.md` y deben confirmarse antes de arrancar el Sprint 1.

---

## 2. Arquitectura (resumen ejecutable)

| Área | Elección para este plan | Fuente |
|---|---|---|
| Backend | **Go** + chi (router) + GORM (acceso a datos) | Spec 6.1, Opción B; ver TR-001, TR-006 |
| Frontend | Next.js + TypeScript + Tailwind CSS + Framer Motion | Spec 6.2 |
| Base de datos | PostgreSQL (+ extensión `btree_gist`) | Spec 5, 6.2 |
| Storage de imágenes | Cloudflare R2 (o S3) + CDN | Spec 6.2 |
| Mapas | Leaflet + OpenStreetMap | Spec 6.2 (supuesto, ver TR-003) |
| Email transaccional | Resend | Spec 6.2 |
| Auth | JWT propio, emitido por el backend Go (bcrypt + middleware chi) | Spec 6.2 |
| Pagos | Mercado Pago — **diferido a Fase 3** | Spec 6.2, 9 |
| Deploy | Vercel (front) + Railway/Fly.io (binario Go) + Neon/Supabase (Postgres) | Spec 6.2 |

Nota: en esta opción, Node solo se usa como herramienta de build/tooling del frontend (Next.js); no corre como segundo servidor (spec §6.1, advertencia de "evitar correr dos backends").

Diagrama de referencia: sección 6.3 de la spec (no se repite acá).

---

## 3. Estructura de archivos (monorepo)

```
/apps
  /web              # Next.js — landing, alojamiento, experiencias, traslados, auth, panel admin
  /api              # Go (chi + GORM) — REST API, lógica de reservas, integración email/storage
    /cmd/api        # main.go / entrypoint
    /internal       # handlers, servicios, repositorios, middleware
    /migrations     # migraciones SQL (incluye exclusion constraint de reserva)
/packages
  /shared-types     # Tipos TS de referencia para apps/web (interfaces espejo de los structs Go; se mantienen a mano, ver TR-001)
/docs
  implementation-plan.md   # este documento
  tradeoffs.md              # decisiones y supuestos con alternativas descartadas
docker-compose.yml    # Postgres local
turismo-marcuzzi-spec.md
CLAUDE.md
```

Toda tarea que agregue código nuevo debe caer dentro de esta estructura; si una tarea necesita un directorio no listado acá, se agrega a esta tabla en el mismo PR.

---

## 4. Requisitos funcionales (FR) — mapeo a la spec

| ID | Requisito | Sección spec |
|---|---|---|
| FR-1 | Home / landing con 3 categorías | 4.1 |
| FR-2 | Listado de alojamiento con filtros | 4.2 |
| FR-3 | Detalle de alojamiento (galería, mapa, calendario, reseñas) | 4.2 |
| FR-4 | Experiencias: listado, detalle, reserva con cupos | 4.3 |
| FR-5 | Traslado al aeropuerto: formulario, selección de vehículo y confirmación | 4.5 |
| FR-6 | Usuarios: registro/login, perfil, roles | 4.6 |
| FR-7 | Reservas: estados, confirmación por email | 4.7 |
| FR-8 | Panel de administración (ABM, fotos, disponibilidad, reservas, moderación) | 4.8 |
| FR-9 | Pagos con Mercado Pago (alternativo al contacto directo, no reemplazo) | 4.6, 9 |
| FR-10 | No funcionales: SEO, responsive, performance, accesibilidad, seguridad | 7 |
| FR-11 | Regla de acceso a servicios: solo reserva experiencias/servicio turístico/traslados quien tiene alojamiento confirmado vigente; banner condicional en home | 4.1, 4.3, 4.4, 4.5, 4.7 (agregado 2026-08-11) |
| FR-12 | Servicio Turístico: listado, detalle, reserva con cupos (excursiones complejas, pestaña propia separada de Experiencias) | 4.4 (agregado 2026-08-11) |
| FR-13 | Catálogo de vehículos + selección de vehículo al reservar Traslado o Servicio Turístico | 4.4, 4.5, 5 (agregado 2026-08-11) |

Todas las tareas de las secciones 5–7 referencian estos IDs.

---

## 5. Fase 1 — MVP (Sprints 0 a 5, ≈ 10 semanas / 1 dev full-stack)

### Sprint 0 — Setup (3–5 días)

| ID | Tarea | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|
| T0.1 | Monorepo: `apps/web` (Next.js) + `apps/api` (Go, módulo `chi`) + `packages/shared-types` | — | 1d | `apps/web` corre con `npm run dev`; `apps/api` corre con `go run ./cmd/api`; ambos exponen un healthcheck |
| T0.2 | PostgreSQL local (docker-compose) + GORM conectado desde `apps/api` | T0.1 | 1d | Migraciones corren contra Postgres local sin error; `apps/api` conecta y hace ping a la DB al arrancar |
| T0.3 | Esquema inicial de DB: `usuario`, `alojamiento`, `foto`, `reserva`, `resena` (spec §5) | T0.2 | 2d | Migración SQL aplica el ERD de la spec; constraint `sin_solapamiento` (daterange + btree_gist) creada y probada con un insert que solapa (debe fallar) |
| T0.4 | CI básico: lint + vet + build en cada push (Go) y lint + typecheck + build (Next.js) | T0.1 | 1d | Pipeline falla si `go vet`/`golangci-lint` o el build de Next.js reportan error |
| T0.5 | Auth backend en Go (registro/login) | T0.2, T0.3 | 2d | Login/registro funcional contra la tabla `usuario`, password hasheado (bcrypt), JWT emitido por `apps/api` |

**Riesgo específico de este sprint:** si la constraint de exclusión no se prueba con un test real de solapamiento acá, el riesgo de doble reserva (el requisito no funcional más crítico de la spec) queda sin validar hasta que sea costoso de arreglar.

### Sprint 1 — Landing + Auth end-to-end (2 semanas)

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T1.1 | Hero full-screen + 3 tarjetas de categorías con textos de la spec §4.1 | FR-1 | T0.1 | 3d | Landing responsive, fade-in al scroll, hover en tarjetas, navega a cada módulo. Reserva un slot/componente vacío para el banner de FR-11 (T4.6 lo completa cuando exista `Reserva` con estado real) |
| T1.2 | Registro/login en frontend (formularios + manejo de sesión) | FR-6 | T0.5 | 3d | Usuario puede registrarse, loguearse, cerrar sesión; rutas protegidas redirigen si no hay sesión |
| T1.3 | Perfil de usuario con historial de reservas (vacío por ahora) | FR-6 | T1.2 | 2d | Página de perfil muestra datos del usuario y lista "sin reservas" |
| T1.4 | Pase mobile-first sobre landing + auth | FR-10 | T1.1, T1.2 | 2d | Lighthouse mobile ≥ 90 en performance/accesibilidad para estas páginas |

### Sprint 2 — Alojamiento: listado y detalle (2 semanas)

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T2.1 | Endpoints CRUD de alojamiento + carga de fotos a R2/S3 | FR-2, FR-8 | T0.3 | 3d | Se puede crear un alojamiento con fotos vía API y recuperarlo |
| T2.2 | Listado con filtros (fechas, huéspedes, precio) | FR-2 | T2.1 | 3d | Filtrar por rango de fechas excluye alojamientos sin disponibilidad real |
| T2.3 | Detalle: galería de fotos + descripción completa | FR-3 | T2.1 | 2d | Página de detalle renderiza galería y todos los campos del modelo |
| T2.4 | Mapa de ubicación (Leaflet + OSM) | FR-3 | T2.3 | 2d | Mapa muestra marcador en `lat`/`lng` del alojamiento |
| T2.5 | Calendario de disponibilidad con selección de rango | FR-3 | T2.1 | 3d | Fechas ocupadas (reservas activas) se muestran bloqueadas; selección de rango disponible habilita el botón de reserva |

### Sprint 3 — Reservas de alojamiento + reseñas (2 semanas)

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T3.1 | Endpoint de creación de reserva contra la exclusion constraint | FR-3, FR-7 | T0.3, T2.5 | 3d | Dos reservas concurrentes sobre el mismo rango: una tiene éxito, la otra recibe error controlado (no 500 crudo) |
| T3.2 | Flujo UI de reserva (selección → confirmación) con estados `pendiente`/`confirmada`/`cancelada` | FR-7 | T3.1, T1.2 | 3d | Usuario logueado completa una reserva y la ve reflejada en su perfil (T1.3) |
| T3.3 | Email de confirmación de reserva (Resend) | FR-7 | T3.2 | 2d | Al confirmar, el usuario recibe email con los datos de la reserva |
| T3.4 | Reseñas: alta restringida a usuarios con reserva real + listado en detalle | FR-3 | T3.2 | 3d | Solo usuarios con una reserva `confirmada` de ese alojamiento pueden dejar reseña |
| T3.5 | Formulario de contacto al reservar (nombre, apellido, DNI, email, teléfono) + vencimiento automático de reservas `pendiente` (TR-015) | FR-7 | T3.1, T3.2 | 3d | El formulario guarda `contacto_*` en la reserva (listo para que Sprint 4/T4.4 lo muestre en el panel); una reserva `pendiente` sin avanzar se cancela sola vía barrido periódico; calendario pinta ámbar/verde las fechas propias pendientes/confirmadas; botón de WhatsApp/mail con mensaje precargado tras reservar |
| T3.6 | Timer se apaga al contactar + corrección de zona horaria en la validación de fechas | FR-7 | T3.5 | 1d | `POST /reservas/{id}/contacto` marca `contactado_en`; el barrido deja de cancelar esa reserva por falta de contacto. `clock.ParseDate` reemplaza `time.Parse` crudo en la validación de check-in (bug real: comparar UTC contra `clock.Today()` corría la fecha 3h) — con test de regresión en `internal/clock` |
| T3.7 | Vencimiento en dos fases (5min contacto / 2h confirmación, TR-016) + banner global de estado + bloqueo del calendario mientras hay pendiente + modal centrado con fondo oscurecido | FR-7, FR-11 | T3.6 | 4d | Cuenta regresiva en vivo visible en el modal y en el banner (`components/countdown.tsx`); banner (`components/pending-reserva-banner.tsx`, montado vía `SiteHeader`) con 3 estados, visible en cualquier página, reemplaza al stub de FR-11; calendario del alojamiento con una reserva `pendiente` propia no deja seleccionar fechas nuevas hasta que se confirme; formulario de reserva en un `<Modal>` portaleado a `document.body` (bug real corregido: `position: sticky` en un ancestro rompía el z-index del modal contra el header) |
| T3.8 | Panel de notificaciones (🔔) separado del banner de 5 min (TR-017) | FR-7, FR-11 | T3.7 | 2d | Banner global reducido a 1 sola fase (5min sin contactar), ahora cerrable; ícono 🔔 nuevo en el header (`notifications-bell.tsx`/`notifications-bell-client.tsx`, montado como `notificationsSlot` en `SiteHeader`) lista TODAS las reservas en curso del usuario (esperando confirmación + confirmadas vigentes), no solo la más urgente — verificado con 2 reservas simultáneas en alojamientos distintos, ambas visibles a la vez en el panel |
| T3.9 | Franja "esperando confirmación" apilable y cerrable por reserva + cierre persistente por ítem en el panel 🔔 + menú de cuenta con forma de persona (TR-018) | FR-7, FR-11 | T3.8 | 3d | `esperando-confirmacion-banner*.tsx` apila una franja ámbar por reserva contactada, cerrable sin afectar el panel de notificaciones (clave distinta, `lib/notificaciones-cerradas.ts`); en el panel, "esperando confirmación" se pinta ámbar y "confirmada" dice "Se confirmó tu reserva...", ambos cerrables ítem por ítem, y la reserva reaparece como novedad al cambiar de tipo; `account-menu.tsx` reemplaza el pill "Mi perfil"+botón "Salir" sueltos por un ícono de persona con dropdown (Mi perfil / Mi cronograma — placeholder nuevo, `app/cronograma/page.tsx` / Cerrar sesión) — verificado con 2 reservas contactadas en alojamientos distintos mostrando 2 franjas apiladas a la vez |

### Sprint 4 — Panel de administración básico (2 semanas)

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T4.1 | ✅ Rol `administrador` + layout y ruteo protegido del panel | FR-8 | T1.2 | 2d | `app/admin/layout.tsx` (chequeo DAL, mismo criterio que /perfil) + `proxy.ts` (optimista) redirigen a quien no es admin; `AccountMenu` (T3.9) suma el link "Panel admin" solo para `rol === "administrador"` |
| T4.2 | ✅ ABM de alojamientos desde el panel (crear/editar/dar de baja, carga de fotos) | FR-8 | T4.1, T2.1 | 3d | `app/admin/alojamientos/**` — el backend (CRUD + fotos) ya existía de T2.1, admin-gateado; se sumó `?incluirInactivos=true` en `GET /alojamientos` (solo con JWT admin, TR-019) para que el panel vea también los dados de baja |
| T4.3 | ✅ Gestión de disponibilidad y precios desde el panel | FR-8 | T4.2 | 2d | Precio: mismo formulario de T4.2 (`precioNoche`). Bloqueo manual de fechas: `bloqueos.go` (nuevo), reutiliza la tabla `reservas` con `EsBloqueoAdmin=true` para heredar el exclusion constraint sin duplicar la garantía anti-solapamiento (TR-019) — `BloqueosManager` en la página de edición |
| T4.4 | ✅ Listado y gestión de reservas entrantes (cambiar estado) | FR-7, FR-8 | T4.1, T3.2, T3.5 | 3d | `GET /reservas` + `PATCH /reservas/{id}/estado` (admin) — transiciones pendiente→confirmada/cancelada, confirmada→cancelada; `cancelada` es terminal. `app/admin/reservas/page.tsx` con tabs por estado, muestra contacto (T3.5) + quién reservó. Confirmar dispara `sendConfirmada` (email) y `revalidatePath("/", "layout")` (banner/notificaciones del cliente, T4.6) |
| T4.5 | ✅ Moderación de reseñas (aprobar/eliminar) | FR-8 | T4.1, T3.4 | 2d | `Resena.Oculta` (soft delete) + `GET /resenas`/`PATCH /resenas/{id}` (admin) — el listado público y `loadRatings` (promedio) ya filtran `oculta = false`; `app/admin/resenas/page.tsx` con botón ocultar/mostrar |
| T4.6 | ✅ Regla de acceso a servicios: endpoint "¿tengo alojamiento confirmado vigente?" + banner condicional en home | FR-11 | T4.4, T1.1 | 2d | `GET /me/alojamiento-vigente` devuelve `{"vigente": bool}` usando `clock.Today()` (no `time.Now()`, R8) — verificado con curl que responde según el estado real de la reserva |
| T4.7 | ✅ Banner "confirmado" al header (una vez, cerrable) + bell no-cerrable en espera + expirer borra en vez de cancelar (TR-020) | FR-11 | T4.6, T3.9 | 2d | El banner de T4.6 se muda de la home a `bannerSlot` (mismo mecanismo apilable/cerrable que T3.9); en el panel de notificaciones "esperando confirmación" ya no tiene botón de cierre; `internal/reservas.ExpirePendientes` borra la fila (no soft-cancela) al vencer por timeout — verificado con 3 reservas confirmadas vigentes mostrando 3 franjas apiladas a la vez |
| T4.8 | ✅ Admin de solo lectura en páginas de cliente + pulido de usabilidad del panel (TR-020) | FR-8, FR-11 | T4.1–T4.6 | 2d | Backend rechaza (403) `POST` de reserva/reseña para rol admin; frontend pone `AvailabilityCalendar` en modo lectura y oculta `ResenaForm` para esa cuenta; `/perfil` de un admin reemplaza "Tus reservas" por un atajo grande al panel; `admin-nav.tsx` (ícono + color por sección) y tarjetas del dashboard con acento a juego — verificado con curl (403 real al intentar reservar/reseñar como admin) y limpieza de datos de prueba (reservas del admin y canceladas legacy purgadas) |
| T4.9 | ✅ Tabla de reservas (filtro/búsqueda client-side, filas expandibles) + header sólido más oscuro (TR-021) | FR-8 | T4.4, T4.8 | 2d | `reservas-table.tsx`/`estado-dot.tsx` reemplazan las tarjetas apiladas por una tabla con scroll propio, punto de color por estado (marrón/verde/rojo) y fila expandible con acciones al final; tabs y búsqueda (nombre/DNI/email/teléfono, sin tildes) filtran en memoria, sin recargar. `site-header.tsx` pasa a `bg-ink` sólido — verificado con curl que la tabla renderiza filas/dots correctos por tab y que el header ya no se confunde con el fondo de página |
| T4.10 | ✅ Panel admin: blanco sólido, segmented control sans, DNI como columna principal (TR-022) | FR-8 | T4.9 | 1d | `cardClass` y la tabla de reservas pasan de `bg-white/60` a `bg-white` sólido (pauta para todo el panel); tabs de estado con segmented control (tipografía sans, no `tracked-caps`) y buscador alineado con `sm:ml-auto`, todo dentro de una sola tarjeta blanca; DNI visible en la fila (antes solo en el detalle expandido) — verificado con curl que las clases y valores de DNI aparecen correctos por fila |
| T4.11 | ✅ Tabla de alojamientos (mismo patrón que reservas) + fix overscroll tapando el header + restructura tipográfica (TR-023/TR-024) | FR-8, FR-10 | T4.10 | 2d | `alojamientos-table.tsx` reemplaza las tarjetas apiladas del listado de alojamientos con el mismo patrón que reservas (tabs Activos/De baja/Todos, búsqueda, filas expandibles). `overscroll-behavior: none` en `<html>` arregla el header tapado por rebote elástico del touchpad. Nunito Sans (títulos, un peso 800) + Inter (cuerpo) reemplazan a Vidaloka + IBM Plex Sans — verificado con curl que las variables de fuente y las reglas CSS nuevas están en el bundle compilado |
| T4.12 | ✅ Tabla de reseñas (mismo patrón, quedó pendiente en T4.11) | FR-8 | T4.11 | 1d | `resenas-table.tsx` reemplaza el listado de tarjetas apiladas de `/admin/resenas` — tabs Visibles/Ocultas/Todas, búsqueda (usuario/alojamiento/texto), fila con punto de estado + rating + texto truncado, expandible con el texto completo y la acción de ocultar/mostrar al final. Único de las tres tablas del panel que no se había convertido en la ronda anterior — verificado con curl |
| T4.13 | ✅ Reservas editables + edición dinámica de alojamiento in situ + "editor de página" (solo fotos, Home) (TR-025) | FR-7, FR-8 | T4.12 | 4d | `PATCH /reservas/{id}` (admin) edita fechas/contacto de pendiente/confirmada. `/alojamiento/{id}` detecta admin y muestra toggle Ver/Editar reutilizando `AlojamientoForm` + `FotosManager` (ahora acepta video, `db.Foto.Tipo`) directamente en la página pública. `/alojamiento` (listado) edita su título/descripción vía `ContenidoSitio` (clave→texto, modelo chico a propósito). `/admin/editor-pagina` (nuevo, nav) gestiona fotos de home (hero ×4 + categorías ×4) vía `ImagenSitio` (clave→url) — verificado con curl: PATCH de reserva real, upsert de contenido/imagen (incluido el bug de `Save()` con PK string atrapado antes de terminar), y barrido de 10 páginas sin errores |
| T4.14 | ✅ Modo editor solo por navegación explícita + foto de portada separada de la galería (TR-027) | FR-7, FR-8 | T4.13 | 2d | Se saca la edición de `/alojamiento` (listado, `ContenidoSitio`) por pedido del cliente — vuelve a shell 100% estático. El modo editor de `/alojamiento/{id}` ya no se activa solo (esAdmin); requiere `?modo=editor`, que ahora agrega el botón "Editar" del panel. `db.Foto.EsPortada` + `POST /alojamientos/{id}/portada` — miniatura del listado, separada de la galería, a lo sumo una activa por alojamiento (transacción). `/admin/alojamientos/{id}` se reduce a disponibilidad (bloqueos) — datos/fotos se mudan al modo editor de la página pública — verificado con curl: portada se sube/reemplaza/refleja en la tarjeta del listado, `?modo=editor` bloqueado para no-admins, banner de edición ausente en navegación normal |
| T4.15 | ✅ Foto de portada se edita desde la tarjeta del listado (TR-028) | FR-7, FR-8 | T4.14 | 1d | "Editar portada" (toggle plegable, reutiliza `FotoPortadaManager`) y "Modo editor" (atajo a `?modo=editor`) se agregan a cada tarjeta de `/alojamiento` para un admin — se sacan del modo editor del detalle. La tarjeta pasa de un solo `<Link>` a dos + bloque admin aparte (un botón no puede anidarse en un `<a>`) — verificado con curl: ambos controles presentes solo para admin, ausentes para cliente, sección "Foto de portada" ya no aparece en el modo editor del detalle |
| T4.16 | ✅ "Modo editor" se muda de la tarjeta a la página del alojamiento (TR-029) | FR-7, FR-8 | T4.15 | 0.5d | El link "Modo editor" se saca de `AlojamientoCard` y se agrega en `/alojamiento/{id}` (vista normal, debajo de la descripción, solo admin) — la tarjeta del listado queda solo con "Editar portada" — verificado con curl: "Modo editor" ausente en la tarjeta, presente en la página del alojamiento (solo para admin, ausente para cliente) |
| T4.17 | ✅ Banner "Modo editor" prominente al principio + límites de subida foto/video separados (TR-030) | FR-7, FR-8 | T4.16 | 1d | El link pasa a banner (`border-dune/30 bg-dune/10` + botón primario) antes de la galería, no debajo de la descripción. `maxImageUploadBytes` (15MB) / `maxVideoUploadBytes` (300MB) reemplazan el único límite de 60MB; timeout global del router sube de 30s a 5 min (300MB no entraba en 30s en una conexión típica) — verificado con curl: banner presente al principio para admin, ausente para cliente, subida de imagen sigue funcionando con los nuevos límites |

### Sprint 5 — Pulido, QA y salida a producción (1–2 semanas)

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T5.1 | SSR/SSG + metadatos + sitemap para landing y alojamiento | FR-10 | T2.3 | 1d | Páginas de alojamiento indexables, metadatos OpenGraph correctos. **Base ya resuelta en T1.2:** `cacheComponents` activado y el layout raíz sirve shell estático (Partial Prerendering) con el estado de sesión detrás de `<Suspense>` (`components/account-status.tsx`) — cualquier página nueva que lea `cookies()`/`headers()`/`searchParams` debe seguir el mismo patrón (contener la lectura en un componente async chico envuelto en Suspense) para no volver dinámica toda la ruta |
| T5.2 | Pase de accesibilidad (contraste, alt text, navegación por teclado) | FR-10 | T1.1–T4.5 | 1d | Auditoría axe/Lighthouse sin errores críticos |
| T5.3 | Optimización de imágenes (WebP/AVIF, lazy loading, CDN) | FR-10 | T2.1 | 2d | Imágenes servidas en formato moderno con lazy loading en listados. **Nota (2026-08-13, TR-026):** `next.config.ts` corre hoy con `images.unoptimized: true` — `remotePatterns` rechazaba con 400 cualquier foto real (bug no resuelto, probablemente de Next 16.3.0/Turbopack en dev). Esta tarea tiene que investigar la causa real o asumir que se resuelve solo al migrar a R2/S3 (T5.3 trae su propio pipeline) |
| T5.4 | QA end-to-end de los flujos de auth, reserva y admin | FR-6, FR-7, FR-8 | Sprints 1–4 | 3d | Checklist de flujos críticos (registro→reserva→confirmación→gestión admin) pasa sin bugs bloqueantes |
| T5.5 | Deploy a producción + backups automáticos de Postgres | FR-10 | T5.4 | 2d | Sitio accesible en dominio final; backup diario configurado y probado con un restore |

**Cierre de Fase 1 = MVP según spec §9 (Fase 1).**

---

## 6. Fase 2 — Experiencias, servicio turístico, traslados y vehículos (Sprints 6–9, ≈ 7–8 semanas)

> Ampliada 2026-08-11: el cliente pidió una pestaña principal de **Servicio Turístico** separada de Experiencias (excursiones más complejas, ver TR-009) y **selección de vehículo** al reservar Traslado o Servicio Turístico, sobre la gama de vehículos que el cliente carga en el panel (TR-010). Esto agrega un Sprint completo (8) y tareas nuevas en el 7 y el 9 frente al plan original de 3 sprints.

### Sprint 6 — Experiencias

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T6.1 | CRUD de experiencias + slots (`SLOT.cupos_disponibles`) en backend | FR-4, FR-8 | T0.3 | 3d | Se crea una experiencia con múltiples slots de fecha/hora y cupo |
| T6.2 | Listado y detalle de experiencias | FR-4 | T6.1 | 3d | Detalle visible para cualquier visitante (logueado o no), sin restricción — muestra fotos, duración, punto de encuentro, precio |
| T6.3 | Reserva con selección de fecha/horario y control de cupos concurrente | FR-4, FR-7, FR-11 | T6.1, T3.1, T4.6 | 5d | Dos reservas simultáneas sobre el último cupo: solo una tiene éxito (transacción con locking, ver riesgo R4). Además: el endpoint de reserva devuelve 403 si el usuario no tiene alojamiento confirmado vigente (T4.6); el frontend reemplaza el botón "Reservar" por un mensaje ("Confirmá tu alojamiento para reservar servicios") en ese caso |
| T6.4 | Reseñas de experiencias (reutiliza componente de T3.4) | FR-4 | T3.4, T6.2 | 1d | Mismo criterio de reseña-solo-con-reserva que alojamiento |

### Sprint 7 — Vehículos y Traslados

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T7.1 | CRUD de vehículos en backend + exclusion constraint `sin_solapamiento_vehiculo` (`tstzrange` sobre `vehiculo_id`, ver spec §5) | FR-13 | T0.3 | 3d | Se crea un vehículo (tipo, nombre, capacidad, fotos, activo) vía API; test manual de dos reservas con `rango_horario` solapado sobre el mismo `vehiculo_id`: una falla con error controlado, igual que T3.1 para alojamiento |
| T7.2 | Formulario de reserva de traslado (fecha, vuelo, pasajeros, dirección, ida/vuelta) + selección de vehículo | FR-5, FR-13 | T1.2, T7.1 | 3d | Formulario visible para cualquier visitante; valida todos los campos requeridos por spec §4.5; muestra la gama de vehículos activos (filtrable por capacidad ≥ pasajeros). El botón de envío se deshabilita (con el mismo mensaje de T6.3) si el usuario no tiene alojamiento confirmado vigente |
| T7.3 | Backend de traslados + confirmación, calculando `fecha_hora_inicio`/`fecha_hora_fin` del vehículo a partir de la hora del vuelo + margen acordado con el cliente (ver riesgo R10) | FR-5, FR-7, FR-11, FR-13 | T7.2, T0.3, T4.6 | 3d | Reserva de traslado queda persistida con estado `pendiente`, `vehiculo_id` y `rango_horario`; el endpoint devuelve 403 si no hay alojamiento confirmado vigente (misma regla que T6.3) y un error controlado (no 500) si el vehículo elegido ya está asignado a un horario solapado (T7.1) |
| T7.4 | Email de confirmación de traslado (incluye el vehículo asignado) | FR-5 | T7.3, T3.3 | 1d | Usuario recibe email con los datos pactados del traslado, incluyendo qué vehículo le fue asignado |

### Sprint 8 — Servicio Turístico *(nuevo, agregado 2026-08-11)*

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T8.1 | CRUD de servicio turístico + slots (`SLOT_SERVICIO.cupos_disponibles`) en backend — mismo patrón que T6.1 | FR-12, FR-8 | T0.3 | 3d | Se crea un servicio turístico con múltiples slots de fecha/hora y cupo |
| T8.2 | Listado y detalle de servicio turístico | FR-12 | T8.1 | 3d | Visible para cualquier visitante; muestra fotos, duración, punto de encuentro, precio; copy/diseño deja clara la diferencia frente a Experiencias (spec §4.3) |
| T8.3 | Reserva con selección de fecha/horario, control de cupos concurrente y selección de vehículo | FR-12, FR-7, FR-11, FR-13 | T8.1, T6.3, T7.1 | 5d | Mismo criterio de concurrencia de cupos que T6.3, más: el vehículo elegido debe estar libre en el horario del slot (constraint de T7.1); 403 si no hay alojamiento confirmado vigente |
| T8.4 | Reseñas de servicio turístico (reutiliza componente de T3.4) | FR-12 | T3.4, T8.2 | 1d | Mismo criterio de reseña-solo-con-reserva que Experiencias/alojamiento |

### Sprint 9 — Panel admin ampliado

| ID | Tarea | FR | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T9.1 | ABM de experiencias y slots/cupos desde el panel | FR-8 | T4.1, T6.1 | 3d | Admin crea/edita experiencias y ajusta cupos sin tocar DB |
| T9.2 | ABM de servicio turístico y slots/cupos desde el panel | FR-8, FR-12 | T4.1, T8.1 | 3d | Admin crea/edita servicios turísticos y ajusta cupos sin tocar DB, mismo patrón que T9.1 |
| T9.3 | ABM del catálogo de vehículos (tipo, nombre, capacidad, descripción, fotos, activo) | FR-8, FR-13 | T4.1, T7.1 | 2d | Admin carga/edita/da de baja vehículos, reutilizando el pipeline de carga de fotos de T2.1 |
| T9.4 | ABM de traslados + gestión de reservas de traslado | FR-8 | T4.1, T7.3 | 2d | Admin ve y gestiona reservas de traslado igual que las de alojamiento, incluyendo el vehículo asignado |
| T9.5 | Dashboard resumen (reservas por tipo/estado) | FR-8 | T4.4, T9.4 | 2d | Panel muestra conteo de reservas pendientes/confirmadas por módulo (alojamiento, experiencias, servicio turístico, traslados) |

**Cierre de Fase 2 = spec §9 (Fase 2).**

---

## 7. Backlog (Fase 3 y 4 de la spec — no planificado en detalle)

Resumen de alto nivel, a re-planificar cuando arranque:

- **Fase 3:** integración de cobro con Mercado Pago (checkout + webhooks + estado de `PAGO`), SEO avanzado / Core Web Vitals, mejoras de UX con feedback real de uso, i18n ES/EN si se confirma (TR-004).
- **Fase 4:** chat/WhatsApp integrado, programa de fidelización, analíticas, posible app móvil nativa.

---

## 8. Camino crítico (MVP)

```
T0.1 → T0.2 → T0.3 → T0.5 (auth)
                 └→ T2.1 → T2.5 → T3.1 → T3.2 → T4.4 → T5.4 → T5.5
```

Setup y auth (Sprint 0–1) bloquean todo lo demás. Dentro de Fase 1, la cadena `CRUD alojamiento → calendario → constraint de reserva → flujo de reserva → gestión admin de reservas → QA → deploy` es la que determina la fecha de salida del MVP; el resto de las tareas (mapa, fotos, reseñas, accesibilidad) puede paralelizarse alrededor de esa cadena si hay más de un desarrollador.

---

## 9. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Doble reserva de alojamiento por condición de carrera | Alto — pérdida de confianza del cliente final | Exclusion constraint a nivel DB (T0.3) validada con test de concurrencia antes de construir UI sobre ella |
| R2 | Sobreventa de cupos en experiencias y servicio turístico (no tienen constraint tan directa como alojamiento) | Alto | T6.3 y T8.3 deben usar transacción con locking explícito (`SELECT ... FOR UPDATE` o decremento atómico), no solo chequeo-y-escritura desde la app |
| R3 | Decisiones de spec §10 sin confirmar (pagos, bilingüe, mapas, stack) frenan o revierten trabajo ya hecho | Medio-Alto | Congelar las decisiones asumidas en `docs/tradeoffs.md` con el cliente antes de Sprint 1; cualquier respuesta distinta dispara una revisión de este plan, no un parche sobre la marcha |
| R4 | Fotos pesadas degradan performance/SEO de un sitio que depende de tráfico orgánico | Medio | Pipeline de optimización de imágenes (T5.3) no se deja para el final: la carga a storage (T2.1) ya debe generar variantes optimizadas |
| R5 | "Lista concreta de experiencias" no definida por el cliente bloquea carga de contenido real en Sprint 6 | Medio | Usar datos de prueba/mock en Sprint 6 y cargar contenido real en Sprint 8 si el cliente todavía no lo definió |
| R6 | Un solo desarrollador full-stack es punto único de fallo para el cronograma, agravado por manejar dos lenguajes (TS + Go, TR-001) | Medio-Alto | Mantener el backend Go detrás de repositorios/servicios simples (TR-006) y el frontend en un framework estándar (Next.js) para que sumar una segunda persona a mitad de proyecto sea más barato, aunque el costo de cambio de contexto entre lenguajes seguirá existiendo |
| R7 | `packages/shared-types` (TS) no se genera automáticamente desde los structs de Go — puede desincronizarse | Medio | Revisar `shared-types` en cada PR que cambie contratos de API en `apps/api`; evaluar generar tipos desde OpenAPI en Fase 2 si la desincronización se vuelve frecuente |
| R8 | Regla de acceso a servicios (FR-11) depende de comparar `fecha_fin >= hoy` contra la hora del servidor; una zona horaria mal configurada puede desbloquear/bloquear a un huésped un día antes o después de lo esperado | Medio | **Mitigado en Sprint 0:** `apps/api/internal/clock` expone `Today()` fijado a `America/Argentina/Buenos_Aires` (UTC-3, sin DST desde 2009), con `time/tzdata` embebido para no depender de que el contenedor de deploy tenga zoneinfo instalado. T4.6/T6.3/T7.2 deben usar `clock.Today()`, nunca `time.Now()` directo, para esta comparación |
| R9 | Un huésped legítimo cuya reserva sigue `pendiente` (pago en curso, contacto en proceso) espera ver el banner y no lo ve, y puede interpretarlo como un error del sitio | Bajo-Medio | Mensaje claro en el perfil (T1.3) para reservas `pendiente`: "Tu reserva está pendiente de confirmación por el anfitrión", para no dejar al usuario sin feedback mientras el admin confirma (T4.4) |
| R10 | La ventana horaria que un traslado ocupa a un vehículo (`fecha_hora_inicio`/`fecha_hora_fin` en spec §5) no está definida — ¿qué margen antes/después de la hora del vuelo se reserva el vehículo? Sin definirlo, T7.3 puede subestimar el margen (vehículo "libre" en el sistema pero en tránsito en la realidad) o sobreestimarlo (rechaza reservas válidas por error) | Medio | Acordar el margen con el cliente antes de implementar T7.3 (p. ej. "1h antes del vuelo + 1h después" como default razonable); dejarlo como constante configurable, no hardcodeada, para poder ajustarla sin migración |

---

## 10. Decisiones asumidas para poder planificar

Este plan no espera confirmación del cliente para tener una fecha de referencia, pero toma postura sobre la sección 10 de la spec. El detalle de cada una (alternativas descartadas, qué se sacrifica) está en `docs/tradeoffs.md`:

- TR-001: Backend en Go (Opción B) en vez de TypeScript end-to-end.
- TR-002: Reserva + contacto directo dueño↔cliente + confirmación manual del admin en el MVP (spec §4.7, confirmado por el cliente el 2026-08-11); Mercado Pago queda como alternativa a evaluar, no reemplazo.
- TR-003: Leaflet + OpenStreetMap en vez de Google Maps.
- TR-004: MVP solo en español; bilingüe ES/EN queda para Fase 3 si se confirma.
- TR-005: Exclusion constraint de PostgreSQL (no lógica de aplicación) para evitar dobles reservas.
- TR-006: chi + GORM como framework HTTP y capa de acceso a datos del backend Go.
- TR-007: Acceso a servicios (FR-11) atado a alojamiento confirmado **vigente** (`fecha_fin >= hoy`), no a "alguna vez confirmado" ni a "solapado con la fecha del servicio". Extendido a Servicio Turístico además de Experiencias/Traslados.
- TR-009: Servicio Turístico como tabla separada de Experiencia (no un campo de categoría compartido).
- TR-010: Catálogo de vehículos con selección por reserva + exclusion constraint GiST propio (`tstzrange`), no un catálogo puramente informativo.
- TR-011: Servicio Turístico se reserva con cupos/horarios fijos (mismo mecanismo que Experiencias), no con un flujo de cotización a medida.
- TR-012: Tipografía Vidaloka + IBM Plex Sans/Mono (display/cuerpo/utilitaria) en vez de Fraunces + Figtree.
- TR-013: Storage de fotos en disco local (T2.1) detrás de `internal/storage.Storage`, hasta tener credenciales reales de R2/S3 — no apto para producción tal cual.
- TR-014: Email transaccional (T3.3) con `LogSender` (loguea, no manda) detrás de `internal/email.Sender`, mismo espíritu que TR-013, hasta tener API key de Resend.
- TR-015: Formulario de contacto al reservar (T3.5) + vencimiento automático de reservas `pendiente`; el exclusion constraint (TR-005) no cambia — pendiente sigue bloqueando como cualquier reserva activa.
- TR-016: Vencimiento en dos fases (5min contacto / 2h confirmación, T3.6/T3.7), banner global de estado (reemplaza el stub de FR-11), bloqueo del calendario por alojamiento mientras hay una reserva pendiente propia, y modal centrado (portal a `document.body`) para el formulario de reserva.
- TR-017: Panel de notificaciones (🔔 en el header, T3.8) separado del banner de 5 min — el banner vuelve a ser de una sola fase (crítica, cerrable), el resto del estado (esperando confirmación, confirmada) vive en un dropdown que lista todas las reservas en curso, no solo la más urgente.
- TR-018: Franja "esperando confirmación" apilable/cerrable por reserva (T3.9), cierre persistente por notificación vía localStorage (`lib/notificaciones-cerradas.ts`, `useSyncExternalStore`), y menú de cuenta con forma de persona (`account-menu.tsx`) que agrupa perfil/cronograma/cerrar sesión.
- TR-019: Panel de administración (Sprint 4) — bloqueos manuales de fechas (T4.3) reutilizan la tabla `reservas` (`EsBloqueoAdmin`) para heredar el exclusion constraint (TR-005) sin duplicar la garantía anti-solapamiento; `isAdminCaller` habilita `?incluirInactivos=true` en el listado público de alojamientos solo para un caller admin.
- TR-020: Banner "confirmado" pasa de la home al header (una vez, cerrable, T4.7); "esperando confirmación" deja de ser cerrable en el panel de notificaciones; el expirer borra en vez de soft-cancelar (T4.7); el admin queda de solo lectura en las páginas de cliente — no puede reservar ni reseñar, 403 real en el backend (T4.8).
- TR-021: Tabla de reservas del admin con filtro/búsqueda client-side y filas expandibles (T4.9), reemplaza las tarjetas apiladas; header pasa de `bg-sand/95` a `bg-ink` sólido por poco contraste contra el fondo de página.
- TR-022: Panel admin — blanco sólido (no translúcido) en tarjetas/tabla, segmented control sans para tabs de estado, DNI como columna visible de la fila (T4.10) — pauta a seguir en toda herramienta nueva del panel.
- TR-023: Restructura tipográfica — Nunito Sans (títulos) + Inter (cuerpo) reemplazan a Vidaloka + IBM Plex Sans (TR-012, T4.11), pedido directo del cliente.
- TR-024: Tabla de alojamientos con el mismo patrón que reservas (T4.11); `overscroll-behavior: none` arregla el header tapado por el rebote elástico del scroll con touchpad.
- TR-025: Reservas editables (T4.13, no solo confirmar/cancelar), edición de alojamiento in situ en su propia página pública (reutiliza `AlojamientoForm`/`FotosManager`, ahora con video), y "editor de página" nuevo en el panel — alcance acotado a solo fotos de Home (hero + categorías) vía `ImagenSitio`; texto del listado de Alojamiento vía `ContenidoSitio` aparte.
- TR-026: `images.unoptimized: true` en `next.config.ts` — bug real de `remotePatterns` (rechazaba cualquier foto real con 400, nunca detectado antes porque hasta T4.13 no había fotos reales cargadas en las pruebas); revisar de nuevo en T5.3.
- TR-027: Modo editor de un alojamiento solo por `?modo=editor` (ya no automático para cualquier admin, T4.14); foto de portada (`db.Foto.EsPortada`) separada de la galería para la miniatura del listado; se saca la edición de texto del listado de Alojamiento que había en T4.13.
- TR-028: La edición de la foto de portada se muda de nuevo, del modo editor del detalle a la propia tarjeta del listado (T4.15) — "Editar portada" + "Modo editor" en cada tarjeta, solo para admin.
- TR-029: "Modo editor" se saca de la tarjeta del listado y se agrega dentro de la propia página del alojamiento (T4.16) — la tarjeta queda solo con "Editar portada".
- TR-030: Banner "Modo editor" prominente al principio de la página (T4.17), mismo estilo que "Vista de administrador"; límites de subida separados foto (15MB)/video (300MB), timeout del router a 5 minutos.
- TR-031: `experimental.serverActions.bodySizeLimit: "310mb"` en `next.config.ts` — el límite de 1MB que chocaba al subir video era de Next.js (Server Actions), no del backend Go; TR-030 solo había subido el límite de la API.

Si el cliente responde distinto a alguna de estas, el sprint afectado (ver columna "Depende de" arriba) debe re-estimarse antes de arrancarlo, no a mitad de sprint.

---

## 11. Criterios de salida de este plan

- [x] Componentes de arquitectura documentados (sección 2).
- [x] Sección de estructura de archivos antes de las tareas (sección 3).
- [x] Todas las tareas de Fase 1 y 2 aparecen en la estructura de archivos (monorepo único, sin excepciones).
- [x] Todos los FR (sección 4) están mapeados a al menos una tarea.
- [x] Todas las tareas tienen criterio de aceptación.
- [x] Dependencias forman un grafo acíclico (ver columna "Depende de"; verificado manualmente, sin ciclos).
- [x] Estimaciones de esfuerzo por tarea (días, asumiendo 1 dev full-stack senior).
- [x] Camino crítico identificado (sección 8).
- [x] Riesgos evaluados con mitigación (sección 9).
- [x] Sprints de 2 semanas (~10 días hábiles) balanceados: ningún sprint supera ~15 días-persona de esfuerzo sumado.

---

## 12. Iniciativa transversal — Pipeline de CI: tests unitarios y quality gates

> Agregada 2026-08-14, a pedido del cliente: pulir el pipeline de CI en 3 etapas — **Etapa 1: Run tests and quality gates** (esta sección), Etapa 2: análisis estático con SonarCloud, Etapa 3: deploy. Las etapas 2 y 3 quedan fuera de alcance por ahora — no planificadas en detalle, solo mencionadas para que quede registro del objetivo final. No es un requisito de la spec del producto (no mapea a un FR de la sección 4) — es una iniciativa de calidad de ingeniería sobre el código ya construido en Fase 1/2.

### 12.0 Decisiones de arquitectura para esta fase

Tres decisiones con alternativas reales, confirmadas con el cliente el 2026-08-14 — registradas también en `docs/tradeoffs.md` (TR-038/TR-039/TR-040):

1. **Backend: Postgres real por transacción, no mocks de DB.** Cada test corre contra un Postgres efímero (el mismo `docker-compose.yml` en local, un service container en CI) dentro de una transacción que se revierte al final — aislado y rápido, sin mantener un mock sincronizado a mano con lo que GORM genera. Es la única forma de probar de verdad el exclusion constraint de reservas (TR-005) y el nuevo de vehículos (TR-010), que no se pueden simular con `go-sqlmock`. Usa una base de datos de test **separada** de la de desarrollo (nunca `turismo_marcuzzi`) — no repetir el incidente de esta semana donde un `docker compose down -v` borró datos reales.
2. **Frontend: Vitest, no Jest.** Nativo ESM, mejor encaje con Turbopack/Next 16, coverage v8 con thresholds configurables sin herramienta extra.
3. **Coverage del frontend: 80% sobre `lib/`, `app/actions/` y componentes cliente con lógica — NO sobre `app/**/page.tsx`/`layout.tsx`.** Los Server Components async no son unit-testeables de forma estándar (Testing Library no los renderiza); incluirlos en el denominador empujaría a escribir tests artificiales solo para inflar el número. Quedan mejor cubiertos por QA end-to-end (T5.4) que por unit tests.

### 12.1 Estructura de archivos nuevos

| Archivo/directorio | Tarea que lo crea |
|---|---|
| `apps/api/internal/testdb/testdb.go` (helper: conecta a Postgres de test, migra una vez, devuelve `*gorm.DB` transaccional por test) | T12.1 |
| `apps/api/.env.test.example` (documenta `DATABASE_URL` de test) | T12.1 |
| `apps/api/internal/clock/clock_test.go` (ya existe, se amplía) | T12.2 |
| `apps/api/internal/auth/jwt_test.go` | T12.3 |
| `apps/api/internal/config/config_test.go` | T12.4 |
| `apps/api/internal/storage/local_test.go` | T12.5 |
| `apps/api/internal/email/log_sender_test.go` | T12.6 |
| `apps/api/internal/http/middleware_test.go` | T12.7 |
| `apps/api/internal/http/auth_test.go` | T12.8 |
| `apps/api/internal/http/alojamientos_test.go` | T12.9 |
| `apps/api/internal/http/reservas_test.go` | T12.10 |
| `apps/api/internal/http/resenas_test.go`, `bloqueos_test.go`, `contenido_test.go`, `imagenes_test.go` | T12.11 |
| `apps/api/internal/reservas/expirer_test.go` | T12.12 |
| `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts` | T12.14 |
| `apps/web/src/lib/*.test.ts` (uno por módulo de `lib/`) | T12.15 |
| `apps/web/src/lib/api.test.ts` | T12.16 |
| `apps/web/src/app/actions/admin.test.ts` (y demás archivos de `actions/`) | T12.17 |
| `apps/web/src/components/**/*.test.tsx` (LocationPicker, FotosManager, modal, account-menu, etc.) | T12.18 |
| `.github/workflows/ci.yml` (modificado: nuevo job/steps "Run tests and quality gates") | T12.20 |
| `README.md` (modificado: cómo correr tests localmente) | T12.21 |

### 12.2 Sprint T-Backend — Tests unitarios Go (≈ 4 días)

| ID | Tarea | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|
| T12.1 | Helper `testdb`: conecta a Postgres de test (env var separada), corre `cmd/migrate` una vez por suite, devuelve una transacción por test (`t.Cleanup` hace rollback) | — | 1d | Dos tests que usan `testdb.New(t)` en paralelo no interfieren entre sí; correr la suite completa dos veces seguidas da el mismo resultado |
| T12.2 | Tests de `internal/clock` (ya hay uno — ampliar a `ParseDate`, medianoche exacta, fin de año, forzar timezone) | — | 0.5d | Cobertura de `clock` ≥ 90% (es el módulo más crítico de negocio, FR-11) |
| T12.3 | Tests de `internal/auth` (generar/parsear JWT, expiración, firma inválida, rol embebido) | — | 0.5d | Un token expirado y uno con firma alterada fallan `ParseToken` con error distinguible |
| T12.4 | Tests de `internal/config` (defaults sin env vars, override por env var) | — | 0.25d | Cobertura de `config` ≥ 90% |
| T12.5 | Tests de `internal/storage.LocalStorage` (guarda archivo, nombre único por UUID, URL resultante) | — | 0.5d | Guardar dos archivos con el mismo nombre original no colisiona |
| T12.6 | Tests de `internal/email.LogSender` (no devuelve error, loguea los datos esperados) | — | 0.25d | Cobertura de `email` ≥ 80% |
| T12.7 | Tests de `internal/http/middleware.go` (`requireAuth`/`requireRole`: sin token, token inválido, expirado, rol incorrecto, rol correcto) con `httptest` | T12.3 | 0.5d | Los 5 casos devuelven el status code correcto (401/403/200) |
| T12.8 | Tests de `internal/http/auth.go` (register: email duplicado, password corto; login: password incorrecto, éxito) | T12.1 | 1d | Cobertura de `auth.go` ≥ 80% |
| T12.9 | Tests de `internal/http/alojamientos.go` — el archivo más grande: `create`/`update`/`list`/`get`/`deactivate`/`activate`/`validate()`, `uploadFoto` (límite de 10, tipos permitidos, límite de tamaño foto vs. video), `reordenarFotos`, `uploadPortada` (desmarca portada anterior) | T12.1 | 3.5d | Cobertura de `alojamientos.go` ≥ 80%; test explícito del bug de GORM ya encontrado (TR-035: `Activo:false` en `Create()` con `borrador:true` debe persistir `false`, no `true`) como regresión |
| T12.10 | Tests de `internal/http/reservas.go` (crear con `validateContacto`, exclusion constraint de solapamiento con un test de dos inserts concurrentes, `actualizarEstado`, `actualizarDatos`, cálculo de `Total`) | T12.1 | 2d | Test de concurrencia real: dos goroutines insertando reservas solapadas sobre el mismo alojamiento, exactamente una tiene éxito (mismo criterio que T0.3 en Fase 1) |
| T12.11 | Tests de `resenas.go`, `bloqueos.go` (constraint de bloqueo vs. reserva real), `contenido.go`, `imagenes.go` (upsert `clause.OnConflict`) | T12.1 | 1.5d | Cobertura de cada archivo ≥ 80% |
| T12.12 | Tests de `internal/reservas/expirer.go` (borra pendientes vencidas por TTL, no toca confirmadas ni pendientes vigentes) | T12.1, T12.2 | 0.5d | Test con reloj inyectado que simula el paso del tiempo, sin `time.Sleep` real |
| T12.13 | Medir coverage real (`go test ./... -coverprofile`), identificar huecos, completar hasta 80% global | T12.2–T12.12 | 1d (buffer) | `go tool cover -func=coverage.out` reporta ≥ 80% en `total:` |

### 12.3 Sprint T-Frontend — Tests unitarios TypeScript (≈ 4.5 días)

| ID | Tarea | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|
| T12.14 | Instalar y configurar Vitest + `@vitest/coverage-v8` + Testing Library + jsdom; `vitest.config.ts` con alias `@/*`, `coverage.thresholds` en 80% (líneas/funciones/branches/statements) sobre el alcance de 12.0.3; mocks base de `next/navigation`/`next/headers` | — | 1d | `pnpm --filter web test` corre y reporta coverage; un test dummy que falla el threshold rompe el comando (verificar bajándolo a propósito una vez) |
| T12.15 | Tests de `lib/` puro: `currency.ts`, `contacto.ts`, `jwt.ts` (decode), `reserva-urgencia.ts`, `notificaciones-cerradas.ts`, `scenes.ts`/`categories.ts`, `placeholder-gradient.ts` | T12.14 | 1.5d | Cobertura de cada archivo ≥ 90% (son funciones puras, sin excusa para huecos) |
| T12.16 | Tests de `lib/api.ts` (mockear `fetch` global — éxito, error de red, error 4xx/5xx mapeado a `ApiResult`) — el archivo más grande de `lib/` | T12.14 | 2d | Cobertura de `api.ts` ≥ 80% |
| T12.17 | Tests de `lib/session.ts` (mock de `cookies()`) y de `app/actions/*.ts` (mockeando `lib/api`/`lib/session` — validaciones, mapeo de error, `revalidatePath` llamado con los paths correctos) | T12.14, T12.16 | 2d | Cobertura de `app/actions/` ≥ 80% |
| T12.18 | Tests de componentes cliente con lógica real (Testing Library): `LocationPicker` (`coordsIniciales`, fallback a Puerto Madryn), `FotosManager` (reordenar array, límite de 10, slot vacío dispara input), `modal.tsx`, `account-menu.tsx`, `notifications-bell-client.tsx`, `alojamiento-baja-button.tsx` | T12.14 | 3d | Cobertura de cada componente listado ≥ 80% |
| T12.19 | Medir coverage real sobre el alcance de 12.0.3, identificar huecos, completar hasta 80% | T12.15–T12.18 | 1d (buffer) | Reporte de Vitest coverage ≥ 80% en el alcance definido (excluyendo `page.tsx`/`layout.tsx`) |

### 12.4 Sprint T-CI — Integración al pipeline (≈ 1.5 días)

| ID | Tarea | Depende de | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|
| T12.20 | `.github/workflows/ci.yml`: agregar Postgres como `services:` (imagen `postgres:16`, `btree_gist` vía el propio `cmd/migrate`) + step de test+coverage para `api` (falla si < 80%) y para `web` (falla si < 80%, usando el `coverage.thresholds` de T12.14) — job(s) agrupados bajo el nombre "Run tests and quality gates" (Etapa 1 del pipeline de 3 etapas) | T12.13, T12.19 | 1d | Un PR que baja el coverage a propósito (revertir un test) hace fallar el check en GitHub; un PR limpio pasa igual que hoy |
| T12.21 | Documentar en `README.md` cómo correr los tests localmente (comandos nuevos, `DATABASE_URL` de test separada) | T12.20 | 0.5d | Un desarrollador nuevo puede correr la suite completa siguiendo solo el README, sin preguntar |

### 12.5 Camino crítico

```
T12.1 → T12.8/T12.9/T12.10/T12.11/T12.12 → T12.13 ─┐
T12.14 → T12.16 → T12.17 → T12.19 ──────────────────┼→ T12.20 → T12.21
                            T12.18 ──────────────────┘
```

Backend y frontend son totalmente paralelizables entre sí (no comparten código) — con dos personas, esta iniciativa completa toma ~5 días en vez de ~10. T12.9 (alojamientos.go) y T12.16 (api.ts) son los cuellos de botella de cada lado por ser los archivos más grandes con más lógica de negocio acumulada (TR-034 a TR-037 recién agregaron bastante código ahí).

### 12.6 Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R11 | 80% es un número arbitrario que puede empujar a escribir tests de relleno (probar getters triviales) solo para subir el porcentaje, sin valor real de detección de bugs | Medio | Priorizar los módulos de mayor riesgo de negocio primero (`clock`, `auth`, `alojamientos.go`, `reservas.go` — TR-005/TR-010) tal como está ordenado este plan; si sobra margen antes de llegar a 80%, taparlo con los archivos más chicos/triviales al final, no al revés |
| R12 | Postgres de test compartiendo el mismo `docker-compose.yml`/credenciales que desarrollo, corriendo por error contra la DB real | Alto — ya pasó una vez esta semana con datos reales (ver sesión 2026-08-13) | `DATABASE_URL` de test usa un nombre de base **distinto** (`turismo_marcuzzi_test`, nunca `turismo_marcuzzi`) documentado en `apps/api/.env.test.example`; el helper `testdb` valida el nombre de la base al conectar y aborta si no termina en `_test`, como red de seguridad adicional |
| R13 | El coverage gate del 80% rompe CI en el primer PR después de mergear esta iniciativa si algún módulo queda justo debajo del umbral | Medio | T12.13/T12.19 son buffers explícitos para cerrar huecos antes de activar el gate en T12.20 — el gate se activa recién cuando la suite ya mide ≥ 80% localmente, no antes |
| R14 | Tests de concurrencia real (T12.10, dos goroutines insertando reservas solapadas) son inherentemente más lentos/flaky que tests puros | Bajo | Timeout generoso explícito en ese test puntual (no en toda la suite); si se vuelve flaky en CI, correrlo con `-count=5` en un job separado antes de mergear el gate, no bloquear todo el pipeline por un test |

### 12.7 Criterios de salida de esta fase

- [x] `go test ./internal/... -coverprofile=coverage.out` en `apps/api` reporta ≥ 80% de coverage total (82.6% al cerrar esta fase).
- [x] `pnpm --filter web test:coverage` en `apps/web` reporta ≥ 80% sobre el alcance definido en 12.0.3 (93.78% statements / 90.11% branches / 93.84% functions / 96.15% lines al cerrar esta fase).
- [x] Los tests de concurrencia (T12.10) confirman que el exclusion constraint de reservas sigue rechazando solapamientos con datos reales, no mockeados.
- [x] El test de regresión del bug de GORM (T12.9, TR-035) existe y falla si alguien revierte el fix.
- [x] `.github/workflows/ci.yml` tiene jobs "Run tests and quality gates" (`test-api`/`test-web`) que fallan el build si cualquiera de los dos coverage cae debajo de 80%.
- [x] `README.md` documenta cómo correr la suite completa localmente.
- [x] Decisiones de esta sección registradas en `docs/tradeoffs.md` (TR-038/TR-039/TR-040).

---

*Documento vivo — actualizar cuando se confirmen las decisiones de la sección 10 de la spec o cambie el alcance.*
