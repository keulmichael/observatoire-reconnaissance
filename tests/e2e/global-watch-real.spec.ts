import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_REAL_NEWS !== "1", "Real RSS collection is executed manually with RUN_REAL_NEWS=1.");

test("collects at least one real RSS article through the server route", async ({ request }) => {
  const response = await request.post("/api/global-observatory/collect", {
    data: {
      maxItemsPerSource: 2
    },
    timeout: 30_000
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload.report.articlesFetched).toBeGreaterThan(0);
  expect(payload.report.events.length).toBeGreaterThan(0);
  expect(payload.report.events[0].sources[0].url).toMatch(/^https:\/\//);
});
