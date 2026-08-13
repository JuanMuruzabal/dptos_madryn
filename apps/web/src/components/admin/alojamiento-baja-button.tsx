"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { darDeBajaAlojamientoAction, reactivarAlojamientoAction } from "@/app/actions/admin";
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/ui";

/**
 * Dar de baja / reactivar (T4.2) — soft delete (activo=false), nunca borra
 * el alojamiento ni su historial de reservas/reseñas (ver comentario en el
 * handler Go). Reactivar reenvía los mismos datos actuales por PUT: el
 * backend no tiene un endpoint separado para "prender" activo, así que
 * cualquier PUT lo hace (ver comentario en lib/api.ts).
 */
export function AlojamientoBajaButton({ alojamiento }: { alojamiento: Alojamiento }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function accionar() {
    startTransition(async () => {
      if (alojamiento.activo) {
        await darDeBajaAlojamientoAction(alojamiento.id);
      } else {
        await reactivarAlojamientoAction(alojamiento.id, {
          nombre: alojamiento.nombre,
          descripcion: alojamiento.descripcion,
          lat: alojamiento.lat,
          lng: alojamiento.lng,
          direccion: alojamiento.direccion,
          precioNoche: alojamiento.precioNoche,
          capacidad: alojamiento.capacidad,
        });
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
