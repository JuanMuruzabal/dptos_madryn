"use client";

import { useActionState } from "react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { actualizarDatosReservaAction, type AdminFormState } from "@/app/actions/admin";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/**
 * Edición de fechas/contacto de una reserva pendiente/confirmada (T4.13,
 * pedido del cliente: "por si se llegara a dar el caso de un imprevisto o
 * edición"). No toca el estado — eso sigue siendo ReservaRowActions
 * (confirmar/cancelar). Las fechas nuevas siguen protegidas por el mismo
 * exclusion constraint que una reserva nueva (TR-005): si chocan con algo
 * ocupado, el backend las rechaza igual.
 */
export function ReservaEditForm({ reserva, onCancel }: { reserva: Reserva; onCancel: () => void }) {
  const accion = actualizarDatosReservaAction.bind(null, reserva.id);
  const [state, formAction, pending] = useActionState(accion, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`fechaInicio-${reserva.id}`} className={labelClass}>Check-in</label>
          <input
            id={`fechaInicio-${reserva.id}`}
            name="fechaInicio"
            type="date"
            required
            defaultValue={reserva.fechaInicio}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`fechaFin-${reserva.id}`} className={labelClass}>Check-out</label>
          <input
            id={`fechaFin-${reserva.id}`}
            name="fechaFin"
            type="date"
            required
            defaultValue={reserva.fechaFin}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`contactoNombre-${reserva.id}`} className={labelClass}>Nombre</label>
          <input
            id={`contactoNombre-${reserva.id}`}
            name="contactoNombre"
            required
            defaultValue={reserva.contactoNombre}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`contactoApellido-${reserva.id}`} className={labelClass}>Apellido</label>
          <input
            id={`contactoApellido-${reserva.id}`}
            name="contactoApellido"
            required
            defaultValue={reserva.contactoApellido}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`contactoDni-${reserva.id}`} className={labelClass}>DNI</label>
        <input
          id={`contactoDni-${reserva.id}`}
          name="contactoDni"
          required
          defaultValue={reserva.contactoDni}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`contactoEmail-${reserva.id}`} className={labelClass}>Email</label>
          <input
            id={`contactoEmail-${reserva.id}`}
            name="contactoEmail"
            type="email"
            required
            defaultValue={reserva.contactoEmail}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`contactoTelefono-${reserva.id}`} className={labelClass}>Teléfono</label>
          <input
            id={`contactoTelefono-${reserva.id}`}
            name="contactoTelefono"
            required
            defaultValue={reserva.contactoTelefono}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-coral-dark">{state.error}</p>}
      {state.success && !state.error && <p role="status" className="text-sm text-steppe">Guardado.</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${primaryButtonClass} px-4 py-2 text-xs`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={onCancel} className={`${secondaryButtonClass} px-4 py-2 text-xs`}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
