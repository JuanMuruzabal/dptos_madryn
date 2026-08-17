"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarCheck, Home, Image as ImageIcon, LayoutGrid, Star } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  /** Acento de color por categoría (T4.8, pulido de usabilidad) — mismo
   * propósito que los colores de estado del resto del sitio (dune=pendiente,
   * steppe=confirmado): acá no marcan un estado, marcan de un vistazo en
   * qué sección del panel estás parado. Solo lo usa la variante de
   * escritorio (subrayado) — la lista mobile (2026-08-17) marca la sección
   * activa con un color fijo, no por categoría. */
  accent: string;
  /** SVG a mano — variante de escritorio, sin cambios. */
  icon: ReactNode;
  /** lucide-react — variante mobile (2026-08-17, pedido del cliente: "usa
   * lucide o react-icons"), íconos distintos de los de escritorio a
   * propósito, no se reutilizan los SVG de arriba. */
  mobileIcon: ReactNode;
}

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const MOBILE_ICON_PROPS = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Resumen",
    accent: "text-ink",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4" y="4" width="7" height="7" rx="1.2" />
        <rect x="13" y="4" width="7" height="7" rx="1.2" />
        <rect x="4" y="13" width="7" height="7" rx="1.2" />
        <rect x="13" y="13" width="7" height="7" rx="1.2" />
      </svg>
    ),
    mobileIcon: <LayoutGrid {...MOBILE_ICON_PROPS} />,
  },
  {
    href: "/admin/reservas",
    label: "Reservas",
    accent: "text-coral-dark",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 9.5h16" />
        <path d="M9 13.5l1.8 1.8L15 11.5" />
      </svg>
    ),
    mobileIcon: <CalendarCheck {...MOBILE_ICON_PROPS} />,
  },
  {
    href: "/admin/alojamientos",
    label: "Alojamientos",
    accent: "text-tide",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 9.5V20h5v-6h2v6h5V9.5" />
      </svg>
    ),
    mobileIcon: <Home {...MOBILE_ICON_PROPS} />,
  },
  {
    href: "/admin/resenas",
    label: "Reseñas",
    accent: "text-[#8a6a2e]",
    icon: (
      <svg {...ICON_PROPS} fill="currentColor" stroke="none">
        <path d="M12 3.5l2.6 5.4 5.9.6-4.4 4 1.3 5.9L12 16.5l-5.4 2.9 1.3-5.9-4.4-4 5.9-.6z" />
      </svg>
    ),
    mobileIcon: <Star {...MOBILE_ICON_PROPS} />,
  },
  {
    href: "/admin/editor-pagina",
    label: "Editor de página",
    accent: "text-steppe",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4" y="4.5" width="16" height="15" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M4 16.5l4.5-4.5 3 3 3.5-3.5L20 15" />
      </svg>
    ),
    mobileIcon: <ImageIcon {...MOBILE_ICON_PROPS} />,
  },
];

/** Nav del panel admin (T4.8) — resalta la sección activa con color +
 * subrayado, en vez de solo texto plano indistinguible entre sí.
 *
 * Dos <nav> separados en vez de una sola lista con clases responsive
 * (2026-08-17, pedido del cliente) — mismo criterio que NAV_LINKS en
 * site-header.tsx: la barra de escritorio (subrayado, tracked-caps) y la
 * lista mobile (filas rellenas, sin tracked-caps) son visualmente
 * distintas de punta a punta, no una variación de la misma clase con
 * breakpoints. Antes era una sola grilla flex-wrap que en mobile quedaba
 * repartida en 2 columnas parejas — bug real reportado: "Editor de
 * página" (el label más largo) no entraba y se cortaba. */
export function AdminNav() {
  const pathname = usePathname();

  function esActivo(item: NavItem) {
    return item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
  }

  return (
    <>
      <nav className="mb-10 hidden flex-wrap gap-x-2 gap-y-2 border-b border-ink/10 pb-px md:flex">
        {NAV_ITEMS.map((item) => {
          const activo = esActivo(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tracked-caps -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                activo
                  ? `${item.accent} border-current`
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile (2026-08-17): lista vertical de una sola columna, cada
          sección ocupa todo el ancho — nada se corta. Sin tracked-caps
          (capitalización de oración, el label de origen ya está así) y
          sin color por categoría: la sección activa se marca con un fondo
          fijo (verde petróleo/crema), no por accent. */}
      <nav className="mb-10 flex flex-col gap-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const activo = esActivo(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-[12px] px-4 py-[13px] text-base font-medium transition-colors ${
                activo
                  ? "bg-[#193b44] text-[#f5f1e8]"
                  : "border border-[rgba(0,0,0,0.1)] bg-white text-[#3a5259]"
              }`}
            >
              {item.mobileIcon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
