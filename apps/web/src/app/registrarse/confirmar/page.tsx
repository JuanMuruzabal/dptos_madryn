import type { Metadata } from "next";
import { fetchImagenesSitioMap } from "@/lib/api";
import { AUTH_FONDO_LOGIN_CLAVE } from "@/lib/auth-fondo";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmCodeForm } from "@/components/auth/confirm-code-form";

// Ver comentario en app/ingresar/page.tsx sobre por qué instant = false.
export const instant = false;

export const metadata: Metadata = { title: "Confirmá tu cuenta — Turismo Marcuzzi" };

/**
 * Pantalla de confirmación de código — conectada de verdad desde el
 * Prompt 2 (2026-08-18, docs/prompts-login (1).md). Se llega acá desde
 * registerAction (después de crear la cuenta) o desde loginAction (si
 * alguien intenta loguearse sin haber confirmado todavía), siempre con
 * ?email= en la URL — nunca se le pide al usuario que lo tipee de nuevo.
 * Sin ?email= (alguien entra directo a la ruta) el form igual se muestra,
 * simplemente con ese campo vacío.
 */
export default async function ConfirmarCuentaPage({ searchParams }: PageProps<"/registrarse/confirmar">) {
  const [imagenes, resolvedSearchParams] = await Promise.all([fetchImagenesSitioMap(), searchParams]);
  const emailParam = resolvedSearchParams.email;
  const email = typeof emailParam === "string" ? emailParam : "";
  // reenviar=1 (bug real 2026-08-18): loginAction lo agrega al redirigir
  // acá por una cuenta sin confirmar — a diferencia de venir de
  // registerAction (que ya mandó un código recién), acá nunca se generó
  // ninguno, así que ConfirmCodeForm tiene que pedirlo solo apenas se
  // monta, ver su comentario.
  const reenviarAlEntrar = resolvedSearchParams.reenviar === "1";
  // Mismo flag de arriba: si vino de loginAction, "volver" tiene que ser
  // al login (de ahí salió); si vino de registerAction, al registro
  // (pedido del cliente, 2026-08-18: "el botón de volver al inicio debe
  // cambiarse por volver al inicio de sesión o volver al registro...
  // según de dónde se tome el camino a esta pestaña").
  const volverLabel = reenviarAlEntrar ? "Volver al login" : "Volver al registro";
  const volverHref = reenviarAlEntrar ? "/ingresar" : "/registrarse";

  return (
    <AuthShell
      title="Confirmá tu cuenta"
      backgroundUrl={imagenes.get(AUTH_FONDO_LOGIN_CLAVE)}
      footer={<>Revisá también la carpeta de spam si no lo ves.</>}
      volverLabel={volverLabel}
      volverHref={volverHref}
    >
      <ConfirmCodeForm email={email} reenviarAlEntrar={reenviarAlEntrar} />
    </AuthShell>
  );
}
