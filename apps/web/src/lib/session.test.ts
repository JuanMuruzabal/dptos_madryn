import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));
vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

function fakeToken(payload: object): string {
  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url({ alg: "HS256" })}.${b64url(payload)}.firma`;
}

beforeEach(() => {
  vi.clearAllMocks();
  // getSession está envuelto en React.cache() (memoiza por "scope" de
  // render) — sin recargar el módulo entre tests, el mismo closure
  // memoizado podría devolver el resultado del test anterior en vez de
  // ejecutar la función de nuevo con el mock de cookies() de este test.
  vi.resetModules();
});

describe("createSession", () => {
  it("guarda la cookie httpOnly con el Max-Age derivado del exp del token", async () => {
    const { createSession, SESSION_COOKIE } = await import("./session");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeToken({ sub: "u-1", rol: "cliente", iat: 1000, exp });

    await createSession(token);

    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      token,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(exp * 1000),
      }),
    );
  });

  it("guarda la cookie igual (sin expires) si el token no se puede decodificar", async () => {
    const { createSession } = await import("./session");
    await createSession("token-invalido");

    expect(cookieStore.set).toHaveBeenCalledWith(
      "tm_session",
      "token-invalido",
      expect.objectContaining({ expires: undefined }),
    );
  });
});

describe("deleteSession", () => {
  it("borra la cookie de sesión", async () => {
    const { deleteSession, SESSION_COOKIE } = await import("./session");
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});

describe("getSessionToken", () => {
  it("devuelve el valor de la cookie si existe", async () => {
    cookieStore.get.mockReturnValue({ value: "el-token" });
    const { getSessionToken } = await import("./session");
    expect(await getSessionToken()).toBe("el-token");
  });

  it("devuelve null si no hay cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const { getSessionToken } = await import("./session");
    expect(await getSessionToken()).toBeNull();
  });
});

describe("getSession", () => {
  it("devuelve null sin cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });

  it("devuelve null si el token no se puede decodificar", async () => {
    cookieStore.get.mockReturnValue({ value: "no-es-un-jwt" });
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });

  it("devuelve null si el token ya expiró", async () => {
    const exp = Math.floor(Date.now() / 1000) - 3600; // hace 1 hora
    cookieStore.get.mockReturnValue({ value: fakeToken({ sub: "u-1", rol: "cliente", iat: 1000, exp }) });
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });

  it("devuelve usuarioId/rol con un token vigente", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    cookieStore.get.mockReturnValue({ value: fakeToken({ sub: "u-1", rol: "administrador", iat: 1000, exp }) });
    const { getSession } = await import("./session");
    expect(await getSession()).toEqual({ usuarioId: "u-1", rol: "administrador" });
  });
});
