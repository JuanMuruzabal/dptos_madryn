import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { SESSION_COOKIE } from "@/lib/session-constants";

function requestA(path: string, cookie?: string): NextRequest {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (cookie) req.cookies.set(SESSION_COOKIE, cookie);
  return req;
}

describe("proxy", () => {
  it("sin cookie, una ruta protegida redirige a /ingresar", () => {
    const res = proxy(requestA("/perfil"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ingresar");
  });

  it("sin cookie, /admin también redirige a /ingresar", () => {
    const res = proxy(requestA("/admin/reservas"));
    expect(res.headers.get("location")).toContain("/ingresar");
  });

  it("con cookie, una ruta protegida no redirige", () => {
    const res = proxy(requestA("/perfil", "token-valido"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("con cookie, /ingresar redirige a /perfil", () => {
    const res = proxy(requestA("/ingresar", "token-valido"));
    expect(res.headers.get("location")).toContain("/perfil");
  });

  it("con cookie, /registrarse también redirige a /perfil", () => {
    const res = proxy(requestA("/registrarse", "token-valido"));
    expect(res.headers.get("location")).toContain("/perfil");
  });

  it("sin cookie, /ingresar no redirige (deja ver el formulario)", () => {
    const res = proxy(requestA("/ingresar"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("una ruta pública sin cookie no redirige", () => {
    const res = proxy(requestA("/alojamiento"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
