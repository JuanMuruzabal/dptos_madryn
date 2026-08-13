/**
 * Gradiente de marca determinístico para alojamientos sin fotos cargadas
 * todavía (mismo espíritu que el fallback de <Scene>, ver lib/scenes.ts) —
 * el mismo alojamiento siempre cae en el mismo color, en vez de parpadear
 * entre recargas.
 */
const GRADIENTS = [
  "linear-gradient(160deg, #12333b 0%, #1f7a8c 100%)", // tide
  "linear-gradient(160deg, #12333b 0%, #c99a5b 100%)", // dune
  "linear-gradient(160deg, #12333b 0%, #6f7d4a 100%)", // steppe
  "linear-gradient(160deg, #12333b 0%, #e2725b 100%)", // coral
];

export function placeholderGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}
