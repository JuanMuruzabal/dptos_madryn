import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

// getCurrentYear usa "use cache"/cacheLife, que solo existe en el runtime
// real de Next.js (ver current-year.test.ts) — se mockea directo acá para
// no arrastrar ese detalle a un test que solo le importa el año devuelto.
vi.mock("@/lib/current-year", () => ({ getCurrentYear: async () => new Date().getFullYear() }));

describe("SiteFooter", () => {
  it("renderiza los links de servicios, cuenta y el año actual", async () => {
    render((await SiteFooter()) as React.ReactElement);
    expect(screen.getByRole("link", { name: "Alojamiento" })).toHaveAttribute("href", "/alojamiento");
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/registrarse");
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Turismo Marcuzzi`))).toBeInTheDocument();
  });
});
