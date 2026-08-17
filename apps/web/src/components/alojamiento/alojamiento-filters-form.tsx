import Link from "next/link";
import type { AlojamientoFiltros } from "@/lib/api";
import { authInputClass, authLabelClass } from "@/components/auth/auth-shell";

/**
 * Filtros del listado (spec §4.2): rango de fechas y huéspedes. El precio
 * min/max se sacó de la barra de búsqueda (pedido del cliente, 2026-08-12)
 * — `fetchAlojamientos`/el backend lo siguen soportando (ver lib/api.ts),
 * solo dejó de exponerse acá. Formulario GET plano a propósito — sin
 * "use client": el navegador arma la query string solo, la página vuelve
 * a renderizar en el servidor con los filtros nuevos (mismo patrón que
 * cualquier búsqueda con URL compartible/bookmarkeable, y funciona sin JS).
 */
export function AlojamientoFiltersForm({ filtros }: { filtros: AlojamientoFiltros }) {
  const hayFiltros = Object.keys(filtros).length > 0;

  // grid-cols-1 en mobile (no grid-cols-2, bug real 2026-08-17): con 2
  // columnas, cada <input type="date"> nativo quedaba con ~160px de ancho
  // en un teléfono común — no le alcanza al selector nativo del
  // navegador, se recorta/superpone contra la celda de al lado.
  return (
    <form
      action="/alojamiento"
      method="get"
      className="grid grid-cols-1 gap-4 rounded-md border border-ink/10 bg-white/60 p-5 sm:grid-cols-4 sm:items-end"
    >
      {/* min-w-0 en los 3 campos (bug real 2026-08-17, "el input sobresale
          de la caja"): sin esto, un item de grid no se achica por debajo
          del ancho intrínseco de su contenido — un <input type="date">
          nativo tiene uno bastante grande en algunos navegadores mobile,
          así que se salía de su celda aunque el input en sí tuviera
          w-full. */}
      <div className="min-w-0">
        <label htmlFor="fecha_inicio" className={authLabelClass}>
          Check-in
        </label>
        <input
          type="date"
          id="fecha_inicio"
          name="fecha_inicio"
          defaultValue={filtros.fechaInicio}
          className={authInputClass}
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="fecha_fin" className={authLabelClass}>
          Check-out
        </label>
        <input
          type="date"
          id="fecha_fin"
          name="fecha_fin"
          defaultValue={filtros.fechaFin}
          className={authInputClass}
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="huespedes" className={authLabelClass}>
          Huéspedes
        </label>
        <input
          type="number"
          id="huespedes"
          name="huespedes"
          min={1}
          defaultValue={filtros.huespedes}
          className={authInputClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark"
        >
          Buscar
        </button>
        {hayFiltros && (
          <Link href="/alojamiento" className="text-sm text-ink-soft hover:text-tide">
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
