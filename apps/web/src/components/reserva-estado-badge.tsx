import type { ReservaEstado } from "@turismo-marcuzzi/shared-types";

const ESTILOS: Record<ReservaEstado, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-dune/15 text-[#8a6a2e]" },
  confirmada: { label: "Confirmada", className: "bg-steppe/15 text-steppe" },
  cancelada: { label: "Cancelada", className: "bg-ink/10 text-ink-soft" },
};

/** Insignia de estado de reserva — reutilizada en /perfil (T3.2) y en el
 * futuro panel admin (Sprint 4, T4.4). Un solo lugar para el mapeo
 * estado→color/label. */
export function ReservaEstadoBadge({ estado }: { estado: ReservaEstado }) {
  const { label, className } = ESTILOS[estado];
  return (
    <span className={`tracked-caps rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${className}`}>
      {label}
    </span>
  );
}
