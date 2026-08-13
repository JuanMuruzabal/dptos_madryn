import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchAlojamientosAdmin } from "@/lib/api";
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
        <Link href="/admin/alojamientos/nuevo" className={primaryButtonClass}>
          Nuevo alojamiento
        </Link>
      </div>

      <div className="mt-8">
        <AlojamientosTable alojamientos={alojamientos} />
      </div>
    </div>
  );
}
