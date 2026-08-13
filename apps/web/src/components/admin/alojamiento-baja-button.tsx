"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { activarAlojamientoAction, darDeBajaAlojamientoAction } from "@/app/actions/admin";
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/ui";

/**
 * Dar de baja / reactivar (T4.2) — soft delete (activo=false), nunca borra
 * el alojamiento ni su historial de reservas/reseñas (ver comentario en el
 * handler Go). Activar usa el endpoint dedicado POST .../activar (T4.19).
 */
export function AlojamientoBajaButton({ alojamiento }: { alojamiento: Alojamiento }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function accionar() {
    startTransition(async () => {
      if (alojamiento.activo) {
        await darDeBajaAlojamientoAction(alojamiento.id);
      } else {
        await activarAlojamientoAction(alojamiento.id);
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={accionar}
      className={alojamiento.activo ? dangerButtonClass : secondaryButtonClass}
    >
      {pending ? "…" : alojamiento.activo ? "Dar de baja" : "Reactivar"}
    </button>
  );
}
