"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

const itemClass =
  "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-ink/5";

/**
 * Ícono de cuenta con forma de persona (T3.9) — reemplaza el pill "Mi
 * perfil" + botón "Salir" sueltos en el header (account-status.tsx): un
 * solo punto de entrada, con "Mi perfil", "Mi cronograma" (placeholder,
 * ver app/cronograma/page.tsx — pensado para cuando existan reservas de
 * experiencias/servicio turístico que armar en un itinerario) y "Cerrar
 * sesión" agrupados en un dropdown. Mismo patrón de click-afuera que
 * notifications-bell-client.tsx.
 */
export function AccountMenu({ esAdmin = false }: { esAdmin?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickAfuera);
    return () => document.removeEventListener("mousedown", onClickAfuera);
  }, []);

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
          <Link href="/perfil" onClick={() => setAbierto(false)} className={itemClass}>
            Mi perfil
          </Link>
          <Link href="/cronograma" onClick={() => setAbierto(false)} className={itemClass}>
            Mi cronograma
          </Link>
          {esAdmin && (
            <Link href="/admin" onClick={() => setAbierto(false)} className={itemClass}>
              Panel admin
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className={`${itemClass} text-coral-dark`}>
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
