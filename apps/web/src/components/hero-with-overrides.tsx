import { Hero } from "@/components/hero";
import { heroScenes, aplicarOverridesEscenas } from "@/lib/scenes";
import { fetchImagenesSitioMap } from "@/lib/api";

/**
 * Server Component (T4.13, "editor de página") que mezcla los overrides
 * de foto cargados desde el panel sobre las escenas del hero antes de
 * pasárselas a <Hero> (cliente, necesita el timer del crossfade y no
 * puede hacer este fetch solo). Separado de app/page.tsx y detrás de
 * <Suspense> con fallback = Hero con las escenas por defecto (TR-008):
 * así la home sigue sirviendo su hero de inmediato en el caso común (sin
 * overrides todavía) en vez de esperar a este fetch para mostrar nada.
 */
export async function HeroWithOverrides() {
  const overrides = await fetchImagenesSitioMap();
  return <Hero scenes={aplicarOverridesEscenas(heroScenes, overrides)} />;
}
