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

  it("muestra la píldora 'Volver al inicio' adentro de la tarjeta, arriba del título (2026-08-18, pedido del cliente)", () => {
    render(
      <AuthShell title="t" footer={null}>
        <p>x</p>
      </AuthShell>,
    );
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAttribute("aria-label", "Volver al inicio");
  });

  // Pedido del cliente (2026-08-18): en /registrarse/confirmar la píldora
  // dice "Volver al login" o "Volver al registro" según de dónde vino el
  // usuario — ConfirmarCuentaPage arma estos valores, ver su test/comentario.
  it("con volverLabel/volverHref, los usa en vez de los defaults", () => {
    render(
      <AuthShell title="t" footer={null} volverLabel="Volver al login" volverHref="/ingresar">
        <p>x</p>
      </AuthShell>,
    );
    const link = screen.getByRole("link", { name: "Volver al login" });
    expect(link).toHaveAttribute("href", "/ingresar");
    expect(link).toHaveAttribute("aria-label", "Volver al login");
    expect(screen.queryByText("Volver al inicio")).not.toBeInTheDocument();
  });

  describe("ancho de la tarjeta (2026-08-18, pedido del cliente: 460px fijo para el register, una sola columna)", () => {
    it("sin maxWidthClassName, usa max-w-sm por default", () => {
      const { container } = render(
        <AuthShell title="t" footer={null}>
          <p>x</p>
        </AuthShell>,
      );
      expect(container.querySelector(".rounded-3xl")).toHaveClass("max-w-sm");
    });

    it("con maxWidthClassName, lo usa en vez del default (RegistrarsePage: max-w-[460px])", () => {
      const { container } = render(
        <AuthShell title="t" footer={null} maxWidthClassName="max-w-[460px]">
          <p>x</p>
        </AuthShell>,
      );
      const card = container.querySelector(".rounded-3xl");
      expect(card).toHaveClass("max-w-[460px]");
    });
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

  it("acepta labelClassName para pisar el espaciado default del label (RegisterForm, 2026-08-17)", () => {
    render(<AuthField id="nombre" label="Usuario" labelClassName="mb-0.5" icon={<span />} name="nombre" type="text" />);
    expect(screen.getByText("Usuario")).toHaveClass("mb-0.5");
  });

  it("sin labelClassName, usa authLabelClass por default (LoginForm/ConfirmCodeForm sin cambios)", () => {
    render(<AuthField id="nombre" label="Usuario" icon={<span />} name="nombre" type="text" />);
    expect(screen.getByText("Usuario")).toHaveClass("mb-1");
  });

  describe("sin ícono (2026-08-18, pedido del cliente: sacar los íconos/símbolos de login y registro)", () => {
    it("sin la prop icon, no renderiza ningún ícono y el input no reserva el padding-left", () => {
      render(<AuthField id="nombre" label="Nombre" name="nombre" type="text" />);
      expect(screen.queryByTestId("icono")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Nombre").className).not.toContain("pl-7");
    });

    it("con icon, sí reserva el padding-left (LoginForm login sigue igual)", () => {
      render(<AuthField id="codigo" label="Código" icon={<span data-testid="icono" />} name="codigo" type="text" />);
      expect(screen.getByTestId("icono")).toBeInTheDocument();
      expect(screen.getByLabelText("Código").className).toContain("pl-7");
    });
  });
});
