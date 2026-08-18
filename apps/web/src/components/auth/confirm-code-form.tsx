"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import {
  confirmarCuentaAction,
  reenviarCodigoAction,
  type AuthFormState,
  type ReenviarCodigoState,
} from "@/app/actions/auth";
import { AuthField, authSubmitClass } from "@/components/auth/auth-shell";

const initialState: AuthFormState = {};
const initialReenviarState: ReenviarCodigoState = {};

/**
 * Conectado de verdad (2026-08-18, Prompt 2 de docs/prompts-login (1).md
 * — antes, Prompt 1, esto era solo visual). confirmarCuentaAction valida
 * el código de 6 dígitos contra el backend (POST /auth/confirmar) y
 * loguea automático si es correcto; reenviarCodigoAction pide uno nuevo
 * (POST /auth/reenviar-codigo — respuesta siempre genérica del backend,
 * nunca revela si la cuenta existe o ya está confirmada, ver auth.go).
 *
 * Dos <form> separados (no uno anidado dentro del otro — HTML no permite
 * forms anidados): confirmar el código y reenviarlo son dos Server
 * Actions distintas con su propio estado de pending/error. email viene
 * de la URL (?email=, ver app/registrarse/confirmar/page.tsx) — viaja
 * como campo oculto en ambos forms, nunca se lo hace escribir a mano.
 *
 * reenviarAlEntrar (bug real 2026-08-18): cuando se llega acá desde
 * loginAction (una cuenta sin confirmar que intentó loguearse), nunca se
 * generó ningún código todavía — a diferencia de venir de
 * registerAction, que sí mandó uno recién. Sin este disparo automático,
 * la pantalla se abría sin ningún código en camino y "Reenviar código"
 * quedaba como el único paso (nada obvio) para conseguir uno.
 */
export function ConfirmCodeForm({ email, reenviarAlEntrar = false }: { email: string; reenviarAlEntrar?: boolean }) {
  const [state, action, pending] = useActionState(confirmarCuentaAction, initialState);
  const [reenviarState, reenviarAction, reenviarPending] = useActionState(
    reenviarCodigoAction,
    initialReenviarState,
  );
  const [codigo, setCodigo] = useState("");

  // Guard con ref (no un array de deps vacío) para poder listar
  // reenviarAlEntrar/email/reenviarAction en las deps sin que un
  // re-render de más dispare un segundo reenvío.
  const yaDisparado = useRef(false);
  useEffect(() => {
    if (!reenviarAlEntrar || yaDisparado.current) return;
    yaDisparado.current = true;
    const formData = new FormData();
    formData.set("email", email);
    reenviarAction(formData);
  }, [reenviarAlEntrar, email, reenviarAction]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <AuthField
          id="codigo"
          name="codigo"
          label="Código de confirmación"
          icon={<KeyRound size={16} />}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Escribí el código que te mandamos"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
        />

        {state.error && (
          <p role="alert" className="text-sm text-coral-dark">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${authSubmitClass} uppercase`}>
          {pending ? "Confirmando…" : "Confirmar cuenta"}
        </button>
      </form>

      <form action={reenviarAction}>
        <input type="hidden" name="email" value={email} />
        <p className="text-center text-sm text-ink-soft">
          ¿No te llegó nada?{" "}
          <button
            type="submit"
            disabled={reenviarPending}
            className="font-medium text-tide hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reenviarPending ? "Reenviando…" : "Reenviar código"}
          </button>
        </p>

        {reenviarState.mensaje && (
          <p role="status" className="mt-2 text-center text-xs text-ink-soft">
            {reenviarState.mensaje}
          </p>
        )}
        {reenviarState.error && (
          <p role="alert" className="mt-2 text-center text-xs text-coral-dark">
            {reenviarState.error}
          </p>
        )}
      </form>
    </div>
  );
}
