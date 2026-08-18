"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

// Cloudflare no publica tipos oficiales para esto — se declara el mínimo
// que este componente realmente usa de la API global que agrega el script.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * CAPTCHA de Cloudflare Turnstile (2026-08-17, pedido del cliente: "la
 * implementacion del capcha al crear [cuenta]", TR-047) — se usa solo en
 * RegisterForm. Render explícito vía window.turnstile.render() (no el div
 * con data-sitekey de auto-render) para controlar el ciclo de vida desde
 * React sin que Cloudflare y React se peleen por el mismo DOM.
 *
 * onToken recibe el token cuando el usuario lo resuelve, y "" cuando
 * expira o falla — el form de arriba lo guarda en estado y lo manda en
 * captchaToken al backend, que es quien lo verifica de verdad contra la
 * API de Cloudflare (nunca confiar en un token solo porque "existe" del
 * lado del cliente). Pasarle una función ESTABLE (useState setter directo,
 * no un wrapper inline) — el efecto de acá abajo la usa como dependencia,
 * una nueva identidad en cada render recrearía el widget de más.
 */
export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) return;
    const id = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    widgetIdRef.current = id;
    return () => {
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
    };
  }, [scriptReady, siteKey, onToken]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
