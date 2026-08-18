"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bed, Car, Compass, Mail, Map } from "lucide-react";
import { isAuthChromeHidden } from "@/lib/auth-routes";

const NAV_LINKS = [
  { href: "/alojamiento", label: "Alojamiento", mobileLabel: "Alojamiento", Icon: Bed },
  { href: "/experiencias", label: "Experiencias", mobileLabel: "Experiencias", Icon: Compass },
  {
    href: "/servicio-turistico",
    label: "Servicio Turístico",
    // mobileLabel en capitalización de oración (2026-08-17, pedido del
    // cliente) — distinto de `label` (desktop, tracked-caps ya lo pasa a
    // mayúsculas visualmente, así que ahí el casing de origen no importa).
    mobileLabel: "Servicio turístico",
    Icon: Map,
  },
  { href: "/traslados", label: "Traslados", mobileLabel: "Traslados", Icon: Car },
  { href: "#contacto", label: "Contacto", mobileLabel: "Contacto", Icon: Mail },
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
  accountSlotMobile,
  bannerSlot,
  notificationsSlot,
}: {
  accountSlot: ReactNode;
  /** Variante "inline" de AccountStatus (2026-08-17, pedido del cliente)
   * — opciones planas en el menú mobile en vez de repetir el mismo
   * ícono+dropdown pensado para el header de escritorio. Ver
   * account-menu.tsx. */
  accountSlotMobile: ReactNode;
  bannerSlot: ReactNode;
  notificationsSlot: ReactNode;
}) {
  const pathname = usePathname();
  const hasHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!hasHero) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasHero]);

  // Patrón "adjusting state when a prop changes" que React mismo documenta
  // (https://react.dev/learn/you-might-not-need-an-effect) — reemplaza a un
  // useEffect que hacía setMenuOpen(false) al cambiar de ruta (bug real
  // 2026-08-17: el link "Ingresar", parte de accountSlot armado en
  // account-status.tsx — SiteHeader no controla ese JSX para agregarle un
  // onClick puntual, no cerraba el menú mobile antes de redirigir). Un
  // setState síncrono en un efecto viola react-hooks/set-state-in-effect
  // (mismo motivo ya documentado en modal.tsx); guardar la ruta en un ref y
  // leerlo durante el render viola react-hooks/refs. Comparar contra un
  // estado propio y llamar setState DIRECTO en el cuerpo del render (no en
  // un efecto) es el patrón que React sí avala para esto.
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  // Bug real (2026-08-17, reportado en mobile): cada página compensa este
  // header `fixed` reservando un padding-top FIJO (--header-height, ver
  // globals.css) — pero el header no siempre mide lo mismo: bannerSlot
  // (reserva pendiente/confirmada/esperando confirmación) tiene texto
  // largo que envuelve a más líneas en una pantalla angosta, así que el
  // header real termina más alto que el valor fijo asumido y el contenido
  // de la página arranca tapado detrás. ResizeObserver mide la altura
  // REAL del header (se recalcula solo cuando el banner aparece/desaparece
  // o el texto envuelve distinto) y la publica como variable CSS — ninguna
  // página tiene que adivinar un número.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setHeightVar = () => {
      // +20px de margen visual (bug real 2026-08-17): medir la altura EXACTA
      // dejaba el contenido de cada página empezando justo pegado al borde
      // del header, sin aire — antes el pt-32 fijo, más generoso que el
      // header real sin banners, disimulaba esto por accidente.
      document.documentElement.style.setProperty("--header-height", `${el.offsetHeight + 20}px`);
    };
    setHeightVar();
    const observer = new ResizeObserver(setHeightVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // /ingresar y /registrarse (2026-08-17, pedido del cliente): solo debe
  // verse la caja de login/registro, sin el header del sitio alrededor.
  // Se chequea DESPUÉS de todos los hooks de arriba (nunca antes de un
  // hook — violaría las Rules of Hooks) — los efectos ya declarados
  // manejan bien el caso headerRef.current === null cuando esto no
  // renderiza ningún <header>.
  if (isAuthChromeHidden(pathname)) {
    return null;
  }

  // El menú mobile abierto siempre se ve sobre fondo sólido, así que
  // forzamos esa variante de color mientras está abierto.
  const solid = !hasHero || scrolled || menuOpen;

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-50 text-sand transition-colors duration-300 ${
        solid ? "bg-ink shadow-[0_1px_0_rgba(0,0,0,0.15)] backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-(--container-max) items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="font-display text-lg"
          onClick={closeMenu}
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
            onClick={toggleMenu}
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
          className="flex flex-col gap-1 border-t border-sand/15 py-6 text-sm text-sand md:hidden"
        >
          {/* Sin tracked-caps acá (2026-08-17, pedido del cliente: "se ve
              muy IA") — capitalización de oración (mobileLabel) + ícono
              por opción (lucide-react) en vez de mayúsculas trackeadas en
              mono. El nav de escritorio de arriba no se toca, sigue con
              tracked-caps + link.label (TR-012/TR-023 siguen vigentes ahí).
              border-l-[3px] siempre reservado (transparente si no está
              activo) para que el ícono/texto no salte de lugar al navegar;
              pl-[21px] = px-6 (24px) menos esos 3px, así el contenido
              queda alineado igual que antes de agregar el borde. */}
          {NAV_LINKS.map((link) => {
            const activo = pathname === link.href;
            const Icon = link.Icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`flex items-center gap-3 border-l-[3px] py-2.5 pr-6 pl-[21px] transition-colors ${
                  activo
                    ? "border-[#e07a5f] bg-[rgba(224,122,95,0.16)] font-semibold"
                    : "border-transparent"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                {link.mobileLabel}
              </Link>
            );
          })}
          {/* accountSlotMobile (2026-08-17): Mi perfil/Mi cronograma/Panel
              admin/Cerrar sesión — CuentaInline (account-menu.tsx) arma su
              propio separador + rótulo "Mi cuenta" y usa el mismo esquema
              de sangría (border-l-[3px] + pl-[21px]) que los links de
              arriba, así que este wrapper va SIN padding propio — si le
              agregara px-6 acá, los íconos de esta sección quedarían más
              adentro que los de Alojamiento/Experiencias/etc. */}
          <div className="w-full">{accountSlotMobile}</div>
        </nav>
      )}
    </header>
  );
}
