import { fetchMisReservas } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { reservasEsperandoConfirmacion } from "@/lib/reserva-urgencia";
import { EsperandoConfirmacionBannerClient } from "@/components/esperando-confirmacion-banner-client";

/**
 * Server Component de la franja "esperando confirmación" (2h, T3.9) — se
 * apila debajo del banner de 5 min (bannerSlot en layout.tsx incluye
 * ambos): si el cliente contactó por una reserva y mientras espera al
 * admin reserva y contacta otra en un alojamiento distinto, ve las dos
 * franjas, una debajo de la otra, no solo la más reciente.
 *
 * Lee cookies() — por eso detrás de <Suspense> en app/layout.tsx, mismo
 * patrón que pending-reserva-banner.tsx (TR-008).
 */
export async function EsperandoConfirmacionBanner() {
  const token = await getSessionToken();
  if (!token) return null;

  const reservas = await fetchMisReservas(token);
  const esperando = reservasEsperandoConfirmacion(reservas);
  if (esperando.length === 0) return null;

  return <EsperandoConfirmacionBannerClient reservas={esperando} />;
}
