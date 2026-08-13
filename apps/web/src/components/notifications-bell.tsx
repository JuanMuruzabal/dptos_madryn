import { fetchMisReservas } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { reservasParaNotificaciones } from "@/lib/reserva-urgencia";
import { NotificationsBellClient } from "@/components/notifications-bell-client";

/**
 * Server Component del panel de notificaciones (T3.8) — a diferencia del
 * banner (una sola reserva, la más urgente), acá va la LISTA completa de
 * reservas en curso: si el usuario tiene una esperando confirmación en un
 * alojamiento y otra recién confirmada en otro, ve las dos. Solo se
 * renderiza si hay algo que mostrar (sin ícono muerto para la mayoría de
 * los usuarios, que no tienen nada pendiente).
 *
 * Lee cookies() — por eso detrás de <Suspense> en site-header.tsx
 * (notificationsSlot), mismo patrón que accountSlot/bannerSlot (TR-008).
 */
export async function NotificationsBell() {
  const token = await getSessionToken();
  if (!token) return null;

  const reservas = await fetchMisReservas(token);
  const notificaciones = reservasParaNotificaciones(reservas);
  if (notificaciones.length === 0) return null;

  return <NotificationsBellClient notificaciones={notificaciones} />;
}
