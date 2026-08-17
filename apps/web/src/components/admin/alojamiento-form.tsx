"use client";

import dynamic from "next/dynamic";
import { useActionState } from "react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import type { AdminFormState } from "@/app/actions/admin";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/ui";

// `ssr: false` es válido acá porque AlojamientoForm ya es un Client
// Component ("use client" arriba) — Leaflet toca `window` apenas se
// importa, así que no puede intentar prerenderizarse en el servidor
// (mismo motivo que location-map-loader.tsx, pero sin necesitar un
// archivo aparte porque este componente ya corre del lado del cliente).
const LocationPicker = dynamic(
  () => import("@/components/admin/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => <div aria-hidden className="h-64 animate-pulse rounded-md bg-sand-dim" />,
  },
);

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

      {/* grid-cols-1 en mobile (bug real 2026-08-17): esta página se
          renderiza directo sobre el ancho real del viewport (a diferencia
          de reserva-edit-form.tsx, protegido por el min-width de la tabla
          que lo contiene) — 2 columnas fijas quedaban apretadas en un
          teléfono común. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Al final del form a propósito (T4.21, pedido del cliente
          2026-08-14): el orden visual de ModoEditor pasó a ser
          fotos → datos y precio → ubicación, así que el mapa queda
          como lo último que se completa, no en el medio del form. */}
      <LocationPicker
        direccionInicial={alojamiento?.direccion}
        latInicial={alojamiento?.lat}
        lngInicial={alojamiento?.lng}
      />

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
