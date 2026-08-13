import "server-only";

export interface JwtPayload {
  sub: string; // usuario_id
  rol: string;
  iat: number;
  exp: number;
}

/**
 * Decodifica (sin verificar firma) el payload de un JWT emitido por
 * apps/api (internal/auth/jwt.go). No usar para decisiones de autorización
 * reales — eso lo resuelve siempre el backend Go, dueño de JWT_SECRET. Acá
 * solo sirve para leer `exp` (alinear el Max-Age de la cookie) y mostrar
 * datos no sensibles en la UI (rol) sin otra llamada a la API.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(json);
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return payload as JwtPayload;
  } catch {
    return null;
  }
}
