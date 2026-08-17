"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { CalendarCheck, Home, Image as ImageIcon, LayoutGrid, Star } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Resumen", Icon: LayoutGrid },
  { href: "/admin/reservas", label: "Reservas", Icon: CalendarCheck },
  { href: "/admin/alojamientos", label: "Alojamientos", Icon: Home },
  { href: "/admin/resenas", label: "Reseñas", Icon: Star },
  { href: "/admin/editor-pagina", label: "Editor de página", Icon: ImageIcon },
];

/**
 * Nav del panel admin (T4.8) — resalta la sección activa con un recuadro
 * relleno en vez de solo texto plano indistinguible entre sí.
 *
 * Un solo <nav> con clases responsive (2026-08-17, pedido del cliente: "en
 * pc cambie el formato del panel de control por el mas reciente... quiero
 * que el estilo sea similar al reciente aplicado en mobile") — antes había
 * 2 navs separados (uno por variante) porque la versión de escritorio
 * usaba una clase custom (tracked-caps) sin soporte confiable para
 * variantes responsive; ahora las dos versiones comparten el mismo
 * lenguaje visual (recuadro redondeado, ícono lucide-react, capitalización
 * de oración) y solo cambian tamaño/orientación por breakpoint, así que
 * alcanza con utilidades de Tailwind puras (sí soportan md:) en una sola
 * lista. Mobile: columna, cada sección ocupa todo el ancho (bug real
 * corregido antes: el label más largo, "Editor de página", se cortaba en
 * la grilla flex-wrap vieja). Escritorio: fila, cada botón mide lo que
 * necesita su contenido.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-10 flex flex-col gap-2 md:flex-row md:flex-wrap">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const activo = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex w-full items-center gap-3 rounded-[12px] px-4 py-[13px] text-base font-medium transition-colors md:w-auto md:px-4 md:py-2.5 md:text-sm ${
              activo
                ? "bg-[#193b44] text-[#f5f1e8]"
                : "border border-[rgba(0,0,0,0.1)] bg-white text-[#3a5259]"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
