import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";

const { loginAction } = vi.hoisted(() => ({ loginAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/auth", () => ({ loginAction }));

beforeEach(() => {
  vi.clearAllMocks();
  loginAction.mockResolvedValue({});
});

describe("LoginForm", () => {
  it("renderiza los campos de usuario y contraseña (TR-048)", () => {
    render(<LoginForm />);
    // "Usuario" sigue siendo el input de email de siempre, solo
    // relabeleado — ver el comentario en login-form.tsx.
    const usuario = screen.getByLabelText("Usuario");
    expect(usuario).toHaveAttribute("type", "email");
    expect(usuario).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("muestra el link de '¿Olvidaste tu contraseña?'", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toBeInTheDocument();
  });

  it("muestra el botón de Google, solo visual (sin funcionalidad todavía)", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Ingresá con Google" })).toBeInTheDocument();
  });

  it("muestra el error del backend al fallar el login", async () => {
    loginAction.mockResolvedValue({ error: "Email o contraseña incorrectos." });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Usuario"), "a@a.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
  });
});
