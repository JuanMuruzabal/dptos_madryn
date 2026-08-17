"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Calendar, LogOut, Settings, User } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

// Recuadro redondeado (2026-08-17, pedido del cliente: "en pc cambie el
// formato del panel de control por el mas reciente... lo mismo que los
// campos cuando uno toca el icono de usuario, quiero que el estilo sea
// similar al reciente aplicado en mobile") — mismos colores que AdminNav
// (admin-nav.tsx): activo = verde petróleo relleno + texto crema, inactivo
// = blanco con borde tenue + texto gris oscuro. Pensado para el fondo
// claro del dropdown (bg-sand), a diferencia de CuentaInline (fondo
// oscuro del drawer mobile) — mismo lenguaje visual (recuadro + ícono +
// ruta activa marcada), colores adaptados al contexto claro.
const DROPDOWN_ACTIVE = "bg-[#193b44] text-[#f5f1e8]";
const DROPDOWN_INACTIVE = "border border-[rgba(0,0,0,0.1)] bg-white text-[#3a5259] hover:bg-black/[0.03]";
const dropdownItemClass = (activo: boolean) =>
  `flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
    activo ? DROPDOWN_ACTIVE : DROPDOWN_INACTIVE
  }`;
// Cerrar sesión queda con su propio recuadro (mismo shape, no es una ruta
// así que nunca usa el fondo "activo") — mismo criterio que en
// CuentaInline: acción de bajo peso, aparte de la navegación.
const dropdownLogoutClass =
  "flex items-center gap-2.5 rounded-[12px] border border-[rgba(0,0,0,0.1)] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-coral-dark transition-colors hover:bg-black/[0.03]";

/** Rutas + íconos compartidos entre el dropdown de escritorio y el bloque
 * de cuenta del drawer mobile (CuentaInline) — mismas 2 rutas, mismos
 * íconos, cada uno con su propia clase de color adaptada a su fondo. */
const CUENTA_LINKS = [
  { href: "/perfil", label: "Mi perfil", Icon: User },
  { href: "/cronograma", label: "Mi cronograma", Icon: Calendar },
] as const;

/** Opciones del dropdown de escritorio (variant="dropdown"). El mobile
 * (variant="inline") tiene su propio componente, CuentaInline más abajo —
 * mismas rutas/íconos, colores distintos por el fondo oscuro del drawer. */
function Opciones({ esAdmin, onNavigate }: { esAdmin: boolean; onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {CUENTA_LINKS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={dropdownItemClass(pathname === href)}>
          <Icon size={16} strokeWidth={1.75} aria-hidden />
          {label}
        </Link>
      ))}
      {esAdmin && (
        <Link href="/admin" onClick={onNavigate} className={dropdownItemClass(pathname === "/admin")}>
          <Settings size={16} strokeWidth={1.75} aria-hidden />
          Panel admin
        </Link>
      )}
      <form action={logoutAction} className="w-full">
        <button type="submit" className={`w-full ${dropdownLogoutClass}`}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </>
  );
}

// Rediseño del bloque de cuenta para variant="inline" (2026-08-17). Colores
// puntuales de este pedido, no los tokens del sitio (--color-coral es
// #e2725b, --color-tide es #1f7a8c — distintos a propósito, el cliente dio
// hex concretos para este menú): coral e07a5f (barra activa + fondo al
// 16%).
const CUENTA_ACTIVE_BORDER = "border-[#e07a5f]";
const CUENTA_ACTIVE_BG = "bg-[rgba(224,122,95,0.16)]";
// Segunda ronda (2026-08-17): texto de Mi perfil/Mi cronograma/Panel admin
// en blanco suave (antes un celeste, #9db8bd al ojo del cliente) para que
// queden igual que los ítems del menú principal; el ícono se queda en su
// propio gris azulado en vez de heredar el color del texto (por eso va
// SEPARADO del texto acá, no basta con currentColor: los dos ya no
// comparten color).
const CUENTA_TEXT = "text-[#eef2f2]";
const CUENTA_ICON = "text-[#8fb0b7]";
// pl-[21px] (no pl-3): mismo esquema de sangría que los links de arriba en
// site-header.tsx (border-l-[3px] + pl-[21px] = 24px hasta el ícono/texto,
// igual que su pl-6 menos esos 3px) — así toda la lista del drawer queda
// alineada en una sola columna, sección de cuenta incluida.
const cuentaItemClass = (activo: boolean) =>
  `flex items-center gap-3 border-l-[3px] py-2.5 pr-6 pl-[21px] text-base ${CUENTA_TEXT} transition-colors ${
    activo ? `${CUENTA_ACTIVE_BORDER} ${CUENTA_ACTIVE_BG} font-semibold` : "border-transparent"
  }`;

/** Bloque de cuenta del drawer mobile: separado del resto con una línea
 * tenue (sin rótulo encima, sacado 2026-08-17 a pedido del cliente — "Mi
 * cuenta" quedó redundante), cada opción con ícono (lucide-react) y la
 * ruta activa marcada con una barra coral a la izquierda — Cerrar sesión
 * queda aparte, en su propio recuadro delineado (2026-08-17), no es una
 * ruta así que nunca se marca "activa". */
function CuentaInline({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <div className="mt-2 w-full border-t border-sand/15 pt-3">
      <div className="flex flex-col gap-1">
        {CUENTA_LINKS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={cuentaItemClass(pathname === href)}>
            <Icon size={18} strokeWidth={1.75} aria-hidden className={CUENTA_ICON} />
            {label}
          </Link>
        ))}
        {esAdmin && (
          <Link href="/admin" className={cuentaItemClass(pathname === "/admin")}>
            <Settings size={18} strokeWidth={1.75} aria-hidden className={CUENTA_ICON} />
            Panel admin
          </Link>
        )}
        {/* Recuadro delineado (2026-08-17, pedido del cliente) — borde de
            1px en vez del border-l-[3px] que usan las demás opciones (ese
            esquema era para la barra de "activo", acá no aplica: es una
            acción, no una ruta). mx-6 en el <form> para que el botón quede
            a la misma distancia del borde del drawer que el resto de la
            sección (24px, igual que el pl-[21px]+border-l-[3px] de arriba). */}
        <form action={logoutAction} className="mx-6 mt-2 w-auto">
          <button
            type="submit"
            className="flex items-center gap-3 rounded-[12px] border border-[rgba(224,122,95,0.45)] px-[14px] py-[13px] text-sm font-normal text-[#e8917a] transition-colors"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Ícono de cuenta con forma de persona (T3.9) — reemplaza el pill "Mi
 * perfil" + botón "Salir" sueltos en el header (account-status.tsx): un
 * solo punto de entrada, con "Mi perfil", "Mi cronograma" (placeholder,
 * ver app/cronograma/page.tsx) y "Cerrar sesión" agrupados en un dropdown.
 *
 * `variant="inline"` (2026-08-17, pedido del cliente): en el menú mobile
 * de site-header.tsx, en vez de un ícono chico + dropdown ("poco
 * intuitivo" en una pantalla táctil, y el dropdown posicionado con
 * `right-0` relativo a su botón asume un botón cerca del borde derecho),
 * las mismas opciones se listan PLANAS — sin toggle, sin problema de
 * posicionamiento posible porque no hay nada que posicionar. Rediseñada
 * de nuevo el mismo día (ver CuentaInline arriba): ícono por opción,
 * ruta activa marcada, separada del resto con una línea divisoria. El
 * header de escritorio sigue usando la variante "dropdown" (default) sin
 * cambios.
 */
export function AccountMenu({
  esAdmin = false,
  variant = "dropdown",
}: {
  esAdmin?: boolean;
  variant?: "dropdown" | "inline";
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "dropdown") return;
    function onClickAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickAfuera);
    return () => document.removeEventListener("mousedown", onClickAfuera);
  }, [variant]);

  if (variant === "inline") {
    return <CuentaInline esAdmin={esAdmin} />;
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Mi cuenta"
        aria-expanded={abierto}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-sand/10"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 flex w-56 flex-col gap-1.5 rounded-md border border-ink/10 bg-sand p-2 text-ink shadow-2xl">
          <Opciones esAdmin={esAdmin} onNavigate={() => setAbierto(false)} />
        </div>
      )}
    </div>
  );
}
