import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthField, AuthShell } from "./auth-shell";

describe("AuthShell", () => {
  it("renderiza el eyebrow, título, subtítulo, contenido y footer", () => {
    render(
      <AuthShell eyebrow="Bienvenido" title="Ingresá" subtitle="a tu cuenta" footer={<span>¿Sos nuevo?</span>}>
        <p>formulario</p>
      </AuthShell>,
    );
    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ingresá" })).toBeInTheDocument();
    expect(screen.getByText("a tu cuenta")).toBeInTheDocument();
    expect(screen.getByText("formulario")).toBeInTheDocument();
    expect(screen.getByText("¿Sos nuevo?")).toBeInTheDocument();
  });

  describe("fondo con foto (2026-08-17, TR-048)", () => {
    it("con backgroundUrl, la variable CSS --auth-bg-image apunta a esa URL", () => {
      const { container } = render(
        <AuthShell eyebrow="e" title="t" subtitle="s" footer={null} backgroundUrl="https://x/foto.jpg">
          <p>x</p>
        </AuthShell>,
      );
      const main = container.querySelector("main") as HTMLElement;
      expect(main.style.getPropertyValue("--auth-bg-image")).toBe('url("https://x/foto.jpg")');
    });

    it("sin backgroundUrl, la variable CSS --auth-bg-image es 'none' (cae al gradiente de marca)", () => {
      const { container } = render(
        <AuthShell eyebrow="e" title="t" subtitle="s" footer={null}>
          <p>x</p>
        </AuthShell>,
      );
      const main = container.querySelector("main") as HTMLElement;
      expect(main.style.getPropertyValue("--auth-bg-image")).toBe("none");
    });
  });
});

describe("AuthField", () => {
  it("asocia el label al input por id, y muestra el ícono", () => {
    render(
      <AuthField id="usuario" label="Usuario" icon={<span data-testid="icono" />} name="usuario" type="text" />,
    );
    expect(screen.getByLabelText("Usuario")).toHaveAttribute("id", "usuario");
    expect(screen.getByTestId("icono")).toBeInTheDocument();
  });

  it("reenvía props del input sin tocar (value/onChange/placeholder/required)", () => {
    const onChange = () => {};
    render(
      <AuthField
        id="email"
        label="Email"
        icon={<span />}
        name="email"
        type="email"
        value="a@b.com"
        onChange={onChange}
        placeholder="tu email"
        required
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveValue("a@b.com");
    expect(input).toHaveAttribute("placeholder", "tu email");
    expect(input).toBeRequired();
  });
});
