import { fetchMisReservas } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { reservasConfirmadasVigentes } from "@/lib/reserva-urgencia";
import { AlojamientoConfirmadoBannerClient } from "@/components/alojamiento-confirmado-banner-client";

/**
 * Server Component del banner "alojamiento confirmado" (T4.7, FR-11,
 * spec §4.1) — refina la primera versión (T4.6, banner fijo solo en la
 * home): ahora vive en el header como el resto del sistema de avisos
 * (bannerSlot en layout.tsx, junto a PendingReservaBanner y
 * EsperandoConfirmacionBanner), aparece UNA vez por reserva confirmada y
 * es cerrable — después de cerrarlo, el aviso de "confirmada" sigue
 * viéndose en el panel de notificaciones (🔔), que es donde vive el
 * seguimiento persistente (decisión del cliente, 2026-08-13).
 *
 * Lee cookies() — por eso detrás de <Suspense> en app/layout.tsx, mismo
 * patrón que el resto de bannerSlot (TR-008).
 */
export async function AlojamientoConfirmadoBanner() {
  const token = await getSessionToken();
  if (!token) return null;

  const reservas = await fetchMisReservas(token);
  const confirmadas = reservasConfirmadasVigentes(reservas);
  if (confirmadas.length === 0) return null;

  return <AlojamientoConfirmadoBannerClient reservas={confirmadas} />;
}
