"use client";

import { useActionState } from "react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import type { AdminFormState } from "@/app/actions/admin";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/**
 * Formulario de alta/edición de alojamiento (T4.2) — mismos campos que
 * alojamientoRequest en apps/api/internal/http/alojamientos.go. Un solo
 * componente para crear y editar: la única diferencia es qué Server Action
 * se le pasa (bind del id para editar, ver app/admin/alojamientos/[id]/page.tsx)
 * y los valores iniciales.
 */
export function AlojamientoForm({
  alojamiento,
  action,
}: {
  alojamiento?: Alojamiento;
  action: (prevState: AdminFormState, formData: FormData) => Promise<AdminFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div>
        <label htmlFor="nombre" className={labelClass}>Nombre</label>
        <input id="nombre" name="nombre" required defaultValue={alojamiento?.nombre} className={inputClass} />
      </div>

      <div>
        <label htmlFor="descripcion" className={labelClass}>Descripción</label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={alojamiento?.descripcion}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="direccion" className={labelClass}>Dirección</label>
        <input
          id="direccion"
          name="direccion"
          defaultValue={alojamiento?.direccion}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lat" className={labelClass}>Latitud</label>
          <input
            id="lat"
            name="lat"
            type="number"
            step="any"
            required
            defaultValue={alojamiento?.lat}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lng" className={labelClass}>Longitud</label>
          <input
            id="lng"
            name="lng"
            type="number"
            step="any"
            required
            defaultValue={alojamiento?.lng}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="precioNoche" className={labelClass}>Precio por noche (ARS)</label>
          <input
            id="precioNoche"
            name="precioNoche"
            type="number"
            min="1"
            step="any"
            required
            defaultValue={alojamiento?.precioNoche}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="capacidad" className={labelClass}>Capacidad (huéspedes)</label>
          <input
            id="capacidad"
            name="capacidad"
            type="number"
            min="1"
            required
            defaultValue={alojamiento?.capacidad}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-coral-dark">{state.error}</p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-sm text-steppe">Guardado.</p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Guardando…" : alojamiento ? "Guardar cambios" : "Crear alojamiento"}
      </button>
    </form>
  );
}
