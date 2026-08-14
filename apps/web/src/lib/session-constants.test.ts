import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "./session-constants";

describe("SESSION_COOKIE", () => {
  it("es el nombre de cookie esperado", () => {
    expect(SESSION_COOKIE).toBe("tm_session");
  });
});
