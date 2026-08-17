"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarResenaAction } from "@/app/actions/resenas";

/**
 * Borrar la reseña propia (2026-08-17, pedido del cliente). Solo se monta
 * en la reseña del usuario logueado (ver resenas-list.tsx, compara
 * resena.usuarioId contra miUsuarioId) — el backend vuelve a exigir ser el
 * dueño igual, esto es la primera barrera nomás.
 *
 * Confirmación en dos pasos en vez de window.confirm() (fuera de lugar acá,
 * no se usa en ningún otro lado del sitio): borrar una reseña propia, a
 * diferencia de cancelar una reserva desde el panel admin, no tiene forma
 * de deshacerse.
 */
export function ResenaBorrarButton({
  id,
  alojamientoId,
}: {
  id: string;
  alojamientoId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function borrar() {
    startTransition(async () => {
      await borrarResenaAction(id, alojamientoId);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-ink-soft">¿Borrar tu reseña?</span>
        <button
          type="button"
          disabled={pending}
          onClick={borrar}
          className="font-semibold text-coral-dark hover:underline"
        >
          {pending ? "Borrando…" : "Sí, borrar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="text-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-semibold text-coral-dark hover:underline"
    >
      Eliminar
    </button>
  );
}
