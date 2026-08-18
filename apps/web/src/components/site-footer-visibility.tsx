"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isAuthChromeHidden } from "@/lib/auth-routes";

/**
 * SiteFooter (site-footer.tsx) es un Server Component async — no puede
 * leer usePathname directo para ocultarse solo. Este wrapper recibe el
 * footer YA renderizado (como children) y decide mostrarlo u ocultarlo
 * según la ruta actual, mismo criterio que site-header.tsx usa para
 * ocultarse a sí mismo en /ingresar y /registrarse (2026-08-17, pedido
 * del cliente).
 */
export function SiteFooterVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isAuthChromeHidden(pathname)) return null;
  return <>{children}</>;
}
