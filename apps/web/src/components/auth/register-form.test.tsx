import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./register-form";

const { registerAction } = vi.hoisted(() => ({ registerAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/auth", () => ({ registerAction }));

beforeEach(() => {
  vi.clearAllMocks();
  registerAction.mockResolvedValue({});
});

describe("RegisterForm", () => {
  it("renderiza todos los campos, con teléfono marcado como opcional", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono/)).not.toBeRequired();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("minLength", "8");
  });

  it("muestra el error del backend al fallar el registro", async () => {
    registerAction.mockResolvedValue({ error: "Ese email ya está registrado." });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese email ya está registrado.");
  });
});
