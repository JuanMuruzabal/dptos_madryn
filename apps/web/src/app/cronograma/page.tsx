import { ComingSoon } from "@/components/coming-soon";

/**
 * Placeholder de "Mi cronograma" (T3.9, enlazado desde el menú de cuenta
 * — account-menu.tsx) — pensado para cuando existan reservas de
 * Experiencias y Servicio Turístico que un usuario logueado pueda ver
 * armadas en un itinerario propio (Sprint 6/8, todavía no construidos).
 * Gradiente propio (no el de una categoría existente en lib/categories.ts):
 * mezcla los dos acentos de los módulos que va a combinar.
 */
export default function CronogramaPage() {
  return (
    <ComingSoon
      title="Mi cronograma"
      description="Tu itinerario de experiencias y servicio turístico, todo en un solo lugar — disponible cuando esos módulos estén reservables."
      gradient="linear-gradient(160deg, #12333b 0%, #c99a5b 55%, #6f7d4a 100%)"
    />
  );
}
