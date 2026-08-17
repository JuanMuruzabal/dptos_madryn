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

  // Bug real 2026-08-17, sobre el desborde de Check-in/Check-out en mobile
  // — 4 intentos previos apuntándole al ancho del <input>/su contenedor
  // (grid-cols-1, min-w-0, luego min-w-0/max-w-full/box-border en el
  // input mismo, luego la shadow part ::-webkit-date-and-time-value de
  // Chrome) y seguía viéndose mal en el dispositivo real del cliente: el
  // input type="date" nativo, en ese navegador, se renderiza más ancho
  // que lo que cualquier CSS de ancho (width/max-width/min-width en el
  // input O en su contenedor) le permite — ninguna de esas propiedades
  // fuerza al widget nativo a angostarse por debajo de SU propio mínimo.
  //
  // Cambio de estrategia (pedido del cliente): en vez de seguir tratando
  // de achicar el input a la fuerza, se deja que cada campo mida lo que
  // necesite (sin min-w-0 achicándolo) y el CONTENEDOR (el <form>) puede
  // scrollear horizontal si hace falta. Con esto: en la mayoría de los
  // dispositivos se ve exactamente igual que antes (no hace falta
  // scrollear, todo entra); en el dispositivo puntual donde el input
  // nativo insiste en medir más que la pantalla, la tarjeta gana un
  // scroll horizontal PROPIO y contenido — nada se recorta ni se sale
  // del borde redondeado de la tarjeta, que es lo que se venía viendo
  // mal. flex-col en mobile (no grid-cols-1): con CSS Grid, la pista de
  // una sola columna tiene min-width:0 por definición (así es como
  // Tailwind arma grid-cols-1) y nunca crece más allá del 100% aunque su
  // contenido lo necesite — con flex-col, cada campo sí puede pedir su
  // ancho de contenido real y estirar al padre.
  return (
    <form
      action="/alojamiento"
      method="get"
      className="overflow-x-auto rounded-md border border-ink/10 bg-white/60 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:items-end lg:grid-cols-4">
        <div>
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
        <div>
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
        <div>
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
      </div>
    </form>
  );
}
