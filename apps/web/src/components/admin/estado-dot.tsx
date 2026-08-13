import type { ReservaEstado } from "@turismo-marcuzzi/shared-types";

/** Marrón para pendiente (mismo tono que ReservaEstadoBadge usa de texto),
 * verde para confirmada, rojo para cancelada (T4.9, pedido del cliente,
 * 2026-08-13) — a diferencia de ReservaEstadoBadge (chip con texto, usado
 * en /perfil), acá es solo el punto de color: la fila de la tabla ya dice
 * el resto con palabras, no hace falta repetir la etiqueta. */
const COLOR: Record<ReservaEstado, string> = {
  pendiente: "bg-[#8a6a2e]",
  confirmada: "bg-steppe",
  cancelada: "bg-coral-dark",
};

const LABEL: Record<ReservaEstado, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

export function EstadoDot({ estado }: { estado: ReservaEstado }) {
  return (
    <span
      role="img"
      aria-label={LABEL[estado]}
      title={LABEL[estado]}
      className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${COLOR[estado]}`}
    />
  );
}
