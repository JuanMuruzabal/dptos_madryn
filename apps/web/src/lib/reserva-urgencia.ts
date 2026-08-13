import type { Reserva } from "@turismo-marcuzzi/shared-types";

const porExpirar = (a: Reserva, b: Reserva) =>
  new Date(a.expiraEn ?? 0).getTime() - new Date(b.expiraEn ?? 0).getTime();

/**
 * Reserva que va en el banner del header (T3.8) — solo la fase
 * "pendiente sin contactar" (ContactoTTL, minutos): es la única realmente
 * urgente, donde no actuar a tiempo cancela la reserva sola. El resto
 * (esperando confirmación, confirmada) va a `reservasParaNotificaciones`
 * en vez de competir por el mismo espacio — con un solo banner, un
 * usuario con reservas en curso en dos alojamientos distintos solo podía
 * ver el estado de uno a la vez (decisión del cliente, 2026-08-13).
 */
export function reservaUrgenteBanner(reservas: Reserva[]): Reserva | null {
  const candidatas = reservas
    .filter((r) => r.estado === "pendiente" && !r.contactado && r.expiraEn)
    .sort(porExpirar);
  return candidatas[0] ?? null;
}

/**
 * Reservas "esperando confirmación" (contactado, todavía pendiente) —
 * base compartida por el banner apilable (T3.9,
 * esperando-confirmacion-banner.tsx) y el panel de notificaciones
 * (reservasParaNotificaciones, abajo). A diferencia de
 * `reservaUrgenteBanner`, acá van TODAS: el cliente puede tener una
 * reserva esperando confirmación en un alojamiento y contactar otra en
 * paralelo — cada una arma su propia franja apilada (decisión del
 * cliente, 2026-08-13).
 */
export function reservasEsperandoConfirmacion(reservas: Reserva[]): Reserva[] {
  return reservas
    .filter((r) => r.estado === "pendiente" && r.contactado && r.expiraEn)
    .sort(porExpirar);
}

/**
 * Reservas confirmadas y vigentes (FR-11) — base compartida por el banner
 * de header "alojamiento confirmado" (T4.7,
 * alojamiento-confirmado-banner.tsx) y el panel de notificaciones. Igual
 * que `reservasEsperandoConfirmacion`: pueden ser varias a la vez (el
 * cliente puede tener alojamiento confirmado en más de un lugar).
 */
export function reservasConfirmadasVigentes(reservas: Reserva[]): Reserva[] {
  return reservas.filter((r) => r.estado === "confirmada" && r.vigente);
}

export type TipoNotificacion = "esperando_confirmacion" | "confirmada";

export interface NotificacionReserva {
  reserva: Reserva;
  tipo: TipoNotificacion;
}

/**
 * Reservas para el panel de notificaciones (T3.8, ícono en el header) —
 * a diferencia del banner, es una LISTA: si el usuario tiene varias
 * reservas en curso (p. ej. una esperando confirmación en un alojamiento
 * y otra recién confirmada en otro), las ve todas, no solo la más
 * urgente. Ordenadas: primero las que esperan confirmación (por vencer
 * antes primero), después las confirmadas vigentes.
 */
export function reservasParaNotificaciones(reservas: Reserva[]): NotificacionReserva[] {
  const activas = reservas.filter((r) => r.estado !== "cancelada");

  const esperandoConfirmacion = reservasEsperandoConfirmacion(activas).map((reserva) => ({
    reserva,
    tipo: "esperando_confirmacion" as const,
  }));

  const confirmadas = reservasConfirmadasVigentes(activas).map((reserva) => ({
    reserva,
    tipo: "confirmada" as const,
  }));

  return [...esperandoConfirmacion, ...confirmadas];
}
