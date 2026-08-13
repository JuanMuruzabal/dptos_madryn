import type { Resena } from "@turismo-marcuzzi/shared-types";
import { StarRating } from "@/components/alojamiento/star-rating";

/** Listado de reseñas del detalle (T3.4) — server-renderable, sin
 * interacción, así que no hace falta "use client". */
export function ResenasList({ resenas }: { resenas: Resena[] }) {
  if (resenas.length === 0) {
    return (
      <p className="mt-3 max-w-md text-sm text-ink-soft">
        Todavía no hay reseñas para este alojamiento.
      </p>
    );
  }

  return (
    <ul className="mt-4 max-w-2xl space-y-6">
      {resenas.map((resena) => (
        <li key={resena.id} className="border-b border-ink/10 pb-6 last:border-0">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-ink">{resena.usuarioNombre}</p>
            <StarRating rating={resena.rating} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">{resena.texto}</p>
          <p className="tracked-caps mt-2 text-[0.6rem] text-ink-soft/70">
            {new Date(resena.createdAt).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
