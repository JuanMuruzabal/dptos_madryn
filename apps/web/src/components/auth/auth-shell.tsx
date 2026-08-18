import type { CSSProperties, ReactNode } from "react";
import { AUTH_FONDO_LOGIN_GRADIENT } from "@/lib/auth-fondo";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /** URL de la foto de fondo cargada desde el editor de página (T4.13,
   * AUTH_FONDO_LOGIN_CLAVE) — sin foto todavía, cae al gradiente de marca
   * (ver AUTH_FONDO_LOGIN_GRADIENT), nunca queda un fondo roto/vacío. */
  backgroundUrl?: string;
}

/**
 * Tarjeta blanca centrada sobre un fondo de foto desenfocada (2026-08-17,
 * pedido del cliente — rediseño de /ingresar y /registrarse, ver
 * docs/tradeoffs.md TR-048). Look deliberadamente distinto del resto del
 * sitio (sin tracked-caps, sin la paleta patagónica cálida) — un registro
 * más "app moderna" para el flujo de entrada/alta, no una reversión de
 * TR-012/TR-023 (esos siguen vigentes en el resto del sitio).
 *
 * El desenfoque queda en una capa aparte (::before, ver .auth-fondo-blur
 * en globals.css) para no desenfocar la tarjeta ni el contenido — mismo
 * truco de `isolation: isolate` que ya usa este código para contener el
 * z-index de Leaflet (ver app/alojamiento/[id]/page.tsx), acá para que el
 * z-index negativo del pseudo-elemento no se escape hacia atrás de toda
 * la página.
 */
export function AuthShell({ eyebrow, title, subtitle, children, footer, backgroundUrl }: AuthShellProps) {
  return (
    <main
      className="auth-fondo-blur relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
      style={
        {
          "--auth-bg-image": backgroundUrl ? `url(${JSON.stringify(backgroundUrl)})` : "none",
          "--auth-bg-fallback": AUTH_FONDO_LOGIN_GRADIENT,
        } as CSSProperties
      }
    >
      {/* Sin header/footer del sitio en estas rutas (2026-08-17, pedido del
          cliente: "solo la box de inicio de sesión o registro") — ver
          site-header.tsx/site-footer-visibility.tsx. Tarjeta más compacta
          (padding y márgenes reducidos, mismo pedido: "muy larga"). */}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(18,51,59,0.25)] sm:p-7">
        <p className="mb-1.5 text-center text-xs font-semibold tracking-wide text-ink-soft/80">{eyebrow}</p>
        <h1 className="text-center text-2xl font-extrabold text-ink">{title}</h1>
        <p className="mt-1.5 text-center text-sm text-ink-soft">{subtitle}</p>

        <div className="mt-5">{children}</div>

        <p className="mt-4 text-center text-sm text-ink-soft">{footer}</p>
      </div>
    </main>
  );
}

// --- Estilo de campo: ícono a la izquierda + línea inferior, sin caja
//     (2026-08-17, pedido del cliente) — reemplaza authInputClass (el
//     input con caja completa que usaba el resto del sitio) SOLO para
//     estas pantallas. AuthField de más abajo arma icono+input juntos;
//     estas 2 clases quedan exportadas por si algún form necesita el
//     input suelto (p. ej. la pantalla de código de confirmación).
export const authFieldWrapClass = "relative";
export const authFieldIconClass =
  "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-ink-soft/60";
export const authInputClass =
  "w-full border-0 border-b border-ink/15 bg-transparent py-2 pl-7 text-sm text-ink placeholder:text-ink-soft/60 focus:border-tide focus:outline-none";

export const authLabelClass = "mb-1 block text-sm font-medium text-ink";

/** Botón principal en el coral de marca (2026-08-17, pedido del cliente:
 * "un color más propio de la página" — reemplaza el gradiente turquesa/
 * magenta original, ver .auth-submit-button en globals.css y TR-048). */
export const authSubmitClass =
  "auth-submit-button w-full rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

/** Campo completo: label + ícono + input, en un solo lugar para no repetir
 * el layout icono-adentro-del-input en cada form. */
export function AuthField({
  id,
  label,
  icon,
  ...inputProps
}: {
  id: string;
  label: string;
  icon: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"input">, "id" | "className">) {
  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <div className={authFieldWrapClass}>
        <span className={authFieldIconClass} aria-hidden>
          {icon}
        </span>
        <input id={id} className={authInputClass} {...inputProps} />
      </div>
    </div>
  );
}
