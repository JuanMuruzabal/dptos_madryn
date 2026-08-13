import Link from "next/link";
import type { Metadata } from "next";
import { crearAlojamientoAction } from "@/app/actions/admin";
import { AlojamientoForm } from "@/components/admin/alojamiento-form";
import { secondaryButtonClass } from "@/components/admin/ui";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Nuevo alojamiento — Panel admin" };

// Mismo shell visual que el modo editor de un alojamiento ya creado
// (app/alojamiento/[id]/page.tsx, ModoEditor) — banner + tarjeta blanca —
// pedido del cliente (2026-08-13) para que la creación se sienta como el
// mismo lugar donde después se edita, no una pantalla aparte.
export default function NuevoAlojamientoPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dune/30 bg-dune/10 px-4 py-2.5">
        <p className="tracked-caps text-xs font-semibold text-[#8a6a2e]">Nuevo alojamiento</p>
        <Link href="/admin/alojamientos" className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}>
          Volver al panel
        </Link>
      </div>

      <section className="rounded-md border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Datos y precio</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Después de crearlo vas a poder cargarle foto de portada, fotos y video — en la
          misma página donde después lo vas a editar.
        </p>
        <div className="mt-4">
          <AlojamientoForm action={crearAlojamientoAction} />
        </div>
      </section>
    </div>
  );
}
