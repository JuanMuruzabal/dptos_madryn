"use client";

import Link from "next/link";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { marcarCerrada, useCerradas } from "@/lib/notificaciones-cerradas";

/** Clave de cierre del banner — distinta del namespace `bell:` que usa el
 * mismo aviso en el panel de notificaciones: cerrar esta franja del header
 * no debe hacerla desaparecer también de ahí. */
const claveBanner = (reservaId: string) => `banner-confirmado:${reservaId}`;

/**
 * Franjas "alojamiento confirmado" (T4.7) — verde/steppe, una por reserva,
 * apilables igual que esperando-confirmacion-banner-client.tsx. Aparece
 * una sola vez: al cerrarla queda cerrada para siempre en este navegador
 * (persistida en localStorage), a diferencia del resto de las franjas que
 * dependen de que cambie el estado de la reserva.
 */
export function AlojamientoConfirmadoBannerClient({ reservas }: { reservas: Reserva[] }) {
  const cerradas = useCerradas();

  const visibles = reservas.filter((r) => !cerradas.has(claveBanner(r.id)));
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visibles.map((reserva) => (
        <div
          key={reserva.id}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-ink/10 bg-steppe px-6 py-2.5 text-center text-sm text-sand md:px-10"
        >
          <p>
            <strong>¡Tu alojamiento{reserva.alojamiento ? ` de ${reserva.alojamiento.nombre}` : ""} fue confirmado!</strong>{" "}
            <Link href="/experiencias" className="underline underline-offset-2 hover:no-underline">
              Ver servicios disponibles
            </Link>
          </p>
          <button
            type="button"
            onClick={() => marcarCerrada(claveBanner(reserva.id))}
            aria-label="Cerrar aviso"
            className="text-sand/80 hover:text-sand"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
