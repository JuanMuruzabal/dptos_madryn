import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchAlojamientosAdmin } from "@/lib/api";
import { crearAlojamientoBorradorAction } from "@/app/actions/admin";
import { primaryButtonClass } from "@/components/admin/ui";
import { AlojamientosTable } from "@/components/admin/alojamientos-table";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Alojamientos — Panel admin" };

export default async function AdminAlojamientosPage() {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const alojamientos = await fetchAlojamientosAdmin(token);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl md:text-5xl">Alojamientos</h1>
        {/* T4.19: ya no navega a un formulario aparte — crea de una un
            borrador (oculto del listado público) y manda directo a su
            propia página en modo editor, donde se completan los datos
            reales y las fotos. */}
        <form action={crearAlojamientoBorradorAction}>
          <button type="submit" className={primaryButtonClass}>
            Nuevo alojamiento
          </button>
        </form>
      </div>

      <div className="mt-8">
        <AlojamientosTable alojamientos={alojamientos} />
      </div>
    </div>
  );
}
