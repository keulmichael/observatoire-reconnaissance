import { describe, expect, it } from "vitest";
import type { GlobalSourceConnector } from "../../types";
import { RssConnector, parseFeed } from "./RssConnector";
import { validateRssEndpoint } from "./rss-security";

const connector: GlobalSourceConnector = {
  id: "source-bbc-world",
  name: "BBC World",
  type: "rss",
  endpoint: "https://feeds.bbci.co.uk/news/world/rss.xml",
  enabled: true,
  reliability: 0.7,
  countries: ["Monde"],
  categories: ["Politique"],
  updateFrequencyMinutes: 120
};

describe("RssConnector", () => {
  it("parses RSS metadata without full article content", () => {
    const articles = parseFeed(`
      <rss><channel><item>
        <title>Election et reconnaissance institutionnelle</title>
        <link>https://feeds.bbci.co.uk/news/a?utm_source=x</link>
        <guid>abc</guid>
        <pubDate>Tue, 21 Jul 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[Un court extrait autorise. <strong>HTML</strong>]]></description>
      </item></channel></rss>
    `, connector, "2026-07-21T10:05:00.000Z");
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe("https://feeds.bbci.co.uk/news/a");
    expect(articles[0].summary).toBe("Un court extrait autorise. HTML");
  });

  it("ignores invalid dates and empty content", () => {
    const articles = parseFeed(`
      <rss><channel><item>
        <title></title>
        <pubDate>not-a-date</pubDate>
      </item></channel></rss>
    `, connector, "2026-07-21T10:05:00.000Z");
    expect(articles).toEqual([]);
  });

  it("returns an error when a source is unavailable", async () => {
    const rss = new RssConnector(async () => ({ ok: false, status: 503, text: async () => "" } as Response));
    const result = await rss.fetchSource(connector, { timeoutMs: 1000, maxItems: 5, now: "2026-07-21T10:00:00.000Z" });
    expect(result.error).toContain("HTTP 503");
  });

  it("rejects non-allowed RSS hosts", () => {
    expect(() => validateRssEndpoint({ ...connector, endpoint: "https://127.0.0.1/feed.xml" })).toThrow();
    expect(() => validateRssEndpoint({ ...connector, endpoint: "https://evil.example/feed.xml" })).toThrow();
  });
});
