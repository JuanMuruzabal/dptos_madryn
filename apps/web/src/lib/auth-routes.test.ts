import { describe, expect, it } from "vitest";
import { isAuthChromeHidden } from "./auth-routes";

describe("isAuthChromeHidden", () => {
  it.each(["/ingresar", "/registrarse", "/registrarse/confirmar"])(
    "es true para %s (y sus subrutas)",
    (pathname) => {
      expect(isAuthChromeHidden(pathname)).toBe(true);
    },
  );

  it.each(["/", "/alojamiento", "/perfil", "/admin", "/registrarse-otra-cosa"])(
    "es false para %s",
    (pathname) => {
      expect(isAuthChromeHidden(pathname)).toBe(false);
    },
  );
});
