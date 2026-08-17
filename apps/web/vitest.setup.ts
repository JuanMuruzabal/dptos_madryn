import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// El paquete real "server-only" tira un error SIEMPRE que se lo importa
// (node_modules/server-only/index.js) — su comportamiento de "no-op del
// lado del servidor" depende enteramente de que el bundler de Next.js lo
// intercepte y lo resuelva distinto según el target (cliente vs. servidor).
// Vitest no pasa por ese bundler, así que cualquier archivo que importe
// "server-only" (lib/jwt.ts, lib/session.ts) revienta sin este mock. Un
// entorno de test de Node ya "es" el servidor en este sentido, así que
// no-opearlo acá es fiel a la intención real del paquete, no un parche.
vi.mock("server-only", () => ({}));

// jsdom no implementa IntersectionObserver ni matchMedia — framer-motion
// los usa para whileInView (ScrollReveal) y useReducedMotion (Hero,
// ScrollReveal) respectivamente. Sin esto, cualquier componente que
// renderice un <motion.*> revienta con "IntersectionObserver is not
// defined" o "matchMedia is not a function" apenas monta.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

// jsdom tampoco implementa ResizeObserver — site-header.tsx lo usa (T4.x,
// bug real de mobile 2026-08-17: mide la altura real del header fijo para
// que las páginas no queden tapadas cuando el banner de aviso envuelve a
// más de una línea). Sin esto, cualquier test que monte <SiteHeader>
// revienta con "ResizeObserver is not defined" apenas monta.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
