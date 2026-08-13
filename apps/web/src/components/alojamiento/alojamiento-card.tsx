import Link from "next/link";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { Scene } from "@/components/scene";
import { StarRating } from "@/components/alojamiento/star-rating";
import { formatARS } from "@/lib/currency";
import { placeholderGradient } from "@/lib/placeholder-gradient";
import { FotoPortadaCardEditor } from "@/components/admin/foto-portada-card-editor";

/**
 * Tarjeta de grilla (T2.2, spec §4.2: "foto principal, precio por noche,
 * calificación (estrellas), descripción breve de la ubicación"). Las
 * estrellas (T3.4) solo aparecen con al menos una reseña real — sin eso,
 * `ratingPromedio` viene undefined desde la API (nunca se fabrica un
 * rating falso).
 *
 * `esAdmin` (T4.15/T4.16, pedido del cliente 2026-08-13) agrega, debajo
 * del bloque de texto, "Editar portada" (sube/reemplaza la miniatura sin
 * salir del listado) — el atajo a "Modo editor" se sacó de acá (T4.16,
 * vive dentro de la propia página del alojamiento, no en la tarjeta). La
 * tarjeta deja de ser UN solo <Link> envolviendo todo — pasa a dos Links
 * (imagen, texto) más el bloque admin aparte, porque un <button> no puede
 * anidarse dentro de un <a> (HTML inválido / rompe accesibilidad).
 */
export function AlojamientoCard({
  alojamiento,
  esAdmin = false,
}: {
  alojamiento: Alojamiento;
  esAdmin?: boolean;
}) {
  // T4.14: la portada (si se cargó una) es la miniatura del listado —
  // antes siempre era fotos[0] (la primera foto subida, sin ninguna
  // curaduría). Si todavía no hay portada, cae a fotos[0] como antes,
  // para no dejar la tarjeta sin imagen en alojamientos ya cargados.
  const portada = alojamiento.fotos.find((f) => f.esPortada);
  const fotoPrincipal = portada ?? alojamiento.fotos[0];

  return (
    <div>
      <Link
        href={`/alojamiento/${alojamiento.id}`}
        className="group block overflow-hidden rounded-md"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-md">
          <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]">
            <Scene
              scene={{
                place: alojamiento.nombre,
                caption: alojamiento.direccion,
                gradient: placeholderGradient(alojamiento.id),
                image: fotoPrincipal?.url,
              }}
              alt={alojamiento.nombre}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          </div>
        </div>
      </Link>

      <Link href={`/alojamiento/${alojamiento.id}`} className="mt-3 block">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg text-ink">{alojamiento.nombre}</h3>
          <p className="whitespace-nowrap text-sm font-medium text-ink">
            {formatARS(alojamiento.precioNoche)}
            <span className="text-ink-soft"> /noche</span>
          </p>
        </div>
        {alojamiento.direccion && (
          <p className="mt-1 text-sm text-ink-soft">{alojamiento.direccion}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="tracked-caps text-[0.65rem] font-semibold text-ink-soft">
            Hasta {alojamiento.capacidad} {alojamiento.capacidad === 1 ? "huésped" : "huéspedes"}
          </p>
          {alojamiento.ratingPromedio !== undefined && (
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <StarRating rating={alojamiento.ratingPromedio} />
              {alojamiento.ratingPromedio.toFixed(1)}
            </span>
          )}
        </div>
      </Link>

      {esAdmin && (
        <div className="mt-2 border-t border-dune/20 pt-2">
          <FotoPortadaCardEditor alojamientoId={alojamiento.id} portada={portada} />
        </div>
      )}
    </div>
  );
}
