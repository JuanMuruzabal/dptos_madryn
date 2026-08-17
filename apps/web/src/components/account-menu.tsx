"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

/**
 * Mismas opciones para las dos variantes de abajo (dropdown/inline) — un
 * solo lugar para no desincronizarlas si se agrega/saca una opción.
 * `itemClass` la pasa cada variante: el dropdown vive sobre fondo claro
 * (`bg-sand`), la lista plana vive sobre el fondo oscuro del menú mobile
 * (`bg-ink`) — mismo layout, texto/hover distintos por contexto.
 */
function Opciones({
  esAdmin,
  itemClass,
  logoutClass,
  onNavigate,
}: {
  esAdmin: boolean;
  itemClass: string;
  logoutClass: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link href="/perfil" onClick={onNavigate} className={itemClass}>
        Mi perfil
      </Link>
      <Link href="/cronograma" onClick={onNavigate} className={itemClass}>
        Mi cronograma
      </Link>
      {esAdmin && (
        <Link href="/admin" onClick={onNavigate} className={itemClass}>
          Panel admin
        </Link>
      )}
      <form action={logoutAction} className="w-full">
        <button type="submit" className={logoutClass}>
          Cerrar sesión
        </button>
      </form>
    </>
  );
}

const dropdownItemClass =
  "block w-full rounded-md px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-ink/5";
const dropdownLogoutClass = `${dropdownItemClass} text-coral-dark`;
const inlineItemClass = "block w-full py-2.5 text-left";
const inlineLogoutClass = `${inlineItemClass} text-coral`;

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
 * las mismas opciones se listan PLANAS, con el mismo estilo que el resto
 * de los links de navegación del menú — sin ícono, sin toggle, sin
 * problema de posicionamiento posible porque no hay nada que posicionar.
 * El header de escritorio sigue usando la variante "dropdown" (default)
 * sin cambios.
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
    return (
      <div className="tracked-caps flex w-full flex-col items-start gap-2.5 text-sm font-semibold text-sand">
        <Opciones esAdmin={esAdmin} itemClass={inlineItemClass} logoutClass={inlineLogoutClass} />
      </div>
    );
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
        <div className="absolute right-0 top-full mt-2 w-52 rounded-md border border-ink/10 bg-sand p-1.5 text-ink shadow-2xl">
          <Opciones
            esAdmin={esAdmin}
            itemClass={dropdownItemClass}
            logoutClass={dropdownLogoutClass}
            onNavigate={() => setAbierto(false)}
          />
        </div>
      )}
    </div>
  );
}
