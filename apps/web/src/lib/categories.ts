import type { Scene } from "@/lib/scenes";

/** Las cuatro categorías del negocio (spec §4.1) — copy tomado literal de la
 * spec, no reinventado acá. Servicio Turístico se agregó el 2026-08-11
 * (aclaración del cliente) como pestaña propia, separada de Experiencias:
 * excursiones más complejas y de mayor duración (spec §4.4). */
export interface Category {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  scene: Scene;
}

export const categories: Category[] = [
  {
    slug: "alojamiento",
    eyebrow: "Departamentos",
    title: "Alojamiento",
    description:
      "Encontrá el mejor lugar para tu familia en nuestra gama de departamentos.",
    href: "/alojamiento",
    scene: {
      clave: "home_categoria_alojamiento",
      place: "Alojamiento",
      caption: "Departamentos en Puerto Madryn",
      gradient: "linear-gradient(160deg, #12333b 0%, #1f7a8c 100%)",
    },
  },
  {
    slug: "experiencias",
    eyebrow: "Excursiones",
    title: "Experiencias",
    description: "Organizá tu cronograma con diferentes actividades.",
    href: "/experiencias",
    scene: {
      clave: "home_categoria_experiencias",
      place: "Experiencias",
      caption: "Ballenas, Península Valdés y más",
      gradient: "linear-gradient(160deg, #12333b 0%, #c99a5b 100%)",
    },
  },
  {
    slug: "servicio-turistico",
    eyebrow: "Excursiones a medida",
    title: "Servicio Turístico",
    description: "Excursiones a medida para descubrir Puerto Madryn a fondo.",
    href: "/servicio-turistico",
    scene: {
      clave: "home_categoria_servicio_turistico",
      place: "Servicio Turístico",
      caption: "Día completo en Península Valdés",
      gradient: "linear-gradient(160deg, #12333b 0%, #6f7d4a 100%)",
    },
  },
  {
    slug: "traslados",
    eyebrow: "Aeropuerto",
    title: "Traslado al aeropuerto",
    description: "No te preocupes por tu movilidad, nosotros te llevamos.",
    href: "/traslados",
    scene: {
      clave: "home_categoria_traslados",
      place: "Traslados",
      caption: "Te buscamos al bajar del avión",
      gradient: "linear-gradient(160deg, #12333b 0%, #e2725b 100%)",
    },
  },
];

/** Busca una categoría por slug — usado por las páginas "próximamente"
 * (Experiencias/Servicio Turístico/Traslados) para heredar el mismo
 * gradiente de marca que ya tienen en la home, en vez de duplicarlo. */
export function getCategory(slug: string): Category {
  const category = categories.find((c) => c.slug === slug);
  if (!category) throw new Error(`Categoría desconocida: ${slug}`);
  return category;
}
