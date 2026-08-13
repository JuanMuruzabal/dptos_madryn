"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activarAlojamiento,
  actualizarAlojamiento,
  actualizarDatosReserva,
  actualizarEstadoReserva,
  borrarImagenSitio,
  crearAlojamiento,
  crearBloqueo,
  darDeBajaAlojamiento,
  borrarFoto,
  eliminarBloqueo,
  moderarResena,
  subirFoto,
  subirFotoPortada,
  subirImagenSitio,
  type AlojamientoInput,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export interface AdminFormState {
  error?: string;
  success?: boolean;
}

function alojamientoInputFromForm(formData: FormData): AlojamientoInput {
  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "").trim(),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    direccion: String(formData.get("direccion") ?? "").trim(),
    precioNoche: Number(formData.get("precioNoche")),
    capacidad: Number(formData.get("capacidad")),
  };
}

// Mismo centro de Puerto Madryn que el default de LocationPicker
// (components/admin/location-picker.tsx) — duplicado a propósito: ese
// archivo es "use client" (Leaflet), este es "use server", así que
// comparten el valor pero no el módulo.
const PUERTO_MADRYN_LAT = -42.7667;
const PUERTO_MADRYN_LNG = -65.0333;

/** Crea un alojamiento "borrador" (T4.19, pedido del cliente 2026-08-13:
 * la creación tiene que sentirse como "la primera edición") y redirige
 * directo a su propia página en modo editor — la misma que se usa para
 * editar cualquier alojamiento existente — donde el admin carga el
 * nombre real, la descripción, el precio, la ubicación y las fotos. El
 * botón "Nuevo alojamiento" del panel ya no abre un formulario aparte,
 * llama a esta acción sin datos: se arma con relleno mínimo válido y
 * `borrador: true` (Activo=false en el backend), así que no aparece en
 * el listado público hasta que el admin lo publica a propósito
 * (activarAlojamientoAction) desde esa misma página. */
export async function crearAlojamientoBorradorAction(): Promise<void> {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const result = await crearAlojamiento(token, {
    nombre: "Nuevo alojamiento",
    descripcion: "",
    lat: PUERTO_MADRYN_LAT,
    lng: PUERTO_MADRYN_LNG,
    direccion: "",
    precioNoche: 1,
    capacidad: 1,
    borrador: true,
  });
  if (!result.ok) redirect("/admin/alojamientos");

  revalidatePath("/admin/alojamientos");
  redirect(`/alojamiento/${result.data.id}?modo=editor`);
}

export async function actualizarAlojamientoAction(
  id: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const result = await actualizarAlojamiento(token, id, alojamientoInputFromForm(formData));
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/alojamientos");
  revalidatePath(`/admin/alojamientos/${id}`);
  revalidatePath(`/alojamiento/${id}`);
  revalidatePath("/alojamiento");
  return { success: true };
}

/** DELETE /alojamientos/{id} (dar de baja) y ACTIVAR (publicar/reactivar)
 * comparten botón: no hay formulario/inputs de por medio, por eso van
 * sueltos (no useActionState) — mismo criterio que marcarContactadoAction. */
export async function darDeBajaAlojamientoAction(id: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await darDeBajaAlojamiento(token, id);
  revalidatePath("/admin/alojamientos");
  revalidatePath("/alojamiento");
}

/** Publica un alojamiento (T4.19) — de un borrador recién creado o de uno
 * dado de baja, no hay distinción para el botón, es el mismo estado
 * `activo: false` en los dos casos. Se usa desde AlojamientoBajaButton (la
 * página de Disponibilidad) y desde el banner de ModoEditor. */
export async function activarAlojamientoAction(id: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await activarAlojamiento(token, id);
  revalidatePath("/admin/alojamientos");
  revalidatePath(`/alojamiento/${id}`);
  revalidatePath("/alojamiento");
}

export async function subirFotoAction(
  alojamientoId: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo de imagen." };
  }

  const result = await subirFoto(token, alojamientoId, file);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/alojamientos/${alojamientoId}`);
  revalidatePath(`/alojamiento/${alojamientoId}`);
  return { success: true };
}

export async function borrarFotoAction(alojamientoId: string, fotoId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await borrarFoto(token, alojamientoId, fotoId);
  revalidatePath(`/admin/alojamientos/${alojamientoId}`);
  revalidatePath(`/alojamiento/${alojamientoId}`);
}

/** Foto de portada (T4.14) — la miniatura del listado de Alojamiento,
 * separada de la galería del detalle (subirFotoAction). revalidatePath
 * incluye "/alojamiento" (el listado) porque es ahí donde se ve el
 * cambio, no en el detalle. */
export async function subirFotoPortadaAction(
  alojamientoId: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const file = formData.get("portada");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo de imagen." };
  }

  const result = await subirFotoPortada(token, alojamientoId, file);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/alojamiento/${alojamientoId}`);
  revalidatePath("/alojamiento");
  return { success: true };
}

export async function crearBloqueoAction(
  alojamientoId: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!fechaInicio || !fechaFin) return { error: "Elegí fecha de inicio y fin." };

  const result = await crearBloqueo(token, alojamientoId, fechaInicio, fechaFin, motivo);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/alojamientos/${alojamientoId}`);
  revalidatePath(`/alojamiento/${alojamientoId}`);
  return { success: true };
}

export async function eliminarBloqueoAction(alojamientoId: string, bloqueoId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await eliminarBloqueo(token, alojamientoId, bloqueoId);
  revalidatePath(`/admin/alojamientos/${alojamientoId}`);
  revalidatePath(`/alojamiento/${alojamientoId}`);
}

/** Confirmar/cancelar una reserva (T4.4) — la acción central del panel.
 * revalidatePath("/", "layout") porque esto cambia lo que ve el CLIENTE
 * dueño de la reserva en su próxima carga: el banner de 5 min ya no
 * aplica, pero el panel de notificaciones (🔔) y el banner de FR-11 de la
 * home sí dependen de este cambio de estado. */
export async function actualizarEstadoReservaAction(
  id: string,
  estado: "confirmada" | "cancelada",
): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await actualizarEstadoReserva(token, id, estado);
  revalidatePath("/admin/reservas");
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
}

export async function moderarResenaAction(id: string, oculta: boolean): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await moderarResena(token, id, oculta);
  revalidatePath("/admin/resenas");
  revalidatePath("/alojamiento");
}

/** Editar fechas/contacto de una reserva pendiente/confirmada (T4.13,
 * "por si se da un imprevisto o edición") — no cambia el estado, eso
 * sigue siendo actualizarEstadoReservaAction. */
export async function actualizarDatosReservaAction(
  id: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");
  if (!fechaInicio || !fechaFin) return { error: "Elegí fecha de inicio y fin." };

  const result = await actualizarDatosReserva(token, id, {
    fechaInicio,
    fechaFin,
    contactoNombre: String(formData.get("contactoNombre") ?? "").trim(),
    contactoApellido: String(formData.get("contactoApellido") ?? "").trim(),
    contactoDni: String(formData.get("contactoDni") ?? "").trim(),
    contactoEmail: String(formData.get("contactoEmail") ?? "").trim(),
    contactoTelefono: String(formData.get("contactoTelefono") ?? "").trim(),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/reservas");
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------
// Editor de página (T4.13) — solo fotos (T4.14, TR-027): la edición de
// título/descripción del listado de Alojamiento que hubo acá se sacó por
// pedido del cliente. `fetchContenidoSitio`/`actualizarContenidoSitio`
// siguen en lib/api.ts sin usar por ahora, disponibles si se retoma la
// idea de editar texto de página más adelante.
// ---------------------------------------------------------------------

export async function subirImagenSitioAction(
  clave: string,
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const token = await getSessionToken();
  if (!token) return { error: "Iniciá sesión como administrador." };

  const file = formData.get("imagen");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo de imagen." };
  }

  const result = await subirImagenSitio(token, clave, file);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/editor-pagina");
  revalidatePath("/", "layout");
  revalidatePath("/alojamiento");
  return { success: true };
}

export async function borrarImagenSitioAction(clave: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await borrarImagenSitio(token, clave);
  revalidatePath("/admin/editor-pagina");
  revalidatePath("/", "layout");
  revalidatePath("/alojamiento");
}
