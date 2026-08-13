import type { Metadata } from "next";
import { crearAlojamientoAction } from "@/app/actions/admin";
import { AlojamientoForm } from "@/components/admin/alojamiento-form";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Nuevo alojamiento — Panel admin" };

export default function NuevoAlojamientoPage() {
  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Nuevo alojamiento</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        Después de crearlo vas a poder cargarle fotos y bloquear fechas desde su página de edición.
      </p>
      <div className="mt-8">
        <AlojamientoForm action={crearAlojamientoAction} />
      </div>
    </div>
  );
}
