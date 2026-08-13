import type { Metadata } from "next";
import type { ReservaEstado } from "@turismo-marcuzzi/shared-types";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchReservasAdmin } from "@/lib/api";
import { ReservasTable } from "@/components/admin/reservas-table";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Reservas — Panel admin" };

const ESTADOS_VALIDOS: ReservaEstado[] = ["pendiente", "confirmada", "cancelada"];

/**
 * Listado y gestión de reservas entrantes (T4.4, refinado en T4.9) — el
 * corazón del panel: acá el admin confirma una reserva `pendiente` una vez
 * que coordinó el pago fuera de la plataforma con el cliente (spec §4.7),
 * usando los datos de contacto puntuales (T3.5) para cotejarlo. Confirmar
 * es la acción que dispara FR-11 para ese usuario (T4.6).
 *
 * T4.9: se trae TODO de una — el filtro por estado y la búsqueda ahora
 * viven del lado del cliente (ReservasTable), instantáneos, sin ida y
 * vuelta al backend por cada tab. `?estado=` en la URL (el link del
 * dashboard, T4.8) solo define el tab inicial, ya no re-consulta al backend.
 */
export default async function AdminReservasPage(props: PageProps<"/admin/reservas">) {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const searchParams = await props.searchParams;
  const estadoParam = typeof searchParams.estado === "string" ? searchParams.estado : "";
  const filtroInicial = ESTADOS_VALIDOS.includes(estadoParam as ReservaEstado)
    ? (estadoParam as ReservaEstado)
    : "pendiente";

  const reservas = await fetchReservasAdmin(token);

  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Reservas</h1>
      <div className="mt-8">
        <ReservasTable reservas={reservas} filtroInicial={filtroInicial} />
      </div>
    </div>
  );
}
