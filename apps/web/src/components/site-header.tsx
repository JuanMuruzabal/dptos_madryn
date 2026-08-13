"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const NAV_LINKS = [
  { href: "/alojamiento", label: "Alojamiento" },
  { href: "/experiencias", label: "Experiencias" },
  { href: "/servicio-turistico", label: "Servicio Turístico" },
  { href: "/traslados", label: "Traslados" },
  { href: "#contacto", label: "Contacto" },
];

/**
 * Header sticky: transparente sobre el hero, pasa a fondo sólido al
 * scrollear (brief §1). Sin selector de idioma (TR-004: MVP solo en
 * español) ni ícono de búsqueda (no hay búsqueda global implementada
 * todavía — los filtros viven en el listado de alojamiento, Sprint 2).
 *
 * `accountSlot`/`bannerSlot`/`notificationsSlot` vienen ya armados (y
 * envueltos en Suspense) desde app/layout.tsx — ver
 * components/account-status.tsx sobre por qué el header en sí no lee la
 * sesión directamente. `bannerSlot` (T3.7, pending-reserva-banner.tsx) se
 * monta como una franja propia debajo de la barra de nav, dentro del
 * MISMO contenedor fixed: así queda todo el "sistema de header" en un
 * solo bloque que se mueve junto al scrollear, en vez de coordinar
 * elementos fixed con z-index por separado. `notificationsSlot` (T3.8,
 * notifications-bell.tsx) es el ícono 🔔 al lado de accountSlot — a
 * diferencia del banner (solo la reserva más urgente), ahí el usuario ve
 * TODAS sus reservas en curso.
 *
 * El modo transparente-sobre-foto es un motivo exclusivo de la home (el
 * único lugar con una imagen oscura detrás arriba del todo). Fuera de "/",
 * el header queda sólido siempre. El hero de la home ancla su contenido
 * abajo (`items-end`), así que si el banner tapa la franja de arriba de la
 * imagen de fondo no tapa nada funcional.
 *
 * Sólido = `bg-ink` (el mismo petróleo profundo que el texto del resto del
 * sitio, no una variante clara de `sand`): con `bg-sand/95` el header se
 * perdía contra el fondo `bg-sand` de cualquier página que no fuera la home
 * (reportado 2026-08-13, muy poco contraste). Con esto el texto queda
 * `text-sand` (claro) en los DOS estados —transparente sobre la foto del
 * hero y sólido sobre `bg-ink`—, así que ya no hace falta alternar el color
 * de texto según `solid`.
 */
export function SiteHeader({
  accountSlot,
  bannerSlot,
  notificationsSlot,
}: {
  accountSlot: ReactNode;
  bannerSlot: ReactNode;
  notificationsSlot: ReactNode;
}) {
  const pathname = usePathname();
  const hasHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!hasHero) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasHero]);

  // El menú mobile abierto siempre se ve sobre fondo sólido, así que
  // forzamos esa variante de color mientras está abierto.
  const solid = !hasHero || scrolled || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 text-sand transition-colors duration-300 ${
        solid ? "bg-ink shadow-[0_1px_0_rgba(0,0,0,0.15)] backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-(--container-max) items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="font-display text-lg"
          onClick={() => setMenuOpen(false)}
        >
          ALOJAMIENTOS MADRYN
        </Link>

        <nav className="tracked-caps hidden items-center gap-8 text-xs font-semibold md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {notificationsSlot}
          <div className="hidden md:block">{accountSlot}</div>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 md:hidden"
          >
            <span
              className={`h-px w-5 bg-current transition-transform duration-200 ${
                menuOpen ? "translate-y-[3.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-px w-5 bg-current transition-transform duration-200 ${
                menuOpen ? "-translate-y-[3.5px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {!menuOpen && bannerSlot}

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="tracked-caps flex flex-col items-start gap-1 border-t border-sand/15 px-6 py-8 text-sm font-semibold text-sand md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block w-full py-2.5"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">{accountSlot}</div>
        </nav>
      )}
    </header>
  );
}
