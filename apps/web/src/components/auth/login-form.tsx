"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { authInputClass, authLabelClass, authSubmitClass } from "@/components/auth/auth-shell";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-5" noValidate>
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
        <label htmlFor="password" className={authLabelClass}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={authInputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-coral-dark">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
