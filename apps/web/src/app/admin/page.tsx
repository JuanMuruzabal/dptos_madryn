import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchAlojamientosAdmin, fetchReservasAdmin, fetchResenasAdmin } from "@/lib/api";

// Toda la sección /admin es dinámica de punta a punta (ver comentario en
// app/admin/layout.tsx) — Next exige este opt-out por cada ruta hoja.
export const instant = false;

export const metadata: Metadata = { title: "Panel admin — Turismo Marcuzzi" };

/** Tarjeta de resumen con link — no muestra números "por mostrar algo",
 * cada una lleva directo a la vista que necesita acción (T4.4/T4.5). El
 * borde de color por categoría (T4.8) es el mismo acento que AdminNav —
 * de un vistazo se sabe a qué sección lleva antes de leer la etiqueta. */
function StatCard({
  href,
  label,
  value,
  hint,
  accentBorder,
  accentText,
}: {
  href: string;
  label: string;
  value: number;
  hint?: string;
  accentBorder: string;
  accentText: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md border-l-4 border-y border-r border-ink/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${accentBorder}`}
    >
      <p className="tracked-caps text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`font-display mt-2 text-4xl ${accentText}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const [reservasPendientes, alojamientos, resenas] = await Promise.all([
    fetchReservasAdmin(token, "pendiente"),
    fetchAlojamientosAdmin(token),
    fetchResenasAdmin(token),
  ]);

  const alojamientosActivos = alojamientos.filter((a) => a.activo).length;
  const resenasOcultas = resenas.filter((r) => r.oculta).length;

  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Resumen</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        Un vistazo rápido a lo que necesita tu atención — cada tarjeta lleva directo a esa vista.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          href="/admin/reservas?estado=pendiente"
          label="Reservas pendientes"
          value={reservasPendientes.length}
          hint="Esperando confirmar el pago"
          accentBorder="border-l-coral"
          accentText="text-coral-dark"
        />
        <StatCard
          href="/admin/alojamientos"
          label="Alojamientos activos"
          value={alojamientosActivos}
          hint={`${alojamientos.length - alojamientosActivos} de baja`}
          accentBorder="border-l-tide"
          accentText="text-tide"
        />
        <StatCard
          href="/admin/resenas"
          label="Reseñas ocultas"
          value={resenasOcultas}
          hint={`${resenas.length} en total`}
          accentBorder="border-l-dune"
          accentText="text-[#8a6a2e]"
        />
      </div>
    </div>
  );
}
