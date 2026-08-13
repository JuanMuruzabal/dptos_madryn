"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  /** Acento de color por categoría (T4.8, pulido de usabilidad) — mismo
   * propósito que los colores de estado del resto del sitio (dune=pendiente,
   * steppe=confirmado): acá no marcan un estado, marcan de un vistazo en
   * qué sección del panel estás parado. */
  accent: string;
  icon: ReactNode;
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
  },
];

/** Nav del panel admin (T4.8) — resalta la sección activa con color +
 * subrayado, en vez de solo texto plano indistinguible entre sí. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-10 flex flex-wrap gap-x-2 gap-y-2 border-b border-ink/10 pb-px">
      {NAV_ITEMS.map((item) => {
        const activo = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
  );
}
