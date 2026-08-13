import { FeaturedCategories } from "@/components/featured-categories";
import { categories } from "@/lib/categories";
import { fetchImagenesSitioMap } from "@/lib/api";

/**
 * Mismo patrón que hero-with-overrides.tsx (T4.13): mezcla los overrides
 * de foto de las tarjetas de categoría (ImagenSitio) antes de renderizar
 * — detrás de <Suspense> en app/page.tsx, con <FeaturedCategories />
 * (categorías por defecto, sin overrides) como fallback.
 */
export async function FeaturedCategoriesWithOverrides() {
  const overrides = await fetchImagenesSitioMap();
  const categoriasConFoto = categories.map((c) =>
    c.scene.clave && overrides.has(c.scene.clave)
      ? { ...c, scene: { ...c.scene, image: overrides.get(c.scene.clave) } }
      : c,
  );
  return <FeaturedCategories categories={categoriasConFoto} />;
}
