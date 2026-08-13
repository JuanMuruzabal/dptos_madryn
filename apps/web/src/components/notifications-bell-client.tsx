"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NotificacionReserva } from "@/lib/reserva-urgencia";
import { Countdown } from "@/components/countdown";
import { CONTACTO_TELEFONO_LEGIBLE, telUrl } from "@/lib/contacto";
import { marcarCerrada, useCerradas } from "@/lib/notificaciones-cerradas";

/** Clave de cierre por ítem — incluye el tipo, no solo el id de la
 * reserva: cerrar el aviso "confirmada" no debe ocultar también un futuro
 * aviso "esperando confirmación" de otra reserva con el mismo id (no
 * puede pasar hoy, pero deja la clave lista si algún día se reabre un
 * ciclo). Solo "confirmada" es cerrable acá — "esperando confirmación"
 * (el contador de 2h) es información que el cliente todavía necesita
 * seguir viendo hasta que se resuelva, así que no tiene botón de cierre
 * (pedido del cliente, 2026-08-13): desaparece sola cuando el admin
 * confirma o cancela la reserva, nunca por acción del cliente. */
const claveItem = (reservaId: string, tipo: NotificacionReserva["tipo"]) =>
  `bell:${reservaId}:${tipo}`;

/**
 * Dropdown de notificaciones (T3.8/T3.9) — ícono con punto rojo cuando
 * hay algo sin cerrar, lista de reservas en curso al abrirlo. "Esperando
 * confirmación" se pinta en ámbar/dune (mismo color que el banner
 * apilable, esperando-confirmacion-banner-client.tsx) y no se puede
 * cerrar; "confirmada" en verde/steppe y sí es cerrable.
 */
export function NotificationsBellClient({
  notificaciones,
}: {
  notificaciones: NotificacionReserva[];
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const cerradas = useCerradas();

  useEffect(() => {
    function onClickAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickAfuera);
    return () => document.removeEventListener("mousedown", onClickAfuera);
  }, []);

  const visibles = notificaciones.filter(
    ({ reserva, tipo }) => !cerradas.has(claveItem(reserva.id, tipo)),
  );

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={`Notificaciones (${visibles.length})`}
        aria-expanded={abierto}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-sand/10"
      >
        <span aria-hidden>🔔</span>
        {visibles.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" aria-hidden />
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[85vw] rounded-md border border-ink/10 bg-sand p-2 text-ink shadow-2xl">
          <p className="tracked-caps px-2 py-1.5 text-[0.65rem] font-semibold text-ink-soft">
            Tus reservas
          </p>
          {visibles.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-soft">No tenés notificaciones nuevas.</p>
          ) : (
            <ul className="space-y-1">
              {visibles.map(({ reserva, tipo }) => (
                <li key={`${reserva.id}-${tipo}`} className="flex items-start gap-2 rounded-md p-2 text-sm">
                  <div className="flex-1">
                    {tipo === "esperando_confirmacion" ? (
                      <>
                        <p className="font-medium text-[#8a6a2e]">
                          {reserva.alojamiento?.nombre ?? "Alojamiento"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          Esperando confirmación —{" "}
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
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-steppe">
                          Se confirmó tu reserva{reserva.alojamiento ? ` de ${reserva.alojamiento.nombre}` : ""}.
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          Mirá{" "}
                          <Link
                            href="/#categorias"
                            onClick={() => setAbierto(false)}
                            className="underline underline-offset-2 hover:no-underline"
                          >
                            los servicios disponibles
                          </Link>
                          .
                        </p>
                      </>
                    )}
                  </div>
                  {tipo === "confirmada" && (
                    <button
                      type="button"
                      onClick={() => marcarCerrada(claveItem(reserva.id, tipo))}
                      aria-label="Cerrar notificación"
                      className="text-ink/50 hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
