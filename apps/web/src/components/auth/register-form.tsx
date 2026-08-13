"use client";

import { useActionState } from "react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { authInputClass, authLabelClass, authSubmitClass } from "@/components/auth/auth-shell";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="nombre" className={authLabelClass}>
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          required
          className={authInputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className={authLabelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={authInputClass}
        />
      </div>

      <div>
        <label htmlFor="telefono" className={authLabelClass}>
          Teléfono <span className="font-normal text-ink-soft">(opcional)</span>
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          className={authInputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={authLabelClass}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={authInputClass}
        />
        <p className="mt-1.5 text-xs text-ink-soft">Al menos 8 caracteres.</p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-coral-dark">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
