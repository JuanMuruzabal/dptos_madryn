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
  it("renderiza los campos de email y contraseña", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("muestra el error del backend al fallar el login", async () => {
    loginAction.mockResolvedValue({ error: "Email o contraseña incorrectos." });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "a@a.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
  });
});
