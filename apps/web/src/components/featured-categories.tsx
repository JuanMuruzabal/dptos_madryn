import Link from "next/link";
import { Scene } from "@/components/scene";
import { categories as defaultCategories, type Category } from "@/lib/categories";
import { ScrollReveal } from "@/components/scroll-reveal";

/**
 * Reemplaza el bloque "FEATURED" de Bungie (brief §3). Grilla asimétrica
 * intencional, no decorativa: Alojamiento va como banda ancha (horizontal)
 * arriba porque es el único módulo reservable en el MVP (spec §9 Fase 1) —
 * Experiencias, Servicio Turístico y Traslados llegan en Fase 2 y hoy solo
 * se pueden ver, no reservar; van en una fila pareja debajo. (Corregido
 * 2026-08-11: la primera versión con 4 categorías probó la tarjeta de
 * Alojamiento vertical/muy alta — se ve rara, se cambió a horizontal.)
 *
 * `categories` es un prop opcional (T4.13, "editor de página") — por
 * defecto usa el catálogo estático de lib/categories.ts; el fallback de
 * Suspense en app/page.tsx la usa así (sin overrides). El wrapper con
 * overrides es featured-categories-with-overrides.tsx.
 */
export function FeaturedCategories({ categories = defaultCategories }: { categories?: Category[] }) {
  const [alojamiento, experiencias, servicioTuristico, traslados] = categories;

  return (
    <section id="categorias" className="mx-auto max-w-(--container-max) px-6 py-24 md:px-10 md:py-32">
      <ScrollReveal>
        <p className="tracked-caps mb-3 text-xs font-semibold text-ink-soft">
          Nuestros servicios
        </p>
        <h2 className="font-display max-w-xl text-3xl md:text-4xl">
          Todo lo que necesitás, en un solo lugar
        </h2>
      </ScrollReveal>

      <div className="mt-12 flex flex-col gap-4 md:gap-5">
        <ScrollReveal delay={0.05}>
          <CategoryCard category={alojamiento} wide />
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
          <ScrollReveal delay={0.12}>
            <CategoryCard category={experiencias} />
          </ScrollReveal>
          <ScrollReveal delay={0.19}>
            <CategoryCard category={servicioTuristico} />
          </ScrollReveal>
          <ScrollReveal delay={0.26}>
            <CategoryCard category={traslados} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function CategoryCard({
  category,
  wide = false,
}: {
  category: Category;
  wide?: boolean;
}) {
  return (
    <Link
      href={category.href}
      className={`group relative block overflow-hidden rounded-md ${
        wide ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/3]"
      }`}
    >
      <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]">
        <Scene
          scene={category.scene}
          alt={category.title}
          sizes={wide ? "100vw" : "(min-width: 640px) 33vw, 100vw"}
        />
      </div>
      <div
        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: "var(--overlay-photo)" }}
      />
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
        <p className="tracked-caps mb-2 text-[0.65rem] font-semibold text-sand/75">
          {category.eyebrow}
        </p>
        <h3 className="font-display text-2xl text-sand md:text-3xl">
          {category.title}
        </h3>
        <p className="mt-2 max-w-xs text-sm text-sand/85">{category.description}</p>
      </div>
    </Link>
  );
}
