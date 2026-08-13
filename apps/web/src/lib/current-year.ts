import { cacheLife } from "next/cache";

/**
 * `new Date()` es un valor "inestable" para Cache Components (puede
 * cambiar entre renders) — hay que cachearlo explícitamente en vez de
 * leerlo directo en un componente estático. El año de copyright del
 * footer no necesita más precisión que esto (se refresca en cada deploy
 * igual, ver "Where cached content is stored" en la doc de caching).
 */
export async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
