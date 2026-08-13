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

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const telefono = String(formData.get("telefono") ?? "").trim();

  if (!nombre) return { error: "Ingresá tu nombre." };
  if (!email.includes("@")) return { error: "Ingresá un email válido." };
  if (password.length < MIN_PASSWORD_LEN) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.` };
  }

  const result = await postAuth("/auth/register", {
    nombre,
    email,
    password,
    telefono: telefono || undefined,
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
