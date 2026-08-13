/**
 * Clases compartidas del panel admin (Sprint 4) — mismos primitivos
 * visuales que components/auth/auth-shell.tsx (inputs/labels/botones),
 * centralizados acá para no duplicarlos en cada formulario nuevo del
 * panel (alojamientos, bloqueos, reservas, reseñas).
 */
export const inputClass =
  "w-full rounded-md border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export const primaryButtonClass =
  "rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-full border border-ink/20 px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-sand disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButtonClass =
  "rounded-full border border-coral/40 px-6 py-2.5 text-sm font-semibold text-coral-dark transition-colors hover:bg-coral hover:text-sand disabled:cursor-not-allowed disabled:opacity-60";

// Blanco sólido, no translúcido (`bg-white`, no `bg-white/60`): contra el
// `bg-sand` de fondo de /admin, el blanco al 60% se camuflaba con la
// página (reportado 2026-08-13) — blanco/tonos de gris muy suaves es la
// pauta para toda tarjeta nueva del panel, no solo para esta.
export const cardClass = "rounded-md border border-ink/10 bg-white p-5 shadow-sm";
