"use client";

import { useRouter } from "next/navigation";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { Countdown } from "@/components/countdown";
import { CONTACTO_TELEFONO_LEGIBLE, telUrl } from "@/lib/contacto";
import { marcarCerrada, useCerradas } from "@/lib/notificaciones-cerradas";

/** Clave de cierre del banner — deliberadamente distinta de la clave que
 * usa el mismo ítem en el panel de notificaciones (bell): cerrar la
 * franja de la página no debe hacerla desaparecer también del panel,
 * donde el cliente puede volver a consultarla más tarde. */
const claveBanner = (reservaId: string) => `banner:${reservaId}`;

/**
 * Franjas apilables "esperando confirmación" (T3.9) — a diferencia del
 * banner de 5 min (una sola, la más urgente, sin rastro tras cerrarla),
 * acá cada reserva contactada tiene su propia franja, cerrable de forma
 * independiente, y el cierre es solo una preferencia local (persiste en
 * localStorage vía notificaciones-cerradas.ts): sigue viéndose en el
 * panel 🔔 aunque se cierre acá.
 */
export function EsperandoConfirmacionBannerClient({ reservas }: { reservas: Reserva[] }) {
  const cerradas = useCerradas();
  const router = useRouter();

  const visibles = reservas.filter((r) => !cerradas.has(claveBanner(r.id)));
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visibles.map((reserva) => (
        <div
          key={reserva.id}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-ink/10 bg-dune px-6 py-2.5 text-center text-sm text-ink md:px-10"
        >
          <p>
            Esperando confirmación de tu reserva
            {reserva.alojamiento ? ` de ${reserva.alojamiento.nombre}` : ""} —{" "}
            <Countdown
              deadline={reserva.expiraEn ?? ""}
              onExpire={() => router.refresh()}
              className="font-semibold tabular-nums"
            />
            . Si tarda,{" "}
            <a href={telUrl()} className="underline underline-offset-2 hover:no-underline">
              llamanos al {CONTACTO_TELEFONO_LEGIBLE}
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => marcarCerrada(claveBanner(reserva.id))}
            aria-label="Cerrar aviso"
            className="text-ink/70 hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
