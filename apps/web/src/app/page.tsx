import { Suspense } from "react";
import { Hero } from "@/components/hero";
import { HeroWithOverrides } from "@/components/hero-with-overrides";
import { FeaturedCategories } from "@/components/featured-categories";
import { FeaturedCategoriesWithOverrides } from "@/components/featured-categories-with-overrides";
import { heroScenes } from "@/lib/scenes";

// T4.13 ("editor de página"): Hero y FeaturedCategories leen sus fotos
// por defecto de lib/scenes.ts/categories.ts de forma síncrona (shell
// estático, TR-008) — los overrides cargados desde /admin/editor-pagina
// se mezclan en un wrapper aparte, detrás de Suspense, con el componente
// "de siempre" (sin overrides) como fallback: la home sigue sirviendo su
// hero/categorías de inmediato en el caso común (sin fotos cargadas
// todavía) en vez de esperar este fetch para mostrar algo.
export default function Home() {
  return (
    <main className="flex-1">
      <Suspense fallback={<Hero scenes={heroScenes} />}>
        <HeroWithOverrides />
      </Suspense>
      <Suspense fallback={<FeaturedCategories />}>
        <FeaturedCategoriesWithOverrides />
      </Suspense>
    </main>
  );
}
