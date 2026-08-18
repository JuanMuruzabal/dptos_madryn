import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooterVisibility } from "./site-footer-visibility";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("SiteFooterVisibility", () => {
  it("muestra el footer fuera de /ingresar y /registrarse", () => {
    usePathname.mockReturnValue("/alojamiento");
    render(
      <SiteFooterVisibility>
        <footer>pie de página</footer>
      </SiteFooterVisibility>,
    );
    expect(screen.getByText("pie de página")).toBeInTheDocument();
  });

  it.each(["/ingresar", "/registrarse", "/registrarse/confirmar"])(
    "oculta el footer en %s (2026-08-17, pedido del cliente)",
    (ruta) => {
      usePathname.mockReturnValue(ruta);
      render(
        <SiteFooterVisibility>
          <footer>pie de página</footer>
        </SiteFooterVisibility>,
      );
      expect(screen.queryByText("pie de página")).not.toBeInTheDocument();
    },
  );
});
