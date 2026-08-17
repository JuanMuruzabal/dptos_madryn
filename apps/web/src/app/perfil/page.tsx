import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken, deleteSession } from "@/lib/session";
import { fetchMe, fetchMisReservas } from "@/lib/api";
import { logoutAction } from "@/app/actions/auth";
import { formatARS } from "@/lib/currency";
import { ReservaEstadoBadge } from "@/components/reserva-estado-badge";

export const metadata: Metadata = { title: "Mi perfil — Turismo Marcuzzi" };

// Chequeo "seguro" (DAL, ver guía de auth de Next.js): a diferencia del
// optimista de proxy.ts, acá sí llamamos a apps/api — es quien valida la
// firma del JWT de verdad. Si el token es viejo/inválido, se borra la
// cookie y se manda a /ingresar en vez de mostrar una página rota.
export default async function PerfilPage() {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const usuario = await fetchMe(token);
  if (!usuario) {
    await deleteSession();
    redirect("/ingresar");
  }

  // Una cuenta admin no reserva como cliente (pedido del cliente,
  // 2026-08-13, ver reservas.go) — no tiene sentido mostrarle "tus
  // reservas" (siempre vacío) ni gastar un fetch en algo que nunca va a
  // tener contenido real; en su lugar, un atajo directo y llamativo al
  // panel, que es la razón de ser de esta cuenta.
  const esAdmin = usuario.rol === "administrador";

  const todasLasReservas = esAdmin ? [] : await fetchMisReservas(token);
  // Se siguen ocultando del perfil, sin acción posible sobre ellas para el
  // cliente (T3.5/T3.7, TR-015/TR-016). Ya no se acumulan por vencimiento
  // automático (2026-08-13: internal/reservas/expirer.go ahora borra esa
  // fila en vez de soft-cancelarla) — lo que pueda quedar cancelado acá es
  // solo cancelación manual del admin desde el panel.
  const reservas = todasLasReservas.filter((r) => r.estado !== "cancelada");

  return (
    <main className="bg-tapiz flex-1 px-6 pt-[var(--header-height)] pb-24 md:px-10">
      <div className="mx-auto max-w-(--container-max)">
        <p className="tracked-caps mb-3 text-xs font-semibold text-ink-soft">
          Mi cuenta
        </p>
        <h1 className="font-display text-4xl md:text-5xl">
          Hola, {usuario.nombre.split(" ")[0]}
        </h1>

        <dl className="mt-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-ink-soft">Nombre</dt>
          <dd>{usuario.nombre}</dd>
          <dt className="text-ink-soft">Email</dt>
          <dd>{usuario.email}</dd>
          {usuario.telefono && (
            <>
              <dt className="text-ink-soft">Teléfono</dt>
              <dd>{usuario.telefono}</dd>
            </>
          )}
        </dl>

        <div className="horizon-rule my-10 max-w-md" />

        {esAdmin && (
          <Link
            href="/admin"
            className="group mb-10 flex max-w-2xl items-center justify-between gap-6 overflow-hidden rounded-md bg-coral px-6 py-6 text-sand shadow-lg shadow-coral/20 transition-transform hover:-translate-y-0.5 sm:px-8"
          >
            <div>
              <p className="tracked-caps text-xs font-semibold text-sand/80">
                Acceso rápido
              </p>
              <p className="font-display mt-1 text-2xl sm:text-3xl">Panel de administración</p>
              <p className="mt-1 text-sm text-sand/85">
                Gestioná reservas, alojamientos y reseñas.
              </p>
            </div>
            <span
              aria-hidden
              className="font-display flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-sand/15 text-2xl transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        )}

        {!esAdmin && (
        <section>
          <h2 className="tracked-caps text-xs font-semibold text-ink-soft">
            Tus reservas
          </h2>
          {reservas.length === 0 ? (
            <p className="mt-3 max-w-md text-sm text-ink-soft">
              Todavía no tenés reservas. Cuando reserves un alojamiento, lo vas a
              ver acá con su estado.
            </p>
          ) : (
            <ul className="mt-4 max-w-2xl space-y-4">
              {reservas.map((reserva) => (
                <li
                  key={reserva.id}
                  className="flex items-center gap-4 rounded-md border border-ink/10 bg-white/60 p-4"
                >
                  <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md bg-sand-dim">
                    {reserva.alojamiento?.fotoUrl && (
                      <Image
                        src={reserva.alojamiento.fotoUrl}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {reserva.alojamiento ? (
                        <Link
                          href={`/alojamiento/${reserva.alojamiento.id}`}
                          className="font-medium text-ink hover:text-tide"
                        >
                          {reserva.alojamiento.nombre}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">Alojamiento</span>
                      )}
                      <ReservaEstadoBadge estado={reserva.estado} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {reserva.fechaInicio} → {reserva.fechaFin} · {formatARS(reserva.total)}
                    </p>
                    {reserva.estado === "pendiente" && (
                      <p className="mt-1 text-xs text-ink-soft">
                        Pendiente de confirmación por el anfitrión
                        {reserva.expiraEn &&
                          ` — vence a las ${new Date(reserva.expiraEn).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} si nadie la confirma antes`}
                        .
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        {/* Rojo (2026-08-17, pedido del cliente) — mismo tono que el
            "Cerrar sesión" del menú de cuenta (ver account-menu.tsx,
            dropdownLogoutClass/inlineLogoutClass), acá con borde en vez de
            texto plano porque este botón vive suelto en la página, no
            dentro de una lista de opciones. */}
        <form action={logoutAction} className="mt-12">
          <button
            type="submit"
            className="rounded-full border border-coral-dark/40 px-6 py-2.5 text-sm font-semibold text-coral-dark transition-colors hover:bg-coral-dark hover:text-sand"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
