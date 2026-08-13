import Link from "next/link";
import { getSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";

const pillClass =
  "tracked-caps rounded-full bg-coral px-5 py-2 text-xs font-semibold text-sand transition-colors hover:bg-coral-dark";

/**
 * Único fragmento del header que lee cookies() (T1.2). Server Component
 * async a propósito, para quedar detrás de un <Suspense> (ver
 * src/app/layout.tsx) y no volver dinámica toda la app — ver
 * next.config.ts (`cacheComponents`).
 *
 * Se renderiza tal cual en el pill de desktop y dentro del panel mobile
 * (site-header.tsx) — mismo componente, dos posiciones en el árbol; no
 * necesita saber de "solid"/scroll, por eso usa el acento coral fijo en
 * vez de invertir color según fondo transparente/sólido.
 *
 * Logueado: el pill "Mi perfil" + botón "Salir" sueltos se reemplazaron
 * por un solo ícono con forma de persona (AccountMenu, T3.9) que agrupa
 * perfil/cronograma/cerrar sesión en un dropdown — ya no hay una opción
 * de salir suelta en el header.
 */
export async function AccountStatus() {
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/ingresar" className={pillClass}>
        Ingresar
      </Link>
    );
  }

  return <AccountMenu esAdmin={session.rol === "administrador"} />;
}

export function AccountStatusFallback() {
  return (
    <span
      aria-hidden
      className="inline-block h-8 w-24 animate-pulse rounded-full bg-coral/30"
    />
  );
}
