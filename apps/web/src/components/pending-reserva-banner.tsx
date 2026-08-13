import { fetchMisReservas } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { reservaUrgenteBanner } from "@/lib/reserva-urgencia";
import { ReservaBannerClient } from "@/components/reserva-banner-client";

/**
 * Server Component que decide si hay algo para mostrar en el banner
 * global (T3.7/T3.8) — solo la fase más crítica (5 min sin contactar).
 * El resto del estado de reservas (esperando confirmación, confirmada)
 * vive en el panel de notificaciones (notifications-bell.tsx).
 *
 * Lee cookies() (sesión) — por eso queda detrás de <Suspense> en
 * site-header.tsx (bannerSlot), mismo patrón que account-status.tsx
 * (TR-008): sin eso, esta sola lectura volvería dinámica toda la app.
 */
export async function PendingReservaBanner() {
  const token = await getSessionToken();
  if (!token) return null;

  const reservas = await fetchMisReservas(token);
  const urgente = reservaUrgenteBanner(reservas);
  if (!urgente) return null;

  return <ReservaBannerClient reserva={urgente} />;
}
