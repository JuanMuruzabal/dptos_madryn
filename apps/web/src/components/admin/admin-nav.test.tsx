import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNav } from "./admin-nav";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("AdminNav", () => {
  it("renderiza un link por cada sección", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Resumen/ })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /Reservas/ })).toHaveAttribute("href", "/admin/reservas");
    expect(screen.getByRole("link", { name: /Alojamientos/ })).toHaveAttribute("href", "/admin/alojamientos");
    expect(screen.getByRole("link", { name: /Reseñas/ })).toHaveAttribute("href", "/admin/resenas");
    expect(screen.getByRole("link", { name: /Editor de página/ })).toHaveAttribute(
      "href",
      "/admin/editor-pagina",
    );
  });

  it("en /admin, marca activo Resumen pero no las demás secciones (match exacto)", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Resumen/ }).className).toContain("border-current");
    expect(screen.getByRole("link", { name: /Reservas/ }).className).toContain("border-transparent");
  });

  it("en una subruta de /admin/reservas, marca activo Reservas (startsWith)", () => {
    usePathname.mockReturnValue("/admin/reservas");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Reservas/ }).className).toContain("border-current");
    expect(screen.getByRole("link", { name: /Resumen/ }).className).toContain("border-transparent");
  });

  it("en /admin/alojamientos/xyz (ruta anidada), sigue marcando activo Alojamientos", () => {
    usePathname.mockReturnValue("/admin/alojamientos/xyz");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Alojamientos/ }).className).toContain("border-current");
  });
});
