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
 * `variant` (2026-08-17, pedido del cliente): `app/layout.tsx` monta DOS
 * instancias de este componente — una para el pill de escritorio
 * (`variant="dropdown"`, default) y otra para el panel mobile
 * (`variant="inline"`, ver site-header.tsx) — en vez de una sola
 * reutilizada en dos posiciones del árbol como antes. Hacía falta poder
 * pasarle una variante distinta a <AccountMenu> según el contexto (ícono +
 * dropdown en escritorio, opciones planas en mobile — "poco intuitivo"
 * como ícono chico en una pantalla táctil), algo que un único nodo
 * reutilizado no permite.
 *
 * Logueado: el pill "Mi perfil" + botón "Salir" sueltos del escritorio se
 * reemplazaron por un solo ícono con forma de persona (AccountMenu, T3.9)
 * que agrupa perfil/cronograma/cerrar sesión en un dropdown — ya no hay
 * una opción de salir suelta en el header. En mobile, ver AccountMenu
 * variant="inline".
 */
export async function AccountStatus({
  variant = "dropdown",
}: {
  variant?: "dropdown" | "inline";
} = {}) {
  const session = await getSession();

  if (!session) {
    return variant === "inline" ? (
      // Centrado + mismo pill que escritorio (2026-08-17, pedido del
      // cliente: "arregla el boton de Ingresar ya que no queda centrado
      // con las demas opciones y que tenga el mismo estilo que tiene en
      // la pagina web de PC") — antes era un link de texto plano alineado
      // a la izquierda como el resto de la lista, pero un pill no lee
      // bien ahí (no es una opción más de la lista, es la única acción
      // posible sin sesión), por eso centrado en vez de seguir el mismo
      // esquema de sangría de las demás.
      <div className="flex justify-center px-6 py-2">
        <Link href="/ingresar" className={pillClass}>
          Ingresar
        </Link>
      </div>
    ) : (
      <Link href="/ingresar" className={pillClass}>
        Ingresar
      </Link>
    );
  }

  return <AccountMenu esAdmin={session.rol === "administrador"} variant={variant} />;
}

export function AccountStatusFallback() {
  return (
    <span
      aria-hidden
      className="inline-block h-8 w-24 animate-pulse rounded-full bg-coral/30"
    />
  );
}
