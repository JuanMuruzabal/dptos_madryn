import Link from "next/link";
import type { CSSProperties } from "react";

interface ComingSoonProps {
  title: string;
  description: string;
  /** Gradiente de marca de la categoría (lib/categories.ts) — sin fotos
   * reales todavía, delimita visualmente el dominio de esta pestaña en
   * vez de dejar la página en blanco (reportado 2026-08-12). */
  gradient: string;
}

/** Placeholder de ruta para módulos todavía no construidos (Sprint 2+),
 * para que la navegación del header (T1.1) no lleve a un 404. Header y
 * footer ya los pone el layout raíz. */
export function ComingSoon({ title, description, gradient }: ComingSoonProps) {
  return (
    <main className="flex-1 bg-sand pt-32 pb-24">
      <div className="mx-auto max-w-(--container-max) px-6 md:px-10">
        <div
          role="img"
          aria-label={title}
          className="photo-placeholder relative aspect-[21/9] w-full rounded-md"
          style={{ "--scene-gradient": gradient } as CSSProperties}
        />

        <p className="tracked-caps mt-8 mb-3 text-xs font-semibold text-ink-soft">
          Próximamente
        </p>
        <h1 className="font-display max-w-2xl text-4xl md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-lg text-ink-soft">{description}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-coral px-6 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
