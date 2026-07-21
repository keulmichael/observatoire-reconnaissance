import { expect, test } from "@playwright/test";

const storageKey = "observatoire-reconnaissance:v1";
const now = "2026-07-21T10:00:00.000Z";

test("collects, displays, filters, analyzes and creates a study from global watch", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.addInitScript(({ key, value }) => {
    if (!window.localStorage.getItem("global-watch-e2e-initialized")) {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("global-watch-e2e-initialized", "1");
    }
  }, { key: storageKey, value: makeData() });
  await page.route("**/api/global-observatory/collect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ report: makeReport() })
    });
  });

  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Veille mondiale" }).click();
  await expect(page.getByText("Observatoire mondial")).toBeVisible();

  await page.getByRole("button", { name: /Actualiser les actualites/ }).click();
  await expect(page.getByRole("heading", { name: /Election presidentielle et reconnaissance publique/ })).toBeVisible();
  await expect(page.getByText("BBC World").first()).toBeVisible();
  await expect(page.getByText("Articles recuperes")).toBeVisible();

  await page.getByLabel("Pays").selectOption("France");
  await expect(page.getByRole("heading", { name: /Election presidentielle et reconnaissance publique/ })).toBeVisible();

  await page.getByRole("button", { name: /Analyser/ }).first().click();
  await expect(page.getByText("Analyse reflexive")).toBeVisible();
  await expect(page.getByText("Traçabilite des claims")).toBeVisible();

  await page.getByRole("button", { name: /Creer une etude/ }).first().click();
  await expect(page.getByRole("textbox", { name: "Titre" })).toHaveValue("Etude: Election presidentielle et reconnaissance publique");
  await expect.poll(async () => page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    return data.globalObservatory?.events?.length ?? 0;
  }, storageKey)).toBe(1);

  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Veille mondiale" }).click();
  await expect(page.getByRole("heading", { name: /Election presidentielle et reconnaissance publique/ })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

function makeData() {
  return {
    version: 1,
    schemaVersion: 5,
    studies: [],
    globalObservatory: {
      sources: [{
        id: "source-bbc-world",
        name: "BBC World",
        type: "rss",
        enabled: true,
        endpoint: "https://feeds.bbci.co.uk/news/world/rss.xml",
        reliability: 0.72,
        countries: ["Monde"],
        categories: ["Politique"],
        updateFrequencyMinutes: 120
      }],
      events: [],
      learningSignals: [],
      collectionLogs: [],
      mapPoints: [],
      dashboard: {
        analyzedEvents: 0,
        activeEvents: 0,
        createdStudies: 0,
        frequentCategories: [],
        representedCountries: [],
        emergingThemes: [],
        studiedPhenomena: [],
        topStudyEvents: [],
        trends: []
      }
    }
  };
}

function makeReport() {
  const event = {
    id: "event-election",
    title: "Election presidentielle et reconnaissance publique",
    normalizedTitle: "election presidentielle et reconnaissance publique",
    summary: "Plusieurs sources decrivent une contestation de legitimite apres une election.",
    country: "France",
    startedAt: now,
    updatedAt: now,
    status: "active",
    categories: ["Politique", "Société"],
    themes: ["election", "legitimite", "reconnaissance"],
    sourceIds: ["article-bbc"],
    sources: [{
      id: "article-bbc",
      externalId: "bbc-1",
      connectorId: "source-bbc-world",
      connectorName: "BBC World",
      title: "Election presidentielle et reconnaissance publique",
      url: "https://feeds.bbci.co.uk/news/world-1",
      publishedAt: now,
      country: "France",
      language: "fr",
      summary: "Extrait autorise sur la contestation de legitimite.",
      categories: ["Politique"],
      authors: [],
      excerpts: [{
        id: "excerpt-bbc",
        text: "Extrait autorise sur la contestation de legitimite.",
        location: "rss:description",
        claimIds: ["claim-summary"]
      }],
      collectedAt: now
    }],
    mergeCandidates: [],
    analysis: {
      eventId: "event-election",
      summary: "Plusieurs sources decrivent une contestation de legitimite apres une election.",
      observedPhenomenon: "Phenomenon observable: Election presidentielle et reconnaissance publique.",
      stakes: "Observer la reconnaissance politique et les conflits de representation.",
      recognitionMechanisms: ["Reconnaissance institutionnelle", "Conflit de representation"],
      observableDimensions: ["Politique", "Société"],
      researchQuestions: ["Quels mecanismes de reconnaissance sont visibles ?"],
      hypotheses: ["Hypothese: cet evenement pourrait rendre observable un conflit de representation."],
      similarStudySearch: "Rechercher des etudes anterieures.",
      uncertainElements: ["Hypothese a verifier."],
      sourceAgreement: {
        confirmedByMultipleSources: [],
        singleSourceOnly: ["Election presidentielle et reconnaissance publique"],
        contested: [],
        unknown: ["Etudes similaires non verifiees."]
      },
      claims: [{
        id: "claim-summary",
        text: "Plusieurs sources decrivent une contestation de legitimite apres une election.",
        status: "fait rapporté",
        sourceIds: ["article-bbc"],
        excerptIds: ["excerpt-bbc"],
        confidence: 0.7
      }],
      generatedAt: now,
      engineVersion: "GlobalObservatory:v1"
    },
    interest: {
      level: "Élevée",
      stars: 4,
      score: 67,
      explanation: "Score explique.",
      factors: []
    },
    studySuggestion: {
      id: "suggestion-election",
      eventId: "event-election",
      title: "Etude: Election presidentielle et reconnaissance publique",
      rationale: "Observer la reconnaissance politique.",
      categories: ["Politique", "Société"],
      hypotheses: ["Hypothese: cet evenement pourrait rendre observable un conflit de representation."],
      sourceIds: ["article-bbc"],
      claimIds: ["claim-summary"],
      status: "proposed",
      createdStudyIds: [],
      createdAt: now,
      updatedAt: now
    },
    learningWeight: 0,
    createdStudyIds: []
  };
  return {
    id: "collection-e2e",
    startedAt: now,
    completedAt: now,
    sourcesRequested: ["source-bbc-world"],
    sourcesSucceeded: ["source-bbc-world"],
    sourcesFailed: [],
    articlesFetched: 1,
    newEvents: 1,
    duplicateArticles: 0,
    mergedArticles: 0,
    ambiguousMerges: 0,
    mode: "manual",
    sources: event.sources,
    events: [event]
  };
}
