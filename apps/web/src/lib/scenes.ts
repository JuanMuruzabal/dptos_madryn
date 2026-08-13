/**
 * Escenas del hero de la home: cada una es un lugar real de la zona, no una
 * foto de stock genérica. El caption cambia en sincro con el crossfade —
 * es el elemento "firma" de la landing (ver docs/turismo-marcuzzi-diseno-frontend.md).
 *
 * `gradient` es un placeholder de marca hasta que haya fotografía real del
 * cliente (no hay ninguna task de sourcing de fotos en el plan todavía).
 * Cuando llegue, basta con sumar `image: "/hero/golfo-nuevo.jpg"` — el
 * componente <Scene> ya sabe renderizar next/image en ese caso.
 */
export interface Scene {
  /** Clave estable (T4.13, "editor de página") — id de la fila en
   * ImagenSitio para esta escena, solo en las escenas fijas del sitio
   * (hero/categorías). Las tarjetas de alojamiento arman su Scene al
   * vuelo a partir de una foto real ya cargada (alojamiento-card.tsx) y
   * no tienen clave — no son un slot editable desde el "editor de
   * página", son la foto real del alojamiento. No cambiar una vez en
   * uso: es la referencia que el admin tiene guardada al reemplazar la
   * foto. */
  clave?: string;
  place: string;
  caption: string;
  gradient: string;
  image?: string;
}

export const heroScenes: Scene[] = [
  {
    clave: "home_hero_golfo_nuevo",
    place: "Golfo Nuevo",
    caption: "Atardecer sobre el golfo",
    gradient: "linear-gradient(135deg, #e2725b 0%, #12333b 75%)",
  },
  {
    clave: "home_hero_peninsula_valdes",
    place: "Península Valdés",
    caption: "Temporada de ballenas — junio a diciembre",
    gradient: "linear-gradient(135deg, #1f7a8c 0%, #12333b 80%)",
  },
  {
    clave: "home_hero_punta_tombo",
    place: "Punta Tombo",
    caption: "Colonia de pingüinos magallánicos",
    gradient: "linear-gradient(135deg, #c99a5b 0%, #12333b 80%)",
  },
  {
    clave: "home_hero_ruta_costera",
    place: "Ruta costera",
    caption: "Camino a Puerto Madryn",
    gradient: "linear-gradient(135deg, #185f6b 0%, #12333b 75%)",
  },
];

/** Mezcla los overrides cargados desde el "editor de página" (T4.13,
 * ImagenSitio) sobre las escenas por defecto — sin override para una
 * clave, esa escena sigue sin `image` y <Scene> cae a su gradiente. */
export function aplicarOverridesEscenas(
  scenes: Scene[],
  overrides: Map<string, string>,
): Scene[] {
  return scenes.map((s) => (s.clave && overrides.has(s.clave) ? { ...s, image: overrides.get(s.clave) } : s));
}
