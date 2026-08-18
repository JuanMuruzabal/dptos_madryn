"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { AuthField, authSubmitClass } from "@/components/auth/auth-shell";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";

const initialState: AuthFormState = {};

/**
 * Rediseño 2026-08-17 (TR-048). Campo "Email" (no "Usuario" — aclarado
 * por el cliente: el login es mail + contraseña, no usuario + contraseña;
 * "Usuario" queda solo en RegisterForm, que sí lo pide como campo propio).
 * Sin íconos en los campos (2026-08-18, pedido del cliente: "quitar los
 * emojis o los símbolos") — AuthField sin la prop `icon` cae a
 * authInputClassNoIcon, mismo look sin el espacio reservado a la izquierda.
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <AuthField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="Escribí tu email"
        required
      />

      <div>
        <AuthField
          id="password"
          name="password"
          label="Contraseña"
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

      {/* Real desde el Prompt 2 (2026-08-18) — ver google-signin-button.tsx. */}
      <GoogleSignInButton />
    </form>
  );
}
