"use client";

import { useActionState, useState } from "react";
import { crearResenaAction } from "@/app/actions/resenas";
import { authInputClass, authLabelClass } from "@/components/auth/auth-shell";

/**
 * Formulario de reseña (T3.4) — solo se muestra si el usuario tiene una
 * reserva `confirmada` de este alojamiento (chequeado server-side en
 * alojamiento/[id]/page.tsx); el backend vuelve a exigirlo de todas
 * formas (nunca confiar solo en ocultar el formulario del lado del
 * cliente).
 */
export function ResenaForm({ alojamientoId }: { alojamientoId: string }) {
  const [rating, setRating] = useState(5);
  const [state, formAction, isPending] = useActionState(crearResenaAction, {});

  if (state.success) {
    return (
      <p role="status" className="mt-6 max-w-md text-sm text-ink">
        ¡Gracias por tu reseña!
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 max-w-md space-y-4">
      <input type="hidden" name="alojamientoId" value={alojamientoId} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <p className={authLabelClass}>Tu calificación</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              onClick={() => setRating(n)}
              className={`text-2xl leading-none transition-colors ${
                n <= rating ? "text-dune" : "text-ink-soft/25 hover:text-dune/60"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="texto" className={authLabelClass}>
          Tu reseña
        </label>
        <textarea
          id="texto"
          name="texto"
          rows={3}
          required
          className={authInputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-coral-dark">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Enviando…" : "Publicar reseña"}
      </button>
    </form>
  );
}
