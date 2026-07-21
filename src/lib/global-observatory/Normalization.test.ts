import { describe, expect, it } from "vitest";
import { Normalization } from "./Normalization";

describe("Normalization", () => {
  it("canonicalizes URLs and removes tracking parameters", () => {
    expect(Normalization.canonicalUrl("https://example.com/a?utm_source=x&id=1#section")).toBe("https://example.com/a?id=1");
  });

  it("normalizes titles for duplicate detection", () => {
    expect(Normalization.title("Élection présidentielle: tensions!")).toBe("election presidentielle tensions");
  });
});
