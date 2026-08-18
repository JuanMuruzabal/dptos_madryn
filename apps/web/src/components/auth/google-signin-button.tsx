"use client";

import Script from "next/script";
import { useCallback, useRef, useState, useTransition } from "react";
import { googleLoginAction } from "@/app/actions/auth";
import { GoogleIcon } from "@/components/auth/google-icon";

// Google no publica tipos oficiales para Identity Services — se declara
// el mínimo que este componente realmente usa (mismo criterio que
// turnstile-widget.tsx con window.turnstile).
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: "popup";
            callback: (response: { code?: string; error?: string }) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

// Site key... digo, Client ID público de Google Cloud (Prompt 2,
// 2026-08-18) — NEXT_PUBLIC_ a propósito, el navegador lo necesita ahí
// para iniciar el flujo (el client SECRET nunca viaja al cliente, vive
// solo en apps/api, ver internal/googleauth). Sin un par de prueba
// público como el de Turnstile (TR-047) — sin esto configurado, el botón
// queda visible pero deshabilitado (ver más abajo), no roto.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * "Ingresá con Google" real (Prompt 2 de docs/prompts-login (1).md) —
 * reemplaza el botón solo-visual del Prompt 1 en LoginForm/RegisterForm.
 * Google Identity Services, Authorization Code flow en modo popup (el
 * usuario nunca sale de la página): el authorization code que devuelve el
 * popup se manda a googleLoginAction (Server Action), que lo intercambia
 * server-side contra la API de Google — el client secret nunca toca el
 * navegador (ver internal/googleauth.HTTPExchanger).
 *
 * startTransition (no un simple onClick async + .then) a propósito: es el
 * puente que React/Next necesitan para que el redirect("/perfil") de
 * adentro de googleLoginAction se resuelva bien al llamar la Server
 * Action fuera de un <form>, en vez de propagarse como una excepción sin
 * manejar en el cliente.
 */
export function GoogleSignInButton() {
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const clientRef = useRef<{ requestCode: () => void } | null>(null);

  const handleCode = useCallback((response: { code?: string; error?: string }) => {
    if (!response.code) {
      setError("No pudimos completar el ingreso con Google — probá de nuevo.");
      return;
    }
    const code = response.code;
    startTransition(async () => {
      const result = await googleLoginAction(code);
      if (result?.error) setError(result.error);
    });
  }, []);

  function handleClick() {
    if (!GOOGLE_CLIENT_ID || !scriptReady || !window.google) return;
    setError("");
    // El cliente de Google se arma una sola vez y se reusa — un
    // initCodeClient nuevo en cada click no hace falta y descarta el
    // callback ya registrado de más.
    if (!clientRef.current) {
      clientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: handleCode,
      });
    }
    clientRef.current.requestCode();
  }

  return (
    <div>
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!GOOGLE_CLIENT_ID || pending}
        title={GOOGLE_CLIENT_ID ? undefined : "Ingresar con Google no está configurado todavía"}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/15 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {pending ? "Conectando…" : "Ingresá con Google"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-coral-dark">
          {error}
        </p>
      )}
    </div>
  );
}
