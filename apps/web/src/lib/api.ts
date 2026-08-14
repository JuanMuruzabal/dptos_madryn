import "server-only";

import { cache } from "react";
import type {
  Alojamiento,
  ApiError,
  Bloqueo,
  ContenidoSitio,
  Disponibilidad,
  Foto,
  ImagenSitio,
  Resena,
  Reserva,
  Usuario,
} from "@turismo-marcuzzi/shared-types";

/**
 * URL del backend Go (apps/api). Server-only a propósito: nunca se expone
 * al bundle del cliente (no lleva prefijo NEXT_PUBLIC_) porque el
 * navegador jamás llama a la API directo — todo pasa por Server
 * Actions/Route Handlers de Next (patrón BFF), así la cookie de sesión
 * puede ser httpOnly y de primera parte aunque el front y el back vivan en
 * dominios distintos en producción (Vercel + Railway/Fly.io).
 */
export const API_URL = process.env.API_URL ?? "http://localhost:8080";

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * GET /me contra apps/api con el JWT de la cookie de sesión. El JWT no
 * lleva nombre/email (ver comentario en apps/api/internal/http/auth.go),
 * así que esta llamada es necesaria para mostrar el perfil (T1.3).
 * Devuelve null si el token no es válido — quien llama decide si eso
 * significa "borrar la sesión y mandar a /ingresar".
 */
export async function fetchMe(token: string): Promise<Usuario | null> {
  const res = await fetch(apiUrl("/me"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as Usuario;
}

/** Filtros de listado de alojamiento (T2.2, spec §4.2). Los nombres de
 * campo son los del frontend (camelCase) — la traducción a query params
 * snake_case que espera apps/api pasa por `fetchAlojamientos`. */
export interface AlojamientoFiltros {
  fechaInicio?: string;
  fechaFin?: string;
  huespedes?: number;
  precioMin?: number;
  precioMax?: number;
}

/**
 * GET /alojamientos, público (sin token) — listado con filtros opcionales.
 * `cache: "no-store"` a propósito: la disponibilidad real depende de las
 * reservas del momento, no de un snapshot cacheado (igual que fetchMe).
 */
export async function fetchAlojamientos(filtros: AlojamientoFiltros): Promise<Alojamiento[]> {
  const params = new URLSearchParams();
  if (filtros.fechaInicio) params.set("fecha_inicio", filtros.fechaInicio);
  if (filtros.fechaFin) params.set("fecha_fin", filtros.fechaFin);
  if (filtros.huespedes) params.set("huespedes", String(filtros.huespedes));
  if (filtros.precioMin) params.set("precio_min", String(filtros.precioMin));
  if (filtros.precioMax) params.set("precio_max", String(filtros.precioMax));

  const query = params.toString();
  const res = await fetch(apiUrl(`/alojamientos${query ? `?${query}` : ""}`), { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as Alojamiento[];
}

/** GET /alojamientos/{id}, público. null si no existe (404) o el id es
 * inválido — quien llama decide si eso significa notFound(). Envuelto en
 * React.cache: la página de detalle y su generateMetadata piden el mismo
 * id en el mismo request, esto evita pegarle dos veces a apps/api. */
export const fetchAlojamiento = cache(async (id: string): Promise<Alojamiento | null> => {
  const res = await fetch(apiUrl(`/alojamientos/${id}`), { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as Alojamiento;
});

/** GET /alojamientos/{id}/disponibilidad, público — rangos ocupados para
 * el calendario (T2.5). Ante error de red/backend, devuelve "sin
 * ocupación conocida" en vez de reventar la página de detalle: es
 * degradación razonable (peor caso, se muestra un calendario sin bloqueos
 * que igual el backend va a rechazar al confirmar la reserva en Sprint 3). */
export async function fetchDisponibilidad(id: string): Promise<Disponibilidad> {
  const res = await fetch(apiUrl(`/alojamientos/${id}/disponibilidad`), { cache: "no-store" });
  if (!res.ok) return { ocupado: [] };
  return (await res.json()) as Disponibilidad;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** POST/PUT/PATCH/DELETE autenticado genérico contra apps/api — mismo
 * shape de resultado que postAuth en app/actions/auth.ts (no se
 * unificaron para no tocar ese código ya probado), pensado para Server
 * Actions que ya tienen el token de la cookie de sesión a mano. `body`
 * opcional: DELETE no manda cuerpo (T4.3, eliminarBloqueo). */
async function requestAuthed<T>(
  path: string,
  token: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No pudimos conectar con el servidor. Probá de nuevo en un momento." };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, status: res.status, error: data?.error ?? "Ocurrió un error inesperado." };
  }

  if (res.status === 204) return { ok: true, data: undefined as T };
  return { ok: true, data: (await res.json()) as T };
}

/** Datos de contacto puntuales de la reserva (T3.5) — snapshot para ESTA
 * reserva, no el perfil del usuario. */
export interface ContactoReserva {
  contactoNombre: string;
  contactoApellido: string;
  contactoDni: string;
  contactoEmail: string;
  contactoTelefono: string;
}

/** POST /alojamientos/{id}/reservas (T3.1/T3.5) — cualquier usuario
 * logueado puede reservar alojamiento, sin la restricción de FR-11 (esa
 * regla es solo para experiencias/servicio turístico/traslados). */
export async function crearReserva(
  token: string,
  alojamientoId: string,
  fechaInicio: string,
  fechaFin: string,
  contacto: ContactoReserva,
): Promise<ApiResult<Reserva>> {
  return requestAuthed<Reserva>(`/alojamientos/${alojamientoId}/reservas`, token, "POST", {
    fechaInicio,
    fechaFin,
    ...contacto,
  });
}

/** POST /reservas/{id}/contacto (T3.6) — se llama al tocar el botón de
 * WhatsApp/mail después de reservar: apaga el vencimiento de 20 minutos
 * (ver internal/reservas.ExpirePendientes). Sin body, por eso no usa
 * requestAuthed (que siempre manda JSON). */
export async function marcarContactado(token: string, reservaId: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`/reservas/${reservaId}/contacto`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** GET /me/reservas (T3.2) — historial del usuario logueado, para /perfil. */
export async function fetchMisReservas(token: string): Promise<Reserva[]> {
  const res = await fetch(apiUrl("/me/reservas"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Reserva[];
}

/** GET /alojamientos/{id}/resenas, público (T3.4). */
export async function fetchResenas(alojamientoId: string): Promise<Resena[]> {
  const res = await fetch(apiUrl(`/alojamientos/${alojamientoId}/resenas`), { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as Resena[];
}

/** POST /alojamientos/{id}/resenas (T3.4) — el backend valida que el
 * usuario tenga una reserva `confirmada` real de este alojamiento; acá no
 * se duplica ese chequeo, solo se muestra/oculta el formulario según
 * `tieneReservaConfirmada` (ver alojamiento/[id]/page.tsx) como UX, no
 * como seguridad. */
export async function crearResena(
  token: string,
  alojamientoId: string,
  rating: number,
  texto: string,
): Promise<ApiResult<Resena>> {
  return requestAuthed<Resena>(`/alojamientos/${alojamientoId}/resenas`, token, "POST", {
    rating,
    texto,
  });
}

/** GET /me/alojamiento-vigente (T4.6, FR-11) — bool liviano para el banner
 * condicional de la home, en vez de traer /me/reservas completo y
 * recalcularlo en el frontend. `false` ante cualquier error de red: es la
 * postura conservadora (no mostrar el banner) si no se puede confirmar. */
export async function fetchAlojamientoVigente(token: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/me/alojamiento-vigente"), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { vigente: boolean };
    return data.vigente;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Panel de administración (Sprint 4, T4.1-T4.6) — todo detrás de
// requireRole("administrador") del lado del backend; acá solo arma las
// llamadas, la autorización real siempre la valida apps/api.
// ---------------------------------------------------------------------

/** GET /alojamientos?incluirInactivos=true (T4.2) — a diferencia de
 * fetchAlojamientos (listado público, siempre activo=true), esta trae
 * también los dados de baja, para que el panel los pueda reactivar. */
export async function fetchAlojamientosAdmin(token: string): Promise<Alojamiento[]> {
  const res = await fetch(apiUrl("/alojamientos?incluirInactivos=true"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Alojamiento[];
}

/** Campos editables de un alojamiento (T4.2) — mismo shape para crear y
 * editar, espejo de alojamientoRequest en apps/api/internal/http/alojamientos.go. */
export interface AlojamientoInput {
  nombre: string;
  descripcion: string;
  lat: number;
  lng: number;
  direccion: string;
  precioNoche: number;
  capacidad: number;
  // T4.19: solo lo lee el backend en la creación (nunca en la edición) —
  // ver comentario en alojamientoRequest, apps/api/internal/http/alojamientos.go.
  borrador?: boolean;
}

export async function crearAlojamiento(token: string, input: AlojamientoInput): Promise<ApiResult<Alojamiento>> {
  return requestAuthed<Alojamiento>("/alojamientos", token, "POST", input);
}

export async function actualizarAlojamiento(
  token: string,
  id: string,
  input: AlojamientoInput,
): Promise<ApiResult<Alojamiento>> {
  return requestAuthed<Alojamiento>(`/alojamientos/${id}`, token, "PUT", input);
}

/** DELETE /alojamientos/{id} (T4.2) — "dar de baja" (soft, activo=false),
 * no un borrado físico (ver comentario en el handler Go). */
export async function darDeBajaAlojamiento(token: string, id: string): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/alojamientos/${id}`, token, "DELETE");
}

/** POST /alojamientos/{id}/activar (T4.19) — publica un alojamiento que
 * estaba de baja o recién creado como borrador (ver AlojamientoInput.borrador).
 * Endpoint dedicado, simétrico a darDeBajaAlojamiento — reemplaza al viejo
 * mecanismo de "reenviar un PUT idéntico" que en los hechos no tocaba
 * `activo` (bug real, corregido acá en vez de perpetuado). */
export async function activarAlojamiento(token: string, id: string): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/alojamientos/${id}/activar`, token, "POST");
}

/** POST /alojamientos/{id}/fotos (T2.1/T4.2/T4.13), multipart — no pasa
 * por requestAuthed (que siempre manda JSON): el navegador arma el
 * boundary de multipart/form-data solo si NO se fija el header
 * Content-Type a mano. Acepta foto o video (T4.13) — el backend detecta
 * cuál es por el contenido real del archivo, no por su extensión. */
export async function subirFoto(token: string, alojamientoId: string, file: File): Promise<ApiResult<Foto>> {
  const form = new FormData();
  form.set("foto", file);

  let res: Response;
  try {
    res = await fetch(apiUrl(`/alojamientos/${alojamientoId}/fotos`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No pudimos conectar con el servidor. Probá de nuevo en un momento." };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, status: res.status, error: data?.error ?? "Ocurrió un error inesperado." };
  }
  return { ok: true, data: await res.json() };
}

export async function borrarFoto(token: string, alojamientoId: string, fotoId: string): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/alojamientos/${alojamientoId}/fotos/${fotoId}`, token, "DELETE");
}

/** PATCH /alojamientos/{id}/fotos/orden (T4.20) — persiste el nuevo orden
 * después de arrastrar una foto/video a otra posición en FotosManager.
 * `ordenIds` ya viene reordenado por el frontend; el backend solo lo
 * traduce a la columna `orden` (posición = índice en el array). */
export async function reordenarFotos(
  token: string,
  alojamientoId: string,
  ordenIds: string[],
): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/alojamientos/${alojamientoId}/fotos/orden`, token, "PATCH", { orden: ordenIds });
}

/** POST /alojamientos/{id}/portada (T4.14), multipart — la miniatura del
 * listado de Alojamiento, distinta de subirFoto (galería del detalle).
 * Solo imagen, nunca video. */
export async function subirFotoPortada(token: string, alojamientoId: string, file: File): Promise<ApiResult<Foto>> {
  const form = new FormData();
  form.set("portada", file);

  let res: Response;
  try {
    res = await fetch(apiUrl(`/alojamientos/${alojamientoId}/portada`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No pudimos conectar con el servidor. Probá de nuevo en un momento." };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, status: res.status, error: data?.error ?? "Ocurrió un error inesperado." };
  }
  return { ok: true, data: await res.json() };
}

/** GET /alojamientos/{id}/bloqueos (T4.3, admin). */
export async function fetchBloqueos(token: string, alojamientoId: string): Promise<Bloqueo[]> {
  const res = await fetch(apiUrl(`/alojamientos/${alojamientoId}/bloqueos`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Bloqueo[];
}

export async function crearBloqueo(
  token: string,
  alojamientoId: string,
  fechaInicio: string,
  fechaFin: string,
  motivo: string,
): Promise<ApiResult<Bloqueo>> {
  return requestAuthed<Bloqueo>(`/alojamientos/${alojamientoId}/bloqueos`, token, "POST", {
    fechaInicio,
    fechaFin,
    motivo,
  });
}

export async function eliminarBloqueo(
  token: string,
  alojamientoId: string,
  bloqueoId: string,
): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/alojamientos/${alojamientoId}/bloqueos/${bloqueoId}`, token, "DELETE");
}

/** GET /reservas (T4.4, admin) — todas las reservas de clientes reales,
 * pendientes primero. `estado` filtra del lado del backend (tabs del
 * panel); sin filtro trae todas. */
export async function fetchReservasAdmin(token: string, estado?: string): Promise<Reserva[]> {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : "";
  const res = await fetch(apiUrl(`/reservas${query}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Reserva[];
}

/** PATCH /reservas/{id}/estado (T4.4, admin) — confirmar o cancelar una
 * reserva. El backend valida que la transición sea válida (ver
 * actualizarEstado en apps/api/internal/http/reservas.go). */
export async function actualizarEstadoReserva(
  token: string,
  id: string,
  estado: "confirmada" | "cancelada",
): Promise<ApiResult<Reserva>> {
  return requestAuthed<Reserva>(`/reservas/${id}/estado`, token, "PATCH", { estado });
}

/** GET /resenas (T4.5, admin) — todas las reseñas de todos los
 * alojamientos, ocultas incluidas. */
export async function fetchResenasAdmin(token: string): Promise<Resena[]> {
  const res = await fetch(apiUrl("/resenas"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Resena[];
}

export async function moderarResena(token: string, id: string, oculta: boolean): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/resenas/${id}`, token, "PATCH", { oculta });
}

/** PATCH /reservas/{id} (T4.13, admin) — editar fechas y contacto de una
 * reserva pendiente/confirmada (imprevistos, correcciones de carga). */
export async function actualizarDatosReserva(
  token: string,
  id: string,
  input: {
    fechaInicio: string;
    fechaFin: string;
    contactoNombre: string;
    contactoApellido: string;
    contactoDni: string;
    contactoEmail: string;
    contactoTelefono: string;
  },
): Promise<ApiResult<Reserva>> {
  return requestAuthed<Reserva>(`/reservas/${id}`, token, "PATCH", input);
}

// ---------------------------------------------------------------------
// Editor de página (T4.13) — bloques de texto e imágenes editables de
// páginas principales que no son un alojamiento puntual.
// ---------------------------------------------------------------------

/** GET /contenido-sitio/{clave}, público (T4.13). Nunca falla con null:
 * sin fila cargada, el backend ya devuelve strings vacíos — eso mismo se
 * usa acá como señal de "todavía no hay override, mostrar el copy por
 * defecto". */
export async function fetchContenidoSitio(clave: string): Promise<ContenidoSitio> {
  const res = await fetch(apiUrl(`/contenido-sitio/${clave}`), { cache: "no-store" });
  if (!res.ok) return { clave, titulo: "", descripcion: "" };
  return (await res.json()) as ContenidoSitio;
}

export async function actualizarContenidoSitio(
  token: string,
  clave: string,
  titulo: string,
  descripcion: string,
): Promise<ApiResult<ContenidoSitio>> {
  return requestAuthed<ContenidoSitio>(`/contenido-sitio/${clave}`, token, "PUT", { titulo, descripcion });
}

/** GET /imagenes-sitio, público (T4.13) — solo las claves con override
 * cargado; el resto cae al gradiente de marca por defecto. */
export async function fetchImagenesSitio(): Promise<ImagenSitio[]> {
  const res = await fetch(apiUrl("/imagenes-sitio"), { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as ImagenSitio[];
}

/** Mismo fetch que fetchImagenesSitio, como Map clave→url — la forma que
 * necesitan Hero/FeaturedCategories (lib/scenes.ts:
 * aplicarOverridesEscenas) para mezclar los overrides sobre las escenas
 * por defecto sin recorrer un array cada vez. */
export async function fetchImagenesSitioMap(): Promise<Map<string, string>> {
  const imagenes = await fetchImagenesSitio();
  return new Map(imagenes.map((img) => [img.clave, img.url]));
}

export async function subirImagenSitio(token: string, clave: string, file: File): Promise<ApiResult<ImagenSitio>> {
  const form = new FormData();
  form.set("imagen", file);

  let res: Response;
  try {
    res = await fetch(apiUrl(`/imagenes-sitio/${clave}`), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No pudimos conectar con el servidor. Probá de nuevo en un momento." };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, status: res.status, error: data?.error ?? "Ocurrió un error inesperado." };
  }
  return { ok: true, data: await res.json() };
}

export async function borrarImagenSitio(token: string, clave: string): Promise<ApiResult<undefined>> {
  return requestAuthed<undefined>(`/imagenes-sitio/${clave}`, token, "DELETE");
}
