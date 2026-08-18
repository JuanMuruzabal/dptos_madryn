"use server";

import { redirect } from "next/navigation";
import type { AuthResponse, RegisterResponse, ApiError } from "@turismo-marcuzzi/shared-types";
import { apiUrl } from "@/lib/api";
import { createSession, deleteSession } from "@/lib/session";

export interface AuthFormState {
  error?: string;
}

/** Estado propio de reenviarCodigoAction (2026-08-18, Prompt 2) — a
 * diferencia del resto, un pedido de reenvío exitoso no redirige a
 * ningún lado, solo confirma con un mensaje que se mandó (o no rompe
 * nada si ya estaba confirmada / no existía — ver la respuesta genérica
 * de POST /auth/reenviar-codigo en el backend). */
export interface ReenviarCodigoState {
  mensaje?: string;
  error?: string;
}

const MIN_PASSWORD_LEN = 8; // debe coincidir con apps/api/internal/http/auth.go

/** POST a apps/api y devuelve el JSON tipado, sea éxito o error. Genérico
 * en T (2026-08-18, Prompt 2): /auth/register devuelve RegisterResponse
 * (sin token), /auth/login+/auth/confirmar+/auth/google devuelven
 * AuthResponse (con token), /auth/reenviar-codigo devuelve {mensaje}. */
async function postAuth<T>(
  path: "/auth/register" | "/auth/login" | "/auth/confirmar" | "/auth/reenviar-codigo" | "/auth/google",
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No pudimos conectar con el servidor. Probá de nuevo en un momento." };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, status: res.status, error: data?.error ?? "Ocurrió un error inesperado." };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}

// Solo dígitos, longitud razonable — mismo regex que RegisterForm valida
// en el cliente (register-form.tsx); repetido acá como defensa en
// profundidad (2026-08-18), igual criterio que el resto de esta función.
const TELEFONO_REGEX = /^\d{6,14}$/;

/**
 * Rediseño 2026-08-18 (Prompt 2 de docs/prompts-login (1).md): ya no crea
 * sesión ni redirige a /perfil — la cuenta queda pendiente de confirmar
 * hasta que el usuario ingresa el código que le llega por email
 * (RegisterResponse.requiereConfirmacion), así que esto redirige a
 * /registrarse/confirmar con el email en la URL. confirmarEmail/
 * confirmarPassword ahora SÍ viajan al backend (antes, TR-048, no
 * viajaban — el backend también los valida, no solo esta Server Action).
 */
export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // Nombre y Apellido viajan separados en el form (2026-08-18, mejor UX
  // que un solo campo largo) pero el backend Go sigue teniendo un único
  // campo `nombre` — se combinan acá, no hay columna `apellido` nueva en
  // el modelo de datos (mismo criterio ya usado para "Usuario"→nombre en
  // TR-048).
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const confirmarEmail = String(formData.get("confirmarEmail") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmarPassword = String(formData.get("confirmarPassword") ?? "");
  // Ídem nombre/apellido: código de país + número viajan separados (un
  // <select> propio) y se unen acá en formato internacional antes de
  // mandarlo — el backend sigue recibiendo un solo string en `telefono`.
  const telefonoCodigo = String(formData.get("telefonoCodigo") ?? "").trim();
  const telefonoNumero = String(formData.get("telefonoNumero") ?? "").trim();
  const captchaToken = String(formData.get("captchaToken") ?? "");

  if (!nombre) return { error: "Ingresá tu nombre." };
  if (!apellido) return { error: "Ingresá tu apellido." };
  if (!email.includes("@")) return { error: "Ingresá un email válido." };
  // Defensa en profundidad (TR-048, y ahora también en el backend —
  // Prompt 2) — RegisterForm ya valida esto mismo en el cliente antes de
  // dejar que el form se envíe; esto cubre el caso de alguien pegándole
  // directo a la Server Action sin pasar por esa UI.
  if (email !== confirmarEmail) return { error: "Los emails no coinciden." };
  // El teléfono es opcional — solo se valida el formato si mandó un número.
  if (telefonoNumero && !TELEFONO_REGEX.test(telefonoNumero)) {
    return { error: "Ingresá un teléfono válido (solo números)." };
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.` };
  }
  if (password !== confirmarPassword) return { error: "Las contraseñas no coinciden." };
  // El backend vuelve a verificar esto contra la API de Cloudflare
  // (nunca confiar en que un token "existe" del lado del cliente) — este
  // chequeo acá es solo para no hacer el POST si ni siquiera hay token.
  if (!captchaToken) return { error: "Completá la verificación anti-bot." };

  const result = await postAuth<RegisterResponse>("/auth/register", {
    nombre: `${nombre} ${apellido}`.trim(),
    email,
    confirmarEmail,
    password,
    confirmarPassword,
    telefono: telefonoNumero ? `${telefonoCodigo}${telefonoNumero}` : undefined,
    captchaToken,
  });

  if (!result.ok) return { error: result.error };

  redirect(`/registrarse/confirmar?email=${encodeURIComponent(email)}`);
}

/**
 * Confirma el código de 6 dígitos que llegó por email (Prompt 2) — éxito
 * = login automático (el backend devuelve token igual que /auth/login).
 */
export async function confirmarCuentaAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim();

  if (!email) return { error: "Falta el email a confirmar." };
  if (!codigo) return { error: "Ingresá el código que te mandamos." };

  const result = await postAuth<AuthResponse>("/auth/confirmar", { email, codigo });
  if (!result.ok) return { error: result.error };

  await createSession(result.data.token);
  redirect("/perfil");
}

/**
 * Pide un código nuevo (Prompt 2: "permití reenviar el código") — la
 * respuesta del backend es siempre genérica (200, mismo mensaje exista o
 * no exista la cuenta, esté o no confirmada ya) para no revelar qué
 * emails están registrados; esta Server Action simplemente la traslada.
 */
export async function reenviarCodigoAction(
  _prevState: ReenviarCodigoState,
  formData: FormData,
): Promise<ReenviarCodigoState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Falta el email." };

  const result = await postAuth<{ mensaje: string }>("/auth/reenviar-codigo", { email });
  if (!result.ok) return { error: result.error };

  return { mensaje: result.data.mensaje };
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Ingresá tu email y contraseña." };

  const result = await postAuth<AuthResponse>("/auth/login", { email, password });
  if (!result.ok) {
    // 403 = cuenta todavía sin confirmar (Prompt 2, ver auth.go) — en vez
    // de un error genérico sin salida, mandamos directo a la pantalla de
    // confirmación con el email ya cargado. `reenviar=1` (bug real
    // 2026-08-18: acá NO se acaba de generar un código nuevo — a
    // diferencia de venir de registerAction, que sí mandó uno recién —
    // así que sin este flag la pantalla se abría sin ningún código en
    // camino, y "reenviar código" quedaba como el único (y no obvio)
    // paso manual para conseguir uno) le dice a ConfirmCodeForm que
    // dispare el reenvío solo, apenas se monta.
    if (result.status === 403) {
      redirect(`/registrarse/confirmar?email=${encodeURIComponent(email)}&reenviar=1`);
    }
    return { error: result.error };
  }

  await createSession(result.data.token);
  redirect("/perfil");
}

/**
 * Ingreso con Google (Prompt 2) — a diferencia de las demás, no es el
 * handler de un <form action>: GoogleSignInButton la llama directo desde
 * su onClick con el authorization code que devolvió el popup de Google
 * Identity Services. Server Actions se pueden invocar así (no solo desde
 * formularios) — redirect() funciona igual.
 */
export async function googleLoginAction(code: string): Promise<{ error?: string }> {
  const result = await postAuth<AuthResponse>("/auth/google", { code });
  if (!result.ok) return { error: result.error };

  await createSession(result.data.token);
  redirect("/perfil");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
