import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-constants";

// Nota Next.js 16: esto se llamaba "Middleware" en versiones anteriores;
// ahora es "Proxy" (mismo mecanismo, archivo proxy.ts en vez de
// middleware.ts). Ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.

const PROTECTED_ROUTES = ["/perfil", "/admin"];
const AUTH_ONLY_ROUTES = ["/ingresar", "/registrarse"];

/**
 * Chequeo optimista (solo mira si la cookie existe, no llama a la API):
 * - Sin cookie + ruta protegida → a /ingresar.
 * - Con cookie + página de login/registro → a /perfil (no tiene sentido
 *   mostrarle el formulario a alguien ya logueado).
 * La validación real del JWT la hace siempre apps/api, o la DAL de
 * /perfil (T1.3) / /admin (T4.1, app/admin/layout.tsx — ahí además se
 * chequea el rol, esto acá solo mira que exista la cookie) — esto es solo
 * para no renderizar de más.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  if (hasSession && AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/perfil", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)"],
};
