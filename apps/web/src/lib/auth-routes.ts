/**
 * Rutas donde se oculta el header/footer globales del sitio (2026-08-17,
 * pedido del cliente: en /ingresar y /registrarse solo debe verse la caja
 * de login/registro, sin el chrome del sitio alrededor). Usado tanto por
 * site-header.tsx (se oculta a sí mismo, ya es client component con
 * usePathname) como por site-footer-visibility.tsx (SiteFooter es un
 * Server Component async, no puede leer usePathname directo — necesita
 * este wrapper cliente aparte).
 */
const HIDDEN_CHROME_PREFIXES = ["/ingresar", "/registrarse"];

export function isAuthChromeHidden(pathname: string): boolean {
  return HIDDEN_CHROME_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
