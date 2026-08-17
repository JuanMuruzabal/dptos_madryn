import type { Resena } from "@turismo-marcuzzi/shared-types";
import { StarRating } from "@/components/alojamiento/star-rating";
import { ResenaBorrarButton } from "@/components/alojamiento/resena-borrar-button";

/** Listado de reseñas del detalle (T3.4) — server-renderable, sin
 * interacción propia (el botón de borrar es la única parte "use client",
 * ver resena-borrar-button.tsx), así que este componente no hace falta
 * que lo sea.
 *
 * Fondo blanco por tarjeta (2026-08-17, pedido del cliente: "que el color
 * de fondo de las reseñas sean blancos") — antes eran simples renglones
 * separados por una línea, ahora cada reseña es su propia tarjeta. */
export function ResenasList({
  resenas,
  alojamientoId,
  miUsuarioId,
}: {
  resenas: Resena[];
  alojamientoId: string;
  /** id del usuario logueado (undefined si no hay sesión) — solo se
   * muestra el botón de borrar en la reseña propia. */
  miUsuarioId?: string;
}) {
  if (resenas.length === 0) {
    return (
      <p className="mt-3 max-w-md text-sm text-ink-soft">
        Todavía no hay reseñas para este alojamiento.
      </p>
    );
  }

  return (
    <ul className="mt-4 max-w-2xl space-y-4">
      {resenas.map((resena) => (
        <li
          key={resena.id}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-ink">{resena.usuarioNombre}</p>
            <StarRating rating={resena.rating} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">{resena.texto}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="tracked-caps text-[0.6rem] text-ink-soft/70">
              {new Date(resena.createdAt).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {resena.usuarioId === miUsuarioId && (
              <ResenaBorrarButton id={resena.id} alojamientoId={alojamientoId} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
