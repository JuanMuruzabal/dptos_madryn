"use server";

import { revalidatePath } from "next/cache";
import { borrarResena, crearResena } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export interface ResenaFormState {
  error?: string;
  success?: boolean;
}

/**
 * Crea una reseña (T3.4). El backend es quien de verdad exige una reserva
 * `confirmada` de este alojamiento (apps/api/internal/http/resenas.go) —
 * acá no se repite ese chequeo, solo se traduce el 403 a un mensaje legible
 * si igual llega (p. ej. la reserva se canceló entre que se cargó la
 * página y se envió el formulario).
 */
export async function crearResenaAction(
  _prevState: ResenaFormState,
  formData: FormData,
): Promise<ResenaFormState> {
  const token = await getSessionToken();
  if (!token) {
    return { error: "Iniciá sesión para dejar una reseña." };
  }

  const alojamientoId = String(formData.get("alojamientoId") ?? "");
  const rating = Number(formData.get("rating"));
  const texto = String(formData.get("texto") ?? "").trim();

  if (!alojamientoId) return { error: "Falta el alojamiento." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Elegí una calificación de 1 a 5 estrellas." };
  }
  if (!texto) return { error: "Escribí tu reseña." };

  const result = await crearResena(token, alojamientoId, rating, texto);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/alojamiento/${alojamientoId}`);
  revalidatePath("/alojamiento");

  return { success: true };
}

/**
 * Borra una reseña propia (2026-08-17, pedido del cliente: "que el cliente
 * a las reseñas las pueda eliminar si quiere"). El backend vuelve a exigir
 * ser el dueño (DELETE /resenas/{id} en apps/api/internal/http/resenas.go)
 * — acá no se repite ese chequeo, solo se ignora silenciosamente si por
 * algún motivo ya no aplica (p. ej. doble click borrándola dos veces),
 * mismo criterio que darDeBajaAlojamientoAction en actions/admin.ts.
 */
export async function borrarResenaAction(id: string, alojamientoId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await borrarResena(token, id);
  revalidatePath(`/alojamiento/${alojamientoId}`);
  revalidatePath("/alojamiento");
}
