import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  /** Ancho máximo de la tarjeta, default "max-w-sm" (2026-08-18, pedido
   * del cliente: "en la página de escritorio puede ensanchar el
   * register... pero solo en la página de escritorio") — RegistrarsePage
   * pasa una versión más ancha desde lg: para que sus 7 campos puedan
   * mostrarse en 2 columnas sin quedar tan vertical; /ingresar y
   * /registrarse/confirmar no la pasan y quedan como estaban. */
  maxWidthClassName?: string;
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
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  backgroundUrl,
  maxWidthClassName = "max-w-sm",
}: AuthShellProps) {
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
      <div className={`relative w-full ${maxWidthClassName} rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(18,51,59,0.25)] sm:p-7`}>
        {/* Volver al home (2026-08-18, pedido del cliente: reemplaza el
            título "ALOJAMIENTOS MADRYN" superpuesto en la esquina, que ya
            no va) — adentro de la tarjeta, arriba de todo, por encima del
            título. Colores puntuales de este pedido (#e4f1f4/#1c6675), no
            tokens del sistema de diseño (mismo criterio que
            .auth-submit-button/.bg-tapiz) — son los ÚNICOS colores nuevos
            de esta ronda, todo lo demás del form reusa lo existente. */}
        <Link
          href="/"
          aria-label="Volver al inicio"
          className="mb-4 inline-flex items-center gap-1.5 rounded-[22px] bg-[#e4f1f4] px-[15px] py-2 text-sm font-medium text-[#1c6675] transition-colors hover:bg-[#cfe4e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c6675]"
        >
          <ArrowLeft size={16} aria-hidden />
          Volver al inicio
        </Link>

        {eyebrow && (
          <p className="mb-1.5 text-center text-xs font-semibold tracking-wide text-ink-soft/80">{eyebrow}</p>
        )}
        {/* text-xl en mobile, text-2xl desde sm: (2026-08-18, pedido del
            cliente: compactar el registro en mobile sin tocar desktop) —
            comparte AuthShell con /ingresar y /registrarse/confirmar, así
            que el mismo ajuste aplica a las 3 pantallas por consistencia
            (todas tienen el mismo problema de tamaño en mobile). */}
        <h1 className="text-center text-xl font-extrabold text-ink sm:text-2xl">{title}</h1>
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
// Mismo estilo, sin el pl-7 reservado para el ícono (2026-08-18, pedido
// del cliente: sacar los íconos de los campos de login/registro) — los
// campos sin ícono (AuthField sin la prop `icon`) usan esta variante.
export const authInputClassNoIcon =
  "w-full border-0 border-b border-ink/15 bg-transparent py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-tide focus:outline-none";

export const authLabelClass = "mb-1 block text-sm font-medium text-ink";

/** Botón principal en el coral de marca (2026-08-17, pedido del cliente:
 * "un color más propio de la página" — reemplaza el gradiente turquesa/
 * magenta original, ver .auth-submit-button en globals.css y TR-048). */
export const authSubmitClass =
  "auth-submit-button w-full rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

/** Campo completo: label + ícono opcional + input, en un solo lugar para
 * no repetir el layout icono-adentro-del-input en cada form.
 * labelClassName es opcional (default authLabelClass, sin cambios para
 * quien no lo pasa) — RegisterForm lo usa para un espaciado label→input
 * más ajustado (2026-08-17, pedido puntual del cliente para ESE form, ver
 * register-form.tsx). icon es opcional (2026-08-18, pedido del cliente:
 * sacar los íconos/símbolos de los campos de login y registro) — sin
 * ícono, el input usa authInputClassNoIcon (mismo estilo, sin el
 * padding-left que reservaba el lugar del ícono); ConfirmCodeForm sigue
 * pasando ícono y no cambia. */
export function AuthField({
  id,
  label,
  icon,
  labelClassName = authLabelClass,
  ...inputProps
}: {
  id: string;
  label: string;
  icon?: ReactNode;
  labelClassName?: string;
} & Omit<React.ComponentPropsWithoutRef<"input">, "id" | "className">) {
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className={authFieldWrapClass}>
        {icon && (
          <span className={authFieldIconClass} aria-hidden>
            {icon}
          </span>
        )}
        <input id={id} className={icon ? authInputClass : authInputClassNoIcon} {...inputProps} />
      </div>
    </div>
  );
}
