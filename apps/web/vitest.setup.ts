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

// jsdom tampoco implementa setPointerCapture/releasePointerCapture —
// fotos-manager.tsx los usa para el reordenado táctil (Pointer Events,
// bug real 2026-08-17: el drag-and-drop nativo de HTML5 no dispara con
// gestos táctiles en mobile). Sin esto, cualquier test que dispare un
// pointerdown sobre la agarradera revienta con "setPointerCapture is not
// a function".
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom tampoco define document.elementFromPoint (no hace layout real) —
// fotos-manager.tsx lo usa para saber sobre qué casillero está el dedo
// durante un arrastre táctil. Sin este stub base, ni siquiera se puede
// hacer vi.spyOn(document, "elementFromPoint") en un test puntual (spyOn
// necesita que la propiedad ya exista para poder reemplazarla).
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

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
