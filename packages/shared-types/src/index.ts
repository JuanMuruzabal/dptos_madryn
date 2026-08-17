/**
 * Tipos de referencia para el frontend (apps/web), espejo del modelo de
 * datos definido en turismo-marcuzzi-spec.md §5 y de los structs Go de
 * apps/api. Se mantienen sincronizados a mano (ver TR-001 en
 * docs/tradeoffs.md) — si cambia un contrato de API en el backend, actualizar
 * acá en el mismo PR.
 */

export type Rol = "cliente" | "administrador";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: Rol;
  // password_hash nunca se expone al frontend.
}

/** Espejo de authResponse en apps/api/internal/http/auth.go
 * (POST /auth/register y /auth/login). */
export interface AuthResponse {
  usuario: Usuario;
  token: string;
}

/** Espejo del error genérico que devuelve apps/api (writeError en
 * apps/api/internal/http/router.go): { "error": "mensaje" }. */
export interface ApiError {
  error: string;
}

export interface Alojamiento {
  id: string;
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
  direccion: string;
  precioNoche: number;
  capacidad: number;
  activo: boolean;
  fotos: Foto[];
  /** undefined si todavía no tiene reseñas (T3.4) — no mostrar 0 estrellas. */
  ratingPromedio?: number;
  totalResenas: number;
}

export type FotoTipo = "foto" | "video";

export interface Foto {
  id: string;
  url: string;
  orden: number;
  /** T4.13 — el frontend decide si renderiza <Image> o <video> según esto. */
  tipo: FotoTipo;
  /** T4.14 — la miniatura que se usa en la tarjeta del listado de
   * Alojamiento, distinta de la galería completa del detalle. A lo sumo
   * una foto por alojamiento tiene esto en true. */
  esPortada: boolean;
}

/** Espejo de contenidoResponse en apps/api/internal/http/contenido.go
 * (T4.13, "editor de página") — bloques de texto editables de páginas
 * principales que no son un alojamiento puntual (hoy: el listado de
 * Alojamiento). Sin fila cargada, titulo/descripcion vienen vacíos — el
 * frontend cae a su copy hardcodeado en ese caso. */
export interface ContenidoSitio {
  clave: string;
  titulo: string;
  descripcion: string;
}

/** Espejo de imagenSitioResponse (T4.13, "editor de página") — fotos
 * editables de páginas principales que no están atadas a un alojamiento
 * (hero de la home, tarjetas de categoría). */
export interface ImagenSitio {
  clave: string;
  url: string;
}

/** Espejo de la respuesta de GET /alojamientos/{id}/disponibilidad
 * (apps/api/internal/http/alojamientos.go) — rangos ya reservados
 * (estado <> 'cancelada', no vencidos) que el calendario del frontend
 * (T2.5) bloquea para selección. */
export interface RangoOcupado {
  /** Fecha ISO 8601 (YYYY-MM-DD), inclusive. */
  inicio: string;
  fin: string;
}

export interface Disponibilidad {
  ocupado: RangoOcupado[];
}

export type ReservaTipo = "alojamiento" | "experiencia" | "traslado";
export type ReservaEstado = "pendiente" | "confirmada" | "cancelada";

/** Espejo de alojamientoResumen en apps/api/internal/http/reservas.go —
 * versión resumida embebida en Reserva, no el Alojamiento completo. */
export interface ReservaAlojamientoResumen {
  id: string;
  nombre: string;
  fotoUrl?: string;
}

/** Espejo de usuarioResumen en apps/api/internal/http/reservas.go — quién
 * hizo la reserva (T4.4, solo viene en el listado admin, GET /reservas). */
export interface ReservaUsuarioResumen {
  id: string;
  nombre: string;
  email: string;
}

/** Espejo de reservaResponse (POST /alojamientos/{id}/reservas, GET
 * /me/reservas — T3.1/T3.2). No lleva usuarioId: el endpoint siempre
 * está scopeado al usuario del JWT, nunca se listan reservas ajenas. */
export interface Reserva {
  id: string;
  tipo: ReservaTipo;
  estado: ReservaEstado;
  /** Fechas ISO 8601 (YYYY-MM-DD), rango inclusivo. */
  fechaInicio: string;
  fechaFin: string;
  total: number;
  /** Presente cuando tipo === "alojamiento" (Sprint 6+ lo dejará vacío
   * para reservas de experiencia/traslado). */
  alojamiento?: ReservaAlojamientoResumen;
  /** Solo viene en GET /reservas (admin, T4.4) — quién hizo la reserva. */
  usuario?: ReservaUsuarioResumen;
  /** Snapshot de contacto de ESTA reserva (T3.5) — no es el perfil del
   * usuario, se puede reservar para otra persona o con otro teléfono. */
  contactoNombre: string;
  contactoApellido: string;
  contactoDni: string;
  contactoEmail: string;
  contactoTelefono: string;
  /** ISO 8601 — el próximo vencimiento de esta reserva (T3.5/T3.6/T3.7,
   * TR-015/TR-016): a los 5 min sin contactar, o a las 2h de contactada
   * sin confirmar, se cancela sola. Vacío si no está "pendiente". */
  expiraEn?: string;
  /** true si ya se tocó el botón de WhatsApp/mail — pasa del timer de
   * contacto (5 min) al de confirmación (2h) (T3.6/T3.7). */
  contactado: boolean;
  /** true solo si está "confirmada" y la estadía no terminó (FR-11,
   * TR-007) — calculado en el backend con clock.Today() (T3.7). */
  vigente: boolean;
}

export interface Experiencia {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracionMin: number;
}

export interface Slot {
  id: string;
  experienciaId: string;
  fechaHora: string; // ISO 8601
  cuposDisponibles: number;
}

/** Espejo de resenaResponse en apps/api/internal/http/resenas.go (T3.4).
 * Muestra el nombre, no el id, del usuario — es lo único que el listado
 * público necesita. */
export interface Resena {
  id: string;
  /** Para que el frontend decida si mostrar el botón de borrar en ESA
   * reseña puntual (2026-08-17) — comparar contra el id del usuario
   * logueado. El backend nunca confía en esto para autorizar el borrado
   * en sí (DELETE /resenas/{id} vuelve a exigir ser el dueño). */
  usuarioId: string;
  usuarioNombre: string;
  rating: number; // 1-5
  texto: string;
  createdAt: string; // ISO 8601
  /** true si el admin la ocultó (T4.5, moderación) — en el listado público
   * (GET /alojamientos/{id}/resenas) siempre viene false, porque esas ya
   * están filtradas; solo es relevante en GET /resenas (admin). */
  oculta: boolean;
  /** Solo viene en GET /resenas (admin, T4.5) — a qué alojamiento pertenece,
   * necesario porque ese listado no está anidado bajo un alojamiento. */
  alojamiento?: { id: string; nombre: string };
}

/** Espejo de bloqueoResponse en apps/api/internal/http/bloqueos.go (T4.3) —
 * un bloqueo manual de fechas del admin (mantenimiento, uso propio, etc.),
 * sin reserva ni cliente detrás. */
export interface Bloqueo {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
}

export type PagoProveedor = "mercado_pago";
export type PagoEstado = "pendiente" | "aprobado" | "rechazado";

export interface Pago {
  id: string;
  reservaId: string;
  proveedor: PagoProveedor;
  estado: PagoEstado;
  monto: number;
  externalId?: string;
}
