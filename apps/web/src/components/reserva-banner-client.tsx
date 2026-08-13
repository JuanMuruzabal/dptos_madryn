"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { marcarContactadoAction } from "@/app/actions/reservas";
import { Countdown } from "@/components/countdown";
import { mailtoUrl, whatsappUrl } from "@/lib/contacto";

type Estado = "activo" | "aviso" | "oculto";

/**
 * Franja de aviso global (T3.7/T3.8), debajo del header (site-header.tsx
 * la monta como bannerSlot, mismo patrón que accountSlot) — solo la fase
 * más crítica: pendiente sin contactar, cuenta regresiva de minutos. El
 * resto del seguimiento (esperando confirmación, confirmada) se movió al
 * panel de notificaciones (🔔 en el header, notifications-bell.tsx):
 * con un solo banner, un usuario reservando en dos alojamientos a la vez
 * solo podía ver el estado de uno (decisión del cliente, 2026-08-13).
 *
 * Al tocar WhatsApp/mail, en vez de pasar a mostrar el detalle de la
 * espera de 2h acá mismo, muestra un aviso breve señalando el panel de
 * notificaciones y se cierra solo — ahí es donde vive el seguimiento a
 * partir de ahora.
 */
export function ReservaBannerClient({ reserva }: { reserva: Reserva }) {
  const [estado, setEstado] = useState<Estado>("activo");
  const router = useRouter();

  if (estado === "oculto") return null;

  if (estado === "aviso") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-dune px-6 py-2.5 text-center text-sm text-ink md:px-10">
        <p>¡Gracias! Revisá notificaciones (🔔, arriba) para el estado de tus reservas.</p>
        <button
          type="button"
          onClick={() => setEstado("oculto")}
          aria-label="Cerrar aviso"
          className="text-ink/70 hover:text-ink"
        >
          ×
        </button>
      </div>
    );
  }

  const mensaje = `Hola! Quiero coordinar el pago de mi reserva${
    reserva.alojamiento ? ` de ${reserva.alojamiento.nombre}` : ""
  }, del ${reserva.fechaInicio} al ${reserva.fechaFin}.`;

  async function contactar() {
    setEstado("aviso");
    await marcarContactadoAction(reserva.id);
    router.refresh();
    setTimeout(() => setEstado("oculto"), 6000);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-dune px-6 py-2.5 text-center text-sm text-ink md:px-10">
      <p>
        Contactate para no perder tu reserva
        {reserva.alojamiento ? ` de ${reserva.alojamiento.nombre}` : ""} — vence en{" "}
        <Countdown
          deadline={reserva.expiraEn ?? ""}
          onExpire={() => router.refresh()}
          className="font-semibold tabular-nums"
        />
      </p>
      <div className="flex items-center gap-3">
        <a
          href={whatsappUrl(mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={contactar}
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          WhatsApp
        </a>
        <a
          href={mailtoUrl("Coordinar pago de mi reserva", mensaje)}
          onClick={contactar}
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          Mail
        </a>
        <button
          type="button"
          onClick={() => setEstado("oculto")}
          aria-label="Cerrar aviso"
          className="text-ink/70 hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}
