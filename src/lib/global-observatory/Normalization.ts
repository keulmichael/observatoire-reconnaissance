import type { GlobalEventSource } from "../types";
import { normalizeText, stableId } from "./utils";

export class Normalization {
  static canonicalUrl(value?: string) {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((param) =>
        url.searchParams.delete(param)
      );
      return url.toString();
    } catch {
      return undefined;
    }
  }

  static externalId(sourceName: string, value?: string, fallback?: string) {
    return value?.trim() || stableId("external", `${sourceName}-${fallback ?? ""}`);
  }

  static title(value: string) {
    return normalizeText(value);
  }

  static source(input: GlobalEventSource): GlobalEventSource {
    return {
      ...input,
      url: this.canonicalUrl(input.url),
      title: input.title.trim(),
      summary: input.summary.trim(),
      excerpts: input.excerpts
        .map((excerpt) => ({ ...excerpt, text: excerpt.text.trim() }))
        .filter((excerpt) => excerpt.text.length > 0)
    };
  }
}
