"use client";

import { useActionState, useState, type FormEvent } from "react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { AuthField, authInputClassNoIcon, authSubmitClass } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const initialState: AuthFormState = {};

// Espaciado más ajustado label→input, y label más chico en mobile
// (2026-08-17/18, pedido puntual del cliente: "la etiqueta debe quedar
// más pegada a su propio input"/"reducí el tamaño... de los labels...
// cuando la pantalla es chica") — SOLO en este form, ver AuthField/
// authLabelClass en auth-shell.tsx, que no cambian para LoginForm/
// ConfirmCodeForm. text-sm (el tamaño de siempre) recién desde sm:, así
// desktop queda idéntico a como estaba.
const compactLabelClass = "mb-0.5 block text-xs font-medium text-ink sm:text-sm";

// Prefijos de país para el teléfono (2026-08-18, pedido del cliente) —
// +54 Argentina primero y seleccionado por default (el grueso de los
// huéspedes), el resto en el orden que pidió más un par de vecinos
// típicos de un sitio de turismo en Patagonia.
const CODIGOS_PAIS = [
  { code: "+54", pais: "Argentina" },
  { code: "+1", pais: "EE.UU./Canadá" },
  { code: "+55", pais: "Brasil" },
  { code: "+34", pais: "España" },
  { code: "+56", pais: "Chile" },
  { code: "+598", pais: "Uruguay" },
  { code: "+595", pais: "Paraguay" },
  { code: "+51", pais: "Perú" },
  { code: "+57", pais: "Colombia" },
  { code: "+52", pais: "México" },
];

// Mismo criterio visual que authInputClass (línea inferior, sin caja) —
// sin el padding-left de authInputClass porque este <select> no lleva
// ícono adentro.
const phoneCodeSelectClass =
  "w-[6.75rem] shrink-0 border-0 border-b border-ink/15 bg-transparent py-2 text-sm text-ink focus:border-tide focus:outline-none";

// Solo dígitos, longitud razonable (2026-08-18, pedido del cliente) — el
// mismo rango sirve para cualquier país de CODIGOS_PAIS (de 6 dígitos en
// números cortos hasta 14, margen de sobra para números largos reales).
const TELEFONO_REGEX = /^\d{6,14}$/;

// Site key pública de Turnstile (TR-047) — el fallback es la site key de
// PRUEBA pública de Cloudflare (siempre aprueba), así el registro funciona
// en desarrollo local sin cuenta de Cloudflare real. NEXT_PUBLIC_ (no un
// secreto: el widget del navegador la necesita ahí a la fuerza).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

/**
 * Rediseño 2026-08-17/18 (TR-048): Nombre+Apellido/Email/Confirmar email/
 * Teléfono/Contraseña/Confirmar contraseña + CAPTCHA. Nombre/Apellido
 * viajan SEPARADOS en el form (mejor UX, dos inputs cortos en vez de uno
 * largo) pero el backend Go sigue teniendo un solo campo `nombre` — se
 * combinan recién en registerAction (Server Action), no hay columna
 * `apellido` nueva en el modelo de datos. Mismo criterio para el
 * teléfono: acá son dos inputs (código de país + número), registerAction
 * los une en un solo string en formato internacional antes de mandarlo.
 * "Confirmar email"/"Confirmar contraseña" son SOLO validación de UI
 * (evitar un typo antes de mandar el form) — no viajan al backend; si no
 * coinciden entre sí, el propio registerAction los vuelve a chequear como
 * defensa en profundidad, no solo acá.
 *
 * Sin íconos en los campos (2026-08-18, pedido del cliente: "quitar los
 * emojis o los símbolos") — AuthField sin `icon` cae a
 * authInputClassNoIcon.
 *
 * Layout de una sola columna (2026-08-18) — un primer intento emparejó
 * Email+Confirmar email y Contraseña+Confirmar contraseña en 2 columnas
 * desde lg:, con la tarjeta más ancha; el cliente lo probó y lo encontró
 * "demasiado ancho y estirado en desktop", así que se volvió a una sola
 * columna con la tarjeta angosta de siempre (460px fijo, ver
 * AuthShell.maxWidthClassName en registrarse/page.tsx). Nombre+Apellido
 * siguen siendo la ÚNICA excepción de 2 columnas (pedido explícito del
 * cliente en ambas rondas), desde sm:, 1 sola columna en mobile.
 */
export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
  const [telefonoNumero, setTelefonoNumero] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  // Un token de Turnstile es de un solo uso — si el registro falla por
  // cualquier motivo (email repetido, etc.), el token ya quedó consumido
  // del lado de Cloudflare aunque siga "presente" acá. widgetKey fuerza un
  // remount completo del widget (un token nuevo) en cada intento fallido.
  // Comparar `state` contra la última vista y llamar setState DIRECTO en
  // el cuerpo del render (no en un useEffect) — mismo patrón que React
  // documenta para "adjusting state when a prop changes" y que ya usa
  // site-header.tsx acá al lado; un setState síncrono en un efecto viola
  // react-hooks/set-state-in-effect.
  const [widgetKey, setWidgetKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.error) {
      setCaptchaToken("");
      setWidgetKey((k) => k + 1);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (email !== confirmarEmail) {
      e.preventDefault();
      setClientError("Los emails no coinciden.");
      return;
    }
    // El teléfono es opcional — solo se valida el formato si escribió algo.
    if (telefonoNumero && !TELEFONO_REGEX.test(telefonoNumero)) {
      e.preventDefault();
      setClientError("Ingresá un teléfono válido (solo números).");
      return;
    }
    if (password !== confirmarPassword) {
      e.preventDefault();
      setClientError("Las contraseñas no coinciden.");
      return;
    }
    setClientError(null);
  }

  const error = clientError ?? state.error;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3 sm:space-y-4" noValidate>
      {/* Grupo aparte con su propio espaciado, más chico y uniforme que el
          del resto del form (2026-08-17, pedido del cliente: "la
          separación entre un campo y el siguiente debe ser uniforme y más
          chica") — así el resto del form (captcha, botón, divisor, Google)
          no cambia su espaciado, solo estos campos entre sí. Más ajustado
          todavía en mobile (space-y-2, 2026-08-18: "compactá el formulario
          para mobile"), space-y-3 desde sm: para que desktop no cambie. */}
      <div className="space-y-2 sm:space-y-3">
        {/* Nombre + Apellido en fila de 2 columnas (2026-08-18, pedido del
            cliente: reemplaza el campo único "Usuario") — 1 sola columna
            en pantallas angostas (default, mobile-first), 2 desde sm:. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <AuthField
            id="nombre"
            name="nombre"
            label="Nombre"
            labelClassName={compactLabelClass}
            type="text"
            autoComplete="given-name"
            placeholder="Tu nombre"
            required
          />

          <AuthField
            id="apellido"
            name="apellido"
            label="Apellido"
            labelClassName={compactLabelClass}
            type="text"
            autoComplete="family-name"
            placeholder="Tu apellido"
            required
          />
        </div>

        <AuthField
          id="email"
          name="email"
          label="Email"
          labelClassName={compactLabelClass}
          type="email"
          autoComplete="email"
          placeholder="Escribí tu email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AuthField
          id="confirmarEmail"
          name="confirmarEmail"
          label="Confirmar email"
          labelClassName={compactLabelClass}
          type="email"
          autoComplete="email"
          placeholder="Repetí tu email"
          required
          value={confirmarEmail}
          onChange={(e) => setConfirmarEmail(e.target.value)}
        />

        {/* Teléfono: código de país + número, opcional (2026-08-18, pedido
            del cliente) — se unen en formato internacional recién en
            registerAction (ver comentario del componente, arriba). Ancho
            completo siempre, no tiene un campo par para compartir fila. */}
        <div>
          <label htmlFor="telefonoNumero" className={compactLabelClass}>
            Teléfono
          </label>
          <div className="flex gap-2">
            <select
              id="telefonoCodigo"
              name="telefonoCodigo"
              defaultValue="+54"
              aria-label="Código de país"
              className={phoneCodeSelectClass}
            >
              {CODIGOS_PAIS.map(({ code, pais }) => (
                <option key={code} value={code}>
                  {code} {pais}
                </option>
              ))}
            </select>
            <input
              id="telefonoNumero"
              name="telefonoNumero"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel-national"
              placeholder="2804123456"
              className={`flex-1 ${authInputClassNoIcon}`}
              value={telefonoNumero}
              onChange={(e) => setTelefonoNumero(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft">Código de área + número, sin el 0 ni el 15.</p>
        </div>

        <AuthField
          id="password"
          name="password"
          label="Contraseña"
          labelClassName={compactLabelClass}
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Escribí tu contraseña"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AuthField
          id="confirmarPassword"
          name="confirmarPassword"
          label="Confirmar contraseña"
          labelClassName={compactLabelClass}
          type="password"
          autoComplete="new-password"
          placeholder="Repetí tu contraseña"
          required
          value={confirmarPassword}
          onChange={(e) => setConfirmarPassword(e.target.value)}
        />
      </div>

      <input type="hidden" name="captchaToken" value={captchaToken} />
      <TurnstileWidget key={widgetKey} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />

      {error && (
        <p role="alert" className="text-sm text-coral-dark">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !captchaToken}
        className={`${authSubmitClass} uppercase`}
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-ink/10" />
        O ingresá con
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {/* Solo visual por ahora (Prompt 1) — ver el comentario equivalente
          en login-form.tsx. */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
      >
        <GoogleIcon />
        Ingresá con Google
      </button>
    </form>
  );
}
