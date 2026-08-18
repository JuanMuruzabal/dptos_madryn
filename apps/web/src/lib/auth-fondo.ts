/**
 * Clave fija del "editor de página" (T4.13, ImagenSitio) para la foto de
 * fondo compartida entre /ingresar y /registrarse (2026-08-17, pedido del
 * cliente) — un solo fondo para las dos pantallas, mismo estilo visual
 * descripto para ambas. Compartida entre app/admin/editor-pagina/page.tsx
 * (donde se sube) y auth-shell.tsx (donde se usa) para no repetir el
 * string suelto en los dos lugares.
 */
export const AUTH_FONDO_LOGIN_CLAVE = "auth_fondo_login";

/** Gradiente de marca de respaldo (mismo criterio que lib/scenes.ts) — se
 * usa mientras el cliente no cargó todavía una foto real para el fondo. */
export const AUTH_FONDO_LOGIN_GRADIENT = "linear-gradient(135deg, #1f7a8c 0%, #12333b 80%)";
