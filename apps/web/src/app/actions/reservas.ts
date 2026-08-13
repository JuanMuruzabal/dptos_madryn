"use server";

import { revalidatePath } from "next/cache";
import { crearReserva, marcarContactado } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export interface ReservaFormState {
  error?: string;
  success?: boolean;
  /** id de la reserva recién creada (T3.6) — lo necesita el botón de
   * WhatsApp/mail para poder marcarla como contactada y apagar el
   * vencimiento. */
  reservaId?: string;
  /** ISO 8601, tal cual la calculó el backend (T3.7) — el modal la usa
   * para el contador en vivo. Nunca se recalcula en el cliente: el
   * backend es quien sabe si arrancó de CreatedAt o de ContactadoEn. */
  expiraEn?: string;
}

/**
 * Crea una reserva de alojamiento (T3.1/T3.2) desde el formulario del
 * calendario (components/alojamiento/availability-calendar.tsx). Server
 * Action, no fetch directo del cliente: el JWT vive en una cookie
 * httpOnly (mismo patrón BFF que app/actions/auth.ts), el navegador nunca
 * lo ve.
 */
export async function crearReservaAction(
  _prevState: ReservaFormState,
  formData: FormData,
): Promise<ReservaFormState> {
  const token = await getSessionToken();
  if (!token) {
    return { error: "Iniciá sesión para reservar." };
  }

  const alojamientoId = String(formData.get("alojamientoId") ?? "");
  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");

  if (!alojamientoId || !fechaInicio || !fechaFin) {
    return { error: "Elegí check-in y check-out en el calendario." };
  }

  // T3.5: datos de contacto puntuales del formulario que se abre al
  // reservar — el backend vuelve a validar formato/completitud, esto solo
  // arma el payload.
  const contacto = {
    contactoNombre: String(formData.get("contactoNombre") ?? "").trim(),
    contactoApellido: String(formData.get("contactoApellido") ?? "").trim(),
    contactoDni: String(formData.get("contactoDni") ?? "").trim(),
    contactoEmail: String(formData.get("contactoEmail") ?? "").trim(),
    contactoTelefono: String(formData.get("contactoTelefono") ?? "").trim(),
  };

  const result = await crearReserva(token, alojamientoId, fechaInicio, fechaFin, contacto);
  if (!result.ok) return { error: result.error };

  // Invalida el shell cacheado del lado del cliente para que un back/forward
  // a estas rutas no muestre disponibilidad/historial desactualizado — los
  // fetch del lado del servidor ya son `cache: "no-store"` (siempre
  // frescos), esto es solo sobre el router cache de Next. El layout raíz
  // (T3.7) por el banner global — una reserva nueva puede cambiar qué se
  // muestra ahí sin importar en qué página esté el usuario.
  revalidatePath(`/alojamiento/${alojamientoId}`);
  revalidatePath("/alojamiento");
  revalidatePath("/perfil");
  revalidatePath("/", "layout");

  return { success: true, reservaId: result.data.id, expiraEn: result.data.expiraEn };
}

/**
 * Marca una reserva como "contactada" (T3.6) — se llama al tocar el botón
 * de WhatsApp/mail (en el modal de reserva o en el banner global, T3.7),
 * no vía formulario/useActionState (no hay ningún dato que juntar, es una
 * sola acción con un id). Fire-and-forget desde el cliente: no bloquea la
 * navegación a WhatsApp/mail, así que si falla no hay mucho más que hacer
 * que loguearlo — la reserva sigue existiendo, en el peor caso el timer
 * de contacto no se apaga.
 */
export async function marcarContactadoAction(reservaId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await marcarContactado(token, reservaId);
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
}
