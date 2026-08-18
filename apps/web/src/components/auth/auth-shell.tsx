import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { AUTH_FONDO_LOGIN_GRADIENT } from "@/lib/auth-fondo";

interface AuthShellProps {
  /** Opcional (2026-08-17, pedido del cliente: sacar todo el texto de
   * "compañía" — "Bienvenido de nuevo"/"Turismo Marcuzzi" — que no sea el
   * título mismo, "hace muy IA"). Ninguna pantalla lo pasa hoy; queda
   * como prop por si algún día hace falta un rótulo puntual, no se
   * renderiza nada si no se pasa. */
  eyebrow?: string;
  title: string;
  /** Ídem eyebrow — opcional, sin usar hoy por el mismo pedido. */
  subtitle?: string;
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
      {/* Volver al home (2026-08-17, pedido del cliente): con el header
          global oculto en estas rutas (ver site-header.tsx), esto es lo
          único que permite salir de vuelta a "/". "Header invisible" a
          propósito — sin fondo/caja propia (ver site-header.tsx real, que
          SÍ tiene bg-ink/bg-transparent), acá el texto queda directo sobre
          la foto de fondo. position:fixed (no absolute) para que siga
          alcanzable aunque el formulario de registro sea largo y haya que
          scrollear. Compacto en mobile (menos padding, texto más chico) —
          pedido explícito del cliente porque ahí el espacio arriba es
          reducido. text-shadow en vez de un fondo propio, para que siga
          legible sobre cualquier foto sin dejar de ser "invisible". */}
      <Link
        href="/"
        className="fixed inset-x-0 top-0 z-20 px-4 py-3 font-display text-sm text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] sm:px-6 sm:py-4 sm:text-lg"
      >
        ALOJAMIENTOS MADRYN
      </Link>

      {/* Sin header/footer del sitio en estas rutas (2026-08-17, pedido del
          cliente: "solo la box de inicio de sesión o registro") — ver
          site-header.tsx/site-footer-visibility.tsx. Tarjeta más compacta
          (padding y márgenes reducidos, mismo pedido: "muy larga"). */}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(18,51,59,0.25)] sm:p-7">
        {eyebrow && (
          <p className="mb-1.5 text-center text-xs font-semibold tracking-wide text-ink-soft/80">{eyebrow}</p>
        )}
        <h1 className="text-center text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-center text-sm text-ink-soft">{subtitle}</p>}

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
 * el layout icono-adentro-del-input en cada form. labelClassName es
 * opcional (default authLabelClass, sin cambios para quien no lo pasa) —
 * RegisterForm lo usa para un espaciado label→input más ajustado (2026-08-17,
 * pedido puntual del cliente para ESE form, ver register-form.tsx). */
export function AuthField({
  id,
  label,
  icon,
  labelClassName = authLabelClass,
  ...inputProps
}: {
  id: string;
  label: string;
  icon: ReactNode;
  labelClassName?: string;
} & Omit<React.ComponentPropsWithoutRef<"input">, "id" | "className">) {
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
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
