import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountMenu } from "./account-menu";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname }));

afterEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue("/");
});

describe("AccountMenu", () => {
  it("el dropdown arranca cerrado", () => {
    render(<AccountMenu />);
    expect(screen.queryByText("Mi perfil")).not.toBeInTheDocument();
  });

  it("se abre al tocar el botón de cuenta", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
    expect(screen.getByText("Mi perfil")).toBeInTheDocument();
    expect(screen.getByText("Mi cronograma")).toBeInTheDocument();
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
  });

  it("se vuelve a cerrar al tocar el botón de nuevo", () => {
    render(<AccountMenu />);
    const boton = screen.getByRole("button", { name: /mi cuenta/i });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(screen.queryByText("Mi perfil")).not.toBeInTheDocument();
  });

  it("no muestra 'Panel admin' para un usuario que no es admin", () => {
    render(<AccountMenu esAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
    expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
  });

  it("muestra 'Panel admin' cuando esAdmin es true", () => {
    render(<AccountMenu esAdmin />);
    fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
    expect(screen.getByText("Panel admin")).toBeInTheDocument();
  });

  it("se cierra al clickear afuera del menú", () => {
    render(
      <div>
        <div data-testid="afuera">Afuera</div>
        <AccountMenu />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
    expect(screen.getByText("Mi perfil")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("afuera"));
    expect(screen.queryByText("Mi perfil")).not.toBeInTheDocument();
  });

  it("se cierra al elegir una opción del menú", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
    fireEvent.click(screen.getByText("Mi perfil"));
    expect(screen.queryByText("Mi cronograma")).not.toBeInTheDocument();
  });

  it("aria-expanded refleja el estado abierto/cerrado", () => {
    render(<AccountMenu />);
    const boton = screen.getByRole("button", { name: /mi cuenta/i });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  describe("recuadros del dropdown (2026-08-17, mismo estilo que el panel admin/mobile)", () => {
    it("cada opción tiene su ícono", () => {
      render(<AccountMenu esAdmin />);
      fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
      for (const nombre of ["Mi perfil", "Mi cronograma", "Panel admin", "Cerrar sesión"]) {
        const el = screen.getByText(nombre).closest("a, button");
        expect(el?.querySelector("svg")).toBeInTheDocument();
      }
    });

    it("marca la ruta activa con fondo verde petróleo y texto crema", () => {
      usePathname.mockReturnValue("/cronograma");
      render(<AccountMenu />);
      fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));

      const activo = screen.getByRole("link", { name: "Mi cronograma" });
      expect(activo.className).toContain("bg-[#193b44]");
      expect(activo.className).toContain("text-[#f5f1e8]");

      const inactivo = screen.getByRole("link", { name: "Mi perfil" });
      expect(inactivo.className).toContain("bg-white");
      expect(inactivo.className).not.toContain("bg-[#193b44]");
    });

    it("Cerrar sesión nunca se marca como activo", () => {
      usePathname.mockReturnValue("/perfil");
      render(<AccountMenu />);
      fireEvent.click(screen.getByRole("button", { name: /mi cuenta/i }));
      expect(screen.getByRole("button", { name: "Cerrar sesión" }).className).not.toContain(
        "bg-[#193b44]",
      );
    });
  });

  describe("variant inline (menú mobile, 2026-08-17)", () => {
    it("muestra las opciones directo, sin botón ni toggle", () => {
      render(<AccountMenu variant="inline" />);
      expect(screen.queryByRole("button", { name: /mi cuenta/i })).not.toBeInTheDocument();
      expect(screen.getByText("Mi perfil")).toBeInTheDocument();
      expect(screen.getByText("Mi cronograma")).toBeInTheDocument();
      expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
    });

    it("no muestra 'Panel admin' para un usuario que no es admin", () => {
      render(<AccountMenu variant="inline" esAdmin={false} />);
      expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
    });

    it("muestra 'Panel admin' cuando esAdmin es true", () => {
      render(<AccountMenu variant="inline" esAdmin />);
      expect(screen.getByText("Panel admin")).toBeInTheDocument();
    });

    it("ya no muestra el rótulo 'Mi cuenta' (sacado 2026-08-17), solo la línea divisoria", () => {
      const { container } = render(<AccountMenu variant="inline" />);
      expect(screen.queryByText("Mi cuenta")).not.toBeInTheDocument();
      expect(container.querySelector(".border-t")).toBeInTheDocument();
    });

    it("Mi perfil/Mi cronograma/Panel admin en blanco suave, con el ícono en su propio gris azulado", () => {
      render(<AccountMenu variant="inline" esAdmin />);
      for (const nombre of ["Mi perfil", "Mi cronograma", "Panel admin"]) {
        const link = screen.getByRole("link", { name: nombre });
        expect(link.className).toContain("text-[#eef2f2]");
        expect(link.querySelector("svg")).toHaveClass("text-[#8fb0b7]");
      }
    });

    it("Cerrar sesión tiene su propio recuadro delineado en coral", () => {
      render(<AccountMenu variant="inline" />);
      const logout = screen.getByRole("button", { name: "Cerrar sesión" });
      expect(logout.className).toContain("rounded-[12px]");
      expect(logout.className).toContain("border-[rgba(224,122,95,0.45)]");
      expect(logout.className).toContain("text-[#e8917a]");
    });

    it("marca con la barra coral la opción que coincide con la ruta actual", () => {
      usePathname.mockReturnValue("/cronograma");
      render(<AccountMenu variant="inline" />);

      const activo = screen.getByRole("link", { name: "Mi cronograma" });
      expect(activo.className).toContain("border-[#e07a5f]");
      expect(activo.className).toContain("bg-[rgba(224,122,95,0.16)]");

      const inactivo = screen.getByRole("link", { name: "Mi perfil" });
      expect(inactivo.className).toContain("border-transparent");
      expect(inactivo.className).not.toContain("border-[#e07a5f]");
    });

    it("ninguna opción se marca activa si la ruta no coincide con ninguna", () => {
      usePathname.mockReturnValue("/alojamiento");
      render(<AccountMenu variant="inline" esAdmin />);
      for (const nombre of ["Mi perfil", "Mi cronograma", "Panel admin"]) {
        expect(screen.getByRole("link", { name: nombre }).className).toContain("border-transparent");
      }
    });

    it("Cerrar sesión nunca se marca como activo, aunque no es una ruta", () => {
      usePathname.mockReturnValue("/perfil");
      render(<AccountMenu variant="inline" />);
      const logout = screen.getByRole("button", { name: "Cerrar sesión" });
      expect(logout.className).not.toContain("border-[#e07a5f]");
    });
  });
});
