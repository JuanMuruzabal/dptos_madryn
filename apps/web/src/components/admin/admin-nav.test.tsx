import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminNav } from "./admin-nav";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

// AdminNav renderiza 2 <nav> (escritorio + mobile, 2026-08-17) — cada
// sección aparece 2 veces, una por variante, así que hace falta escopear
// las queries a un <nav> puntual con within() en vez de getByRole directo.
function navs() {
  const [desktop, mobile] = screen.getAllByRole("navigation");
  return { desktop, mobile };
}

describe("AdminNav", () => {
  it("renderiza un link por cada sección en las dos variantes", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav />);
    for (const nav of Object.values(navs())) {
      expect(within(nav).getByRole("link", { name: /Resumen/ })).toHaveAttribute("href", "/admin");
      expect(within(nav).getByRole("link", { name: /Reservas/ })).toHaveAttribute(
        "href",
        "/admin/reservas",
      );
      expect(within(nav).getByRole("link", { name: /Alojamientos/ })).toHaveAttribute(
        "href",
        "/admin/alojamientos",
      );
      expect(within(nav).getByRole("link", { name: /Reseñas/ })).toHaveAttribute(
        "href",
        "/admin/resenas",
      );
      expect(within(nav).getByRole("link", { name: /Editor de página/ })).toHaveAttribute(
        "href",
        "/admin/editor-pagina",
      );
    }
  });

  describe("escritorio (subrayado + color por categoría)", () => {
    it("en /admin, marca activo Resumen pero no las demás secciones (match exacto)", () => {
      usePathname.mockReturnValue("/admin");
      render(<AdminNav />);
      const { desktop } = navs();
      expect(within(desktop).getByRole("link", { name: /Resumen/ }).className).toContain(
        "border-current",
      );
      expect(within(desktop).getByRole("link", { name: /Reservas/ }).className).toContain(
        "border-transparent",
      );
    });

    it("en una subruta de /admin/reservas, marca activo Reservas (startsWith)", () => {
      usePathname.mockReturnValue("/admin/reservas");
      render(<AdminNav />);
      const { desktop } = navs();
      expect(within(desktop).getByRole("link", { name: /Reservas/ }).className).toContain(
        "border-current",
      );
      expect(within(desktop).getByRole("link", { name: /Resumen/ }).className).toContain(
        "border-transparent",
      );
    });

    it("en /admin/alojamientos/xyz (ruta anidada), sigue marcando activo Alojamientos", () => {
      usePathname.mockReturnValue("/admin/alojamientos/xyz");
      render(<AdminNav />);
      const { desktop } = navs();
      expect(within(desktop).getByRole("link", { name: /Alojamientos/ }).className).toContain(
        "border-current",
      );
    });
  });

  describe("mobile (lista vertical de una columna, 2026-08-17)", () => {
    it("la sección activa tiene fondo verde petróleo y texto crema", () => {
      usePathname.mockReturnValue("/admin");
      render(<AdminNav />);
      const { mobile } = navs();
      const activo = within(mobile).getByRole("link", { name: /Resumen/ });
      expect(activo.className).toContain("bg-[#193b44]");
      expect(activo.className).toContain("text-[#f5f1e8]");
    });

    it("las secciones inactivas tienen fondo blanco, borde tenue y texto gris oscuro", () => {
      usePathname.mockReturnValue("/admin");
      render(<AdminNav />);
      const { mobile } = navs();
      const inactivo = within(mobile).getByRole("link", { name: /Reservas/ });
      expect(inactivo.className).toContain("bg-white");
      expect(inactivo.className).toContain("border-[rgba(0,0,0,0.1)]");
      expect(inactivo.className).toContain("text-[#3a5259]");
      expect(inactivo.className).not.toContain("bg-[#193b44]");
    });

    it("en una subruta, sigue marcando activa la sección correcta (startsWith)", () => {
      usePathname.mockReturnValue("/admin/alojamientos/xyz");
      render(<AdminNav />);
      const { mobile } = navs();
      expect(within(mobile).getByRole("link", { name: /Alojamientos/ }).className).toContain(
        "bg-[#193b44]",
      );
    });
  });
});
