import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchAlojamiento, fetchBloqueos } from "@/lib/api";
import { AlojamientoBajaButton } from "@/components/admin/alojamiento-baja-button";
import { BloqueosManager } from "@/components/admin/bloqueos-manager";
import { primaryButtonClass } from "@/components/admin/ui";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/admin/alojamientos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const alojamiento = await fetchAlojamiento(id);
  return { title: alojamiento ? `${alojamiento.nombre} — Panel admin` : "Alojamiento — Panel admin" };
}

/**
 * Disponibilidad de un alojamiento (T4.3) — bloqueos manuales de fechas y
 * dar de baja. Los datos/precio/portada/fotos/video se editan desde su
 * propia página pública en modo editor (T4.14,
 * app/alojamiento/[id]/page.tsx) — acá solo queda lo que no tiene sentido
 * mostrar en la página pública (bloquear fechas es una acción interna,
 * no algo que un visitante deba ver).
 */
export default async function DisponibilidadAlojamientoPage({
  params,
}: PageProps<"/admin/alojamientos/[id]">) {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const { id } = await params;
  const alojamiento = await fetchAlojamiento(id);
  if (!alojamiento) notFound();

  const bloqueos = await fetchBloqueos(token, id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl md:text-5xl">{alojamiento.nombre}</h1>
        <div className="flex gap-2">
          <Link href={`/alojamiento/${id}?modo=editor`} className={primaryButtonClass}>
            Editar datos y fotos
          </Link>
          <AlojamientoBajaButton alojamiento={alojamiento} />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">
          Disponibilidad — bloqueos manuales
        </h2>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">
          Un bloqueo ocupa esas fechas en el calendario público igual que una reserva real.
        </p>
        <div className="mt-4">
          <BloqueosManager alojamientoId={id} bloqueos={bloqueos} />
        </div>
      </section>
    </div>
  );
}
