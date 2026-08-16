import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountMenu } from "./account-menu";

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
});
