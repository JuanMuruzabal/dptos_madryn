"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Lock, User } from "lucide-react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { AuthField, authSubmitClass } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";

const initialState: AuthFormState = {};

/**
 * Rediseño 2026-08-17 (TR-048) — el campo sigue siendo el email de
 * siempre (name="email", el backend no cambia en esta ronda), con la
 * etiqueta "Usuario" nomás porque así lo pidió el cliente para esta
 * pantalla puntual — no hay un campo de username separado en el modelo de
 * datos (Usuario no tiene esa columna), así que relabelear el email
 * existente es lo que no requiere tocar la lógica de login (eso queda
 * para el Prompt 2, rama feature/, si en algún momento hace falta un
 * username de verdad).
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-6" noValidate>
      <AuthField
        id="email"
        name="email"
        label="Usuario"
        icon={<User size={16} />}
        type="email"
        autoComplete="email"
        placeholder="Escribí tu usuario"
        required
      />

      <div>
        <AuthField
          id="password"
          name="password"
          label="Contraseña"
          icon={<Lock size={16} />}
          type="password"
          autoComplete="current-password"
          placeholder="Escribí tu contraseña"
          required
        />
        <p className="mt-2 text-right text-xs">
          <Link href="#" className="font-medium text-tide hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-coral-dark">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${authSubmitClass} uppercase`}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-ink/10" />
        O ingresá con
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {/* Solo visual por ahora (Prompt 1) — se ve y se comporta como un
          botón normal (sin disabled: el pedido es que quede listo tal
          cual se va a ver en la versión final, no una preview grisada),
          pero sin onClick todavía. La integración real de Google OAuth es
          el Prompt 2, en su propia rama feature/. */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/15 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
      >
        <GoogleIcon />
        Ingresá con Google
      </button>
    </form>
  );
}
