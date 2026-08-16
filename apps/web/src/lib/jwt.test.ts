import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "./jwt";

function fakeToken(payload: object, header: object = { alg: "HS256", typ: "JWT" }): string {
  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url(header)}.${b64url(payload)}.firma-no-verificada`;
}

describe("decodeJwtPayload", () => {
  it("decodifica un payload válido", () => {
    const token = fakeToken({ sub: "user-123", rol: "cliente", iat: 1000, exp: 2000 });
    const payload = decodeJwtPayload(token);
    expect(payload).toEqual({ sub: "user-123", rol: "cliente", iat: 1000, exp: 2000 });
  });

  it("devuelve null si el token no tiene 3 partes separadas por punto", () => {
    expect(decodeJwtPayload("solo-una-parte")).toBeNull();
    expect(decodeJwtPayload("dos.partes")).toBeNull();
    expect(decodeJwtPayload("cuatro.partes.separadas.aca")).toBeNull();
  });

  it("devuelve null si la parte del medio no es base64url válido", () => {
    expect(decodeJwtPayload("header.@@@no-es-base64@@@.firma")).toBeNull();
  });

  it("devuelve null si el JSON decodificado no es un objeto válido", () => {
    const noEsJson = Buffer.from("esto no es json").toString("base64url");
    expect(decodeJwtPayload(`header.${noEsJson}.firma`)).toBeNull();
  });

  it("devuelve null si falta sub o exp, o tienen el tipo incorrecto", () => {
    expect(decodeJwtPayload(fakeToken({ rol: "cliente", iat: 1000, exp: 2000 }))).toBeNull(); // sin sub
    expect(decodeJwtPayload(fakeToken({ sub: "user-123", rol: "cliente", iat: 1000 }))).toBeNull(); // sin exp
    expect(decodeJwtPayload(fakeToken({ sub: 123, rol: "cliente", iat: 1000, exp: 2000 }))).toBeNull(); // sub no es string
    expect(decodeJwtPayload(fakeToken({ sub: "user-123", rol: "cliente", iat: 1000, exp: "2000" }))).toBeNull(); // exp no es number
  });
});
