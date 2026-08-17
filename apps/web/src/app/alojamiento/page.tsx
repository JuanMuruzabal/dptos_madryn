import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchAlojamientos, fetchMe } from "@/lib/api";
import { parseAlojamientoFiltros } from "@/lib/alojamiento-filtros";
import { getSessionToken } from "@/lib/session";
import { AlojamientoFiltersForm } from "@/components/alojamiento/alojamiento-filters-form";
import { AlojamientoCard } from "@/components/alojamiento/alojamiento-card";
import { ScrollReveal } from "@/components/scroll-reveal";

export const metadata: Metadata = {
  title: "Alojamiento — Turismo Marcuzzi",
  description:
    "Departamentos en Puerto Madryn con disponibilidad real y atención directa del dueño.",
};

// Server Component que lee searchParams (T2.2) — bajo Cache Components
// (next.config.ts) eso vuelve dinámica cualquier parte que lo lea
// directamente, así que solo <AlojamientoResults> queda detrás de
// Suspense (mismo patrón que account-status.tsx, ver TR-008); el
// encabezado de arriba vuelve a ser parte del shell estático (T4.14:
// se sacó la edición inline de este título/descripción que había en
// T4.13 — el cliente no la quería acá, ver TR-027).
export default function AlojamientoPage(props: PageProps<"/alojamiento">) {
  return (
    <main className="flex-1 bg-sand pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-(--container-max) px-6 md:px-10">
        <p className="tracked-caps mb-3 text-xs font-semibold text-ink-soft">Alojamiento</p>
        <h1 className="font-display max-w-2xl text-4xl md:text-5xl">
          Departamentos en Puerto Madryn
        </h1>
        <p className="mt-4 max-w-xl text-ink-soft">
          Elegí fechas y cantidad de huéspedes para ver disponibilidad real — no listamos nada
          que no puedas reservar hoy.
        </p>

        <div className="mt-10">
          <Suspense fallback={<FiltersSkeleton />}>
            <AlojamientoResults searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function AlojamientoResults({
  searchParams,
}: Pick<PageProps<"/alojamiento">, "searchParams">) {
  const [resolvedSearchParams, token] = await Promise.all([searchParams, getSessionToken()]);
  const filtros = parseAlojamientoFiltros(resolvedSearchParams);
  const [alojamientos, usuario] = await Promise.all([
    fetchAlojamientos(filtros),
    token ? fetchMe(token) : Promise.resolve(null),
  ]);
  // T4.15 (pedido del cliente, 2026-08-13): "Modo editor" y "Editar
  // portada" en cada tarjeta, sin tener que entrar por el panel — mismo
  // chequeo de rol que en el detalle (esAdmin), el backend igual vuelve a
  // exigir requireRole("administrador") en los endpoints reales.
  const esAdmin = usuario?.rol === "administrador";

  return (
    <>
      <AlojamientoFiltersForm filtros={filtros} />

      {alojamientos.length === 0 ? (
        <p className="mt-16 text-center text-ink-soft">
          No encontramos alojamientos disponibles para esa búsqueda. Probá otras fechas o sacá
          algún filtro.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {alojamientos.map((a, i) => (
            <ScrollReveal key={a.id} delay={Math.min(i * 0.05, 0.3)}>
              <AlojamientoCard alojamiento={a} esAdmin={esAdmin} />
            </ScrollReveal>
          ))}
        </div>
      )}
    </>
  );
}

function FiltersSkeleton() {
  return <div aria-hidden className="h-[220px] animate-pulse rounded-md bg-sand-dim sm:h-[100px]" />;
}
