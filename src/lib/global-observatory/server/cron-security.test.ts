import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-security";

describe("cron security", () => {
  it("rejects missing or wrong secrets", () => {
    expect(isAuthorizedCronRequest(new Request("http://localhost/api/cron/global-observatory"), "secret")).toBe(false);
    expect(isAuthorizedCronRequest(new Request("http://localhost/api/cron/global-observatory?secret=wrong"), "secret")).toBe(false);
  });

  it("accepts a matching bearer secret", () => {
    expect(isAuthorizedCronRequest(new Request("http://localhost/api/cron/global-observatory", {
      headers: { authorization: "Bearer secret" }
    }), "secret")).toBe(true);
  });
});
