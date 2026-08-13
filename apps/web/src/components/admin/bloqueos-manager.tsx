"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Bloqueo } from "@turismo-marcuzzi/shared-types";
import { crearBloqueoAction, eliminarBloqueoAction, type AdminFormState } from "@/app/actions/admin";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/**
 * Bloqueos manuales de fechas (T4.3, spec §4.8 "gestión de
 * disponibilidad") — un bloqueo ocupa el calendario público igual que una
 * reserva real (mismo exclusion constraint, ver TR-019 en
 * docs/tradeoffs.md), para mantenimiento, uso propio, etc. Liberar un
 * bloqueo lo vuelve a poner disponible al toque.
 */
export function BloqueosManager({ alojamientoId, bloqueos }: { alojamientoId: string; bloqueos: Bloqueo[] }) {
  const crear = crearBloqueoAction.bind(null, alojamientoId);
  const [state, formAction, pending] = useActionState(crear, initialState);
  const [eliminando, startEliminar] = useTransition();
  const router = useRouter();

  function eliminar(bloqueoId: string) {
    startEliminar(async () => {
      await eliminarBloqueoAction(alojamientoId, bloqueoId);
      router.refresh();
    });
  }

  return (
    <div>
      {bloqueos.length > 0 && (
        <ul className="mb-5 space-y-2">
          {bloqueos.map((bloqueo) => (
            <li
              key={bloqueo.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink/10 bg-white px-4 py-2.5 text-sm"
            >
              <span>
                {bloqueo.fechaInicio} → {bloqueo.fechaFin}
                {bloqueo.motivo && <span className="text-ink-soft"> — {bloqueo.motivo}</span>}
              </span>
              <button
                type="button"
                disabled={eliminando}
                onClick={() => eliminar(bloqueo.id)}
                className="text-xs font-semibold text-coral-dark hover:underline"
              >
                Liberar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fechaInicio" className={labelClass}>Desde</label>
          <input id="fechaInicio" name="fechaInicio" type="date" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="fechaFin" className={labelClass}>Hasta</label>
          <input id="fechaFin" name="fechaFin" type="date" required className={inputClass} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="motivo" className={labelClass}>Motivo (opcional)</label>
          <input id="motivo" name="motivo" placeholder="Mantenimiento…" className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} px-4 py-2.5 text-xs`}>
          {pending ? "Bloqueando…" : "Bloquear"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-coral-dark">{state.error}</p>}
    </div>
  );
}
