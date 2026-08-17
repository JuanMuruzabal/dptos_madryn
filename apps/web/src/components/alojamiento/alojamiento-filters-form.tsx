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
  // sm:grid-cols-2 lg:grid-cols-4 (no directo a 4 desde sm, bug real
  // 2026-08-17 #2: seguía sobresaliendo) — el input de fecha nativo
  // también queda apretado en el rango de tablet/pantalla mediana
  // (~640-1024px) con 4 columnas fijas; recién a partir de lg (1024px)
  // hay ancho de sobra por columna para las 4 juntas.
  return (
    <form
      action="/alojamiento"
      method="get"
      className="grid grid-cols-1 gap-4 rounded-md border border-ink/10 bg-white/60 p-5 sm:grid-cols-2 sm:items-end lg:grid-cols-4"
    >
      {/* min-w-0 en los 3 campos (bug real 2026-08-17, "el input sobresale
          de la caja"): sin esto, un item de grid no se achica por debajo
          del ancho intrínseco de su contenido — un <input type="date">
          nativo tiene uno bastante grande en algunos navegadores mobile,
          así que se salía de su celda aunque el input en sí tuviera
          w-full.
          Bug real 2026-08-17 #3, seguía sobresaliendo con lo de arriba: el
          min-w-0 estaba solo en el <div> contenedor, no en el <input> en
          sí. El widget nativo de type="date" (el ícono de calendario +
          los 3 segmentos día/mes/año) tiene, en varios navegadores mobile,
          un ancho de contenido mínimo intrínseco que gana por sobre
          `width: 100%` si el propio input no tiene min-width:0 puesto
          (mismo motivo por el que hace falta min-w-0 en un hijo de grid/
          flex, pero acá aplica al elemento mismo, no solo al contenedor).
          max-w-full es el mismo respaldo que se usa en <img>/<iframe>
          responsive: junto con width:100%, evita que el ancho intrínseco
          del widget nativo empuje más allá del 100% del padre. box-border
          deja explícito box-sizing:border-box en el input puntual (ya lo
          da Preflight de Tailwind global, pero así no depende de que
          nada lo pise). */}
      <div className="min-w-0">
        <label htmlFor="fecha_inicio" className={authLabelClass}>
          Check-in
        </label>
        <input
          type="date"
          id="fecha_inicio"
          name="fecha_inicio"
          defaultValue={filtros.fechaInicio}
          className={`${authInputClass} box-border min-w-0 max-w-full`}
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
          className={`${authInputClass} box-border min-w-0 max-w-full`}
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
