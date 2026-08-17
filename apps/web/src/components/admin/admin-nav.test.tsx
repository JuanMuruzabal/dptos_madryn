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
    expect(screen.getByRole("link", { name: /Alojamientos/ })).toHaveAttribute(
      "href",
      "/admin/alojamientos",
    );
    expect(screen.getByRole("link", { name: /Reseñas/ })).toHaveAttribute("href", "/admin/resenas");
    expect(screen.getByRole("link", { name: /Editor de página/ })).toHaveAttribute(
      "href",
      "/admin/editor-pagina",
    );
  });

  it("en /admin, marca activo Resumen (fondo verde petróleo + texto crema) pero no las demás", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav />);
    const activo = screen.getByRole("link", { name: /Resumen/ });
    expect(activo.className).toContain("bg-[#193b44]");
    expect(activo.className).toContain("text-[#f5f1e8]");

    const inactivo = screen.getByRole("link", { name: /Reservas/ });
    expect(inactivo.className).toContain("bg-white");
    expect(inactivo.className).toContain("border-[rgba(0,0,0,0.1)]");
    expect(inactivo.className).toContain("text-[#3a5259]");
    expect(inactivo.className).not.toContain("bg-[#193b44]");
  });

  it("en una subruta de /admin/reservas, marca activo Reservas (startsWith)", () => {
    usePathname.mockReturnValue("/admin/reservas");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Reservas/ }).className).toContain("bg-[#193b44]");
    expect(screen.getByRole("link", { name: /Resumen/ }).className).not.toContain("bg-[#193b44]");
  });

  it("en /admin/alojamientos/xyz (ruta anidada), sigue marcando activo Alojamientos", () => {
    usePathname.mockReturnValue("/admin/alojamientos/xyz");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: /Alojamientos/ }).className).toContain("bg-[#193b44]");
  });
});
