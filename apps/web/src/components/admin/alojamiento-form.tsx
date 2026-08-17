"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useRef } from "react";
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
  formId,
  onDirtyChange,
  onSubmitResult,
}: {
  alojamiento?: Alojamiento;
  action: (prevState: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  /** id del <form> real — deja que un botón AFUERA del form lo dispare
   * (atributo HTML `form="..."`, sin JS de por medio) desde el modal de
   * "cambios sin guardar" de ModoEditor (2026-08-17, pedido del cliente). */
  formId?: string;
  /** Avisa al padre (ModoEditor) cada vez que hay un cambio sin enviar
   * todavía, para la advertencia al salir sin guardar. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Se llama una sola vez por cada intento de guardado que termina
   * (éxito o error) — el padre lo usa para saber cuándo puede completar
   * una navegación que había quedado pendiente por el aviso. */
  onSubmitResult?: (success: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  // No dispara en el estado inicial ({}), que no tiene ni success ni
  // error — recién después de un submit real, sea éxito o falla.
  const yaAvisado = useRef(state);
  useEffect(() => {
    if (yaAvisado.current === state) return;
    yaAvisado.current = state;
    if (!state.success && !state.error) return;
    if (state.success && !state.error) onDirtyChange?.(false);
    onSubmitResult?.(Boolean(state.success && !state.error));
  }, [state, onDirtyChange, onSubmitResult]);

  return (
    <form
      id={formId}
      action={formAction}
      onChange={() => onDirtyChange?.(true)}
      className="max-w-xl space-y-5"
    >
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
      {/* onChange acá aparte del onChange del <form> de arriba (2026-08-17):
          arrastrar/clickear el pin en el mapa cambia lat/lng por JS
          (inputs ocultos que React actualiza directo), eso NO dispara un
          evento nativo input/change real — el onChange delegado del form
          nunca se entera. LocationPicker llama a este callback a mano en
          cada uno de esos casos. */}
      <LocationPicker
        direccionInicial={alojamiento?.direccion}
        latInicial={alojamiento?.lat}
        lngInicial={alojamiento?.lng}
        onChange={() => onDirtyChange?.(true)}
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
