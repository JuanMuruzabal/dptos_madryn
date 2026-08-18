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
  it("renderiza los campos de email y contraseña, no 'Usuario' (TR-048)", () => {
    render(<LoginForm />);
    // Aclarado por el cliente: el login es mail + contraseña, no usuario +
    // contraseña ("Usuario" queda solo en RegisterForm).
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("name", "email");
    expect(screen.queryByLabelText("Usuario")).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Email"), "a@a.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
  });
});
