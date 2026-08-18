"use server";

import { redirect } from "next/navigation";
import type { AuthResponse, ApiError } from "@turismo-marcuzzi/shared-types";
import { apiUrl } from "@/lib/api";
import { createSession, deleteSession } from "@/lib/session";

export interface AuthFormState {
  error?: string;
}

const MIN_PASSWORD_LEN = 8; // debe coincidir con apps/api/internal/http/auth.go

/** POST a apps/api y devuelve el JSON tipado, sea éxito o error. */
async function postAuth(
  path: "/auth/register" | "/auth/login",
  body: unknown,
): Promise<{ ok: true; data: AuthResponse } | { ok: false; status: number; error: string }> {
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

  const data = (await res.json()) as AuthResponse;
  return { ok: true, data };
}

// Solo dígitos, longitud razonable — mismo regex que RegisterForm valida
// en el cliente (register-form.tsx); repetido acá como defensa en
// profundidad (2026-08-18), igual criterio que el resto de esta función.
const TELEFONO_REGEX = /^\d{6,14}$/;

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
  // Defensa en profundidad (TR-048) — RegisterForm ya valida esto mismo
  // en el cliente antes de dejar que el form se envíe; esto cubre el caso
  // de alguien pegándole directo a la Server Action sin pasar por esa UI.
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

  const result = await postAuth("/auth/register", {
    nombre: `${nombre} ${apellido}`.trim(),
    email,
    password,
    telefono: telefonoNumero ? `${telefonoCodigo}${telefonoNumero}` : undefined,
    captchaToken,
  });

  if (!result.ok) return { error: result.error };

  await createSession(result.data.token);
  redirect("/perfil");
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Ingresá tu email y contraseña." };

  const result = await postAuth("/auth/login", { email, password });
  if (!result.ok) return { error: result.error };

  await createSession(result.data.token);
  redirect("/perfil");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
