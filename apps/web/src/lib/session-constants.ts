// Separado de lib/session.ts (que importa "server-only" + next/headers) a
// propósito: src/proxy.ts corre en el runtime de Proxy/Edge y solo
// necesita el nombre de la cookie, no toda la maquinaria de sesión del
// lado servidor.
export const SESSION_COOKIE = "tm_session";
