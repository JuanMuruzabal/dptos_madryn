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

    it("muestra el rótulo 'Mi cuenta' separando el bloque del resto", () => {
      render(<AccountMenu variant="inline" />);
      expect(screen.getByText("Mi cuenta")).toBeInTheDocument();
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
