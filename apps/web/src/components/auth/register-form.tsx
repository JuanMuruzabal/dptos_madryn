"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Lock, Mail, User } from "lucide-react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { AuthField, authSubmitClass } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const initialState: AuthFormState = {};

// Espaciado más ajustado label→input (2026-08-17, pedido puntual del
// cliente: "la etiqueta debe quedar más pegada a su propio input" — SOLO
// en este form, ver AuthField/authLabelClass en auth-shell.tsx, que no
// cambian para LoginForm/ConfirmCodeForm).
const compactLabelClass = "mb-0.5 block text-sm font-medium text-ink";

// Site key pública de Turnstile (TR-047) — el fallback es la site key de
// PRUEBA pública de Cloudflare (siempre aprueba), así el registro funciona
// en desarrollo local sin cuenta de Cloudflare real. NEXT_PUBLIC_ (no un
// secreto: el widget del navegador la necesita ahí a la fuerza).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

/**
 * Rediseño 2026-08-17 (TR-048): Usuario/Email/Confirmar email/Contraseña/
 * Confirmar contraseña + CAPTCHA. "Usuario" es el mismo campo `nombre` de
 * siempre relabeleado (igual que en LoginForm, ver su comentario) — no hay
 * username separado en el modelo de datos. "Confirmar email"/"Confirmar
 * contraseña" son SOLO validación de UI (evitar un typo antes de mandar el
 * form) — no viajan al backend Go, que sigue recibiendo nombre/email/
 * password como siempre; si no coinciden entre sí, el propio
 * registerAction (Server Action) los vuelve a chequear como defensa en
 * profundidad, no solo acá.
 *
 * El teléfono (opcional, T3.5) sale del formulario visible a pedido del
 * cliente — el campo del backend sigue existiendo y acepta que quede
 * vacío, no se perdió capacidad del modelo de datos, solo dejó de
 * pedirse en el alta.
 */
export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
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
    if (password !== confirmarPassword) {
      e.preventDefault();
      setClientError("Las contraseñas no coinciden.");
      return;
    }
    setClientError(null);
  }

  const error = clientError ?? state.error;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Grupo aparte con su propio espaciado, más chico y uniforme que el
          del resto del form (2026-08-17, pedido del cliente: "la
          separación entre un campo y el siguiente debe ser uniforme y más
          chica") — así el resto del form (captcha, botón, divisor, Google)
          no cambia su espaciado, solo estos 5 campos entre sí. */}
      <div className="space-y-3">
        <AuthField
          id="nombre"
          name="nombre"
          label="Usuario"
          labelClassName={compactLabelClass}
          icon={<User size={16} />}
          type="text"
          autoComplete="username"
          placeholder="Escribí tu usuario"
          required
        />

        <AuthField
          id="email"
          name="email"
          label="Email"
          labelClassName={compactLabelClass}
          icon={<Mail size={16} />}
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
          icon={<Mail size={16} />}
          type="email"
          autoComplete="email"
          placeholder="Repetí tu email"
          required
          value={confirmarEmail}
          onChange={(e) => setConfirmarEmail(e.target.value)}
        />

        <AuthField
          id="password"
          name="password"
          label="Contraseña"
          labelClassName={compactLabelClass}
          icon={<Lock size={16} />}
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
          icon={<Lock size={16} />}
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
