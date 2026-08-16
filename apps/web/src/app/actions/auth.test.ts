import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
const deleteSession = vi.fn();
vi.mock("@/lib/session", () => ({ createSession, deleteSession }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe("registerAction", () => {
  it("rechaza sin nombre", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction({}, formData({ email: "a@b.com", password: "password123" }));
    expect(resultado.error).toMatch(/nombre/i);
  });

  it("rechaza un email sin @", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData({ nombre: "Ana", email: "no-es-email", password: "password123" }),
    );
    expect(resultado.error).toMatch(/email/i);
  });

  it("rechaza una password corta", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData({ nombre: "Ana", email: "a@b.com", password: "corta" }),
    );
    expect(resultado.error).toMatch(/8 caracteres/);
  });

  it("propaga el error del backend (p. ej. email duplicado)", async () => {
    mockFetchOnce(409, { error: "ya existe una cuenta con ese email" });
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData({ nombre: "Ana", email: "a@b.com", password: "password123" }),
    );
    expect(resultado.error).toBe("ya existe una cuenta con ese email");
  });

  it("crea la sesión y redirige a /perfil en caso de éxito", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "el-token" });
    const { registerAction } = await import("./auth");

    await expect(
      registerAction({}, formData({ nombre: "Ana", email: "a@b.com", password: "password123" })),
    ).rejects.toThrow("REDIRECT:/perfil");

    expect(createSession).toHaveBeenCalledWith("el-token");
  });

  it("el teléfono es opcional", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { registerAction } = await import("./auth");

    await expect(
      registerAction({}, formData({ nombre: "Ana", email: "a@b.com", password: "password123" })),
    ).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.telefono).toBeUndefined();
  });
});

describe("loginAction", () => {
  it("rechaza sin email o password", async () => {
    const { loginAction } = await import("./auth");
    expect((await loginAction({}, formData({ email: "a@b.com" }))).error).toBeTruthy();
    expect((await loginAction({}, formData({ password: "x" }))).error).toBeTruthy();
  });

  it("propaga credenciales inválidas del backend", async () => {
    mockFetchOnce(401, { error: "email o contraseña inválidos" });
    const { loginAction } = await import("./auth");
    const resultado = await loginAction({}, formData({ email: "a@b.com", password: "mal" }));
    expect(resultado.error).toBe("email o contraseña inválidos");
  });

  it("crea la sesión y redirige a /perfil en caso de éxito", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "el-token" });
    const { loginAction } = await import("./auth");

    await expect(loginAction({}, formData({ email: "a@b.com", password: "password123" }))).rejects.toThrow(
      "REDIRECT:/perfil",
    );
    expect(createSession).toHaveBeenCalledWith("el-token");
  });
});

describe("logoutAction", () => {
  it("borra la sesión y redirige a /", async () => {
    const { logoutAction } = await import("./auth");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/");
    expect(deleteSession).toHaveBeenCalled();
  });
});
