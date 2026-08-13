"use client";

import { useState } from "react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { FotoPortadaManager } from "@/components/admin/foto-portada-manager";

/**
 * Botón "Editar portada" + uploader plegable, para usar directo en la
 * tarjeta del listado de Alojamiento (T4.15, pedido del cliente
 * 2026-08-13: "trasladar la parte de edición de portada a la página de
 * alojamientos") — reutiliza FotoPortadaManager (mismo formulario que
 * tenía el modo editor del detalle) adentro de un toggle compacto, en vez
 * de duplicar la lógica de subida.
 */
export function FotoPortadaCardEditor({ alojamientoId, portada }: { alojamientoId: string; portada?: Foto }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="tracked-caps block text-[0.65rem] font-semibold text-[#8a6a2e] hover:underline"
      >
        {abierto ? "Cerrar" : "Editar portada"}
      </button>

      {abierto && (
        <div className="mt-2">
          <FotoPortadaManager alojamientoId={alojamientoId} portada={portada} />
        </div>
      )}
    </div>
  );
}
