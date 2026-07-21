import { describe, expect, it } from "vitest";
import { SourceManager } from "../SourceManager";
import { RealNewsCollectionService } from "./RealNewsCollectionService";

describe("RealNewsCollectionService", () => {
  it("collects real RSS-shaped metadata through the server service", async () => {
    const service = new RealNewsCollectionService();
    const report = await service.collect({
      state: SourceManager.createInitialState("2026-07-21T10:00:00.000Z"),
      sourceIds: ["source-bbc-world"],
      now: "2026-07-21T10:00:00.000Z",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => `<rss><channel><item>
          <title>Public trust in health recommendations changes</title>
          <link>https://feeds.bbci.co.uk/news/world-1</link>
          <guid>world-1</guid>
          <pubDate>Tue, 21 Jul 2026 09:00:00 GMT</pubDate>
          <description>Researchers report a change in public trust toward institutions.</description>
        </item></channel></rss>`
      } as Response)
    });
    expect(report.articlesFetched).toBe(1);
    expect(report.newEvents).toBe(1);
    expect(report.events[0].sources[0].url).toBe("https://feeds.bbci.co.uk/news/world-1");
  });

  it("reports SSRF-protected sources as failures", async () => {
    const state = SourceManager.createInitialState("2026-07-21T10:00:00.000Z");
    const service = new RealNewsCollectionService();
    const report = await service.collect({
      state: {
        ...state,
        sources: [{ ...state.sources[0], endpoint: "https://localhost/feed.xml" }]
      },
      sourceIds: [state.sources[0].id],
      now: "2026-07-21T10:00:00.000Z"
    });
    expect(report.sourcesFailed[0].error).toContain("Hote RSS non autorise");
  });
});
