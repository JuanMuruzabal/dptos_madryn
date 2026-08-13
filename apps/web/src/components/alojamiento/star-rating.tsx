interface StarRatingProps {
  /** 0–5, puede ser fraccional (promedio real de varias reseñas). */
  rating: number;
  size?: "sm" | "md";
}

/** Estrellas con el dorado de marca (--color-dune, ya reservado en
 * globals.css para "detalles, ratings") — T3.4. Redondea al entero más
 * cercano para el render con caracteres unicode, no hay medias estrellas. */
export function StarRating({ rating, size = "sm" }: StarRatingProps) {
  const llenas = Math.round(rating);
  return (
    <span
      aria-label={`${rating.toFixed(1)} de 5 estrellas`}
      className={`text-dune ${size === "sm" ? "text-sm" : "text-xl"}`}
    >
      <span aria-hidden>{"★".repeat(llenas)}</span>
      <span aria-hidden className="text-ink-soft/25">
        {"★".repeat(5 - llenas)}
      </span>
    </span>
  );
}
