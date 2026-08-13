import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { decodeJwtPayload } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/session-constants";

export { SESSION_COOKIE };

/**
 * Guarda el JWT que devuelve apps/api (/auth/register, /auth/login) como
 * cookie httpOnly de primera parte. No lo re-encriptamos: Go ya lo firma;
 * acá solo lo guardamos y reenviamos. El Max-Age se deriva del propio
 * `exp` del token para no desincronizarse nunca de internal/auth/jwt.go.
 */
export async function createSession(token: string) {
  const payload = decodeJwtPayload(token);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: payload ? new Date(payload.exp * 1000) : undefined,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export interface Session {
  usuarioId: string;
  rol: string;
}

/**
 * Chequeo "optimista" (ver guía de auth de Next.js): solo lee y decodifica
 * la cookie, sin ir a la API. Sirve para redirects y para mostrar/ocultar
 * UI (header, proxy.ts). Cualquier acción real (reservar, ver datos
 * sensibles) tiene que llamar a apps/api, que valida la firma del JWT de
 * verdad — esto nunca reemplaza esa validación.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // `Date.now()` es un "valor inestable" para Cache Components (cambia
  // entre renders) — ya somos dinámicos por leer cookies() arriba, pero
  // el análisis estático de Next no siempre lo rastrea a través de
  // funciones intermedias envueltas en cache(). `connection()` lo marca
  // explícito, sin ambigüedad. Ver docs/app/api-reference/functions/connection.
  await connection();
  if (payload.exp * 1000 < Date.now()) return null;

  return { usuarioId: payload.sub, rol: payload.rol };
});
