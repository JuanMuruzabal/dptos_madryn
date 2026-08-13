"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReservaEstado } from "@turismo-marcuzzi/shared-types";
import { actualizarEstadoReservaAction } from "@/app/actions/admin";
import { dangerButtonClass, primaryButtonClass } from "@/components/admin/ui";

/**
 * Confirmar/cancelar una reserva (T4.4) — la acción que reemplaza los
 * UPDATE a mano por SQL que veníamos usando para probar el flujo de
 * confirmación en rondas anteriores. Sin form/useActionState: no hay
 * inputs que juntar, solo un id y un estado destino (mismo criterio que
 * marcarContactadoAction).
 */
export function ReservaRowActions({ id, estado }: { id: string; estado: ReservaEstado }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (estado === "cancelada") return null;

  function accionar(nuevoEstado: "confirmada" | "cancelada") {
    startTransition(async () => {
      await actualizarEstadoReservaAction(id, nuevoEstado);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {estado === "pendiente" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => accionar("confirmada")}
          className={`${primaryButtonClass} px-4 py-2 text-xs`}
        >
          Confirmar
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => accionar("cancelada")}
        className={`${dangerButtonClass} px-4 py-2 text-xs`}
      >
        Cancelar
      </button>
    </div>
  );
}
