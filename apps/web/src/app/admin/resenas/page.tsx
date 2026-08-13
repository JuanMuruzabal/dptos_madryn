import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchResenasAdmin } from "@/lib/api";
import { ResenasTable } from "@/components/admin/resenas-table";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Reseñas — Panel admin" };

/** Moderación de reseñas (T4.5/T4.12, spec §4.8) — ocultar sin borrar de
 * la base, para poder revertir un error de moderación sin perder el dato. */
export default async function AdminResenasPage() {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const resenas = await fetchResenasAdmin(token);

  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Reseñas</h1>
      <div className="mt-8">
        <ResenasTable resenas={resenas} />
      </div>
    </div>
  );
}
