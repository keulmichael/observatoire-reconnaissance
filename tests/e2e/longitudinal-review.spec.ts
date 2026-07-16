import { expect, test } from "@playwright/test";

const storageKey = "observatoire-reconnaissance:v1";
const now = "2026-07-16T20:30:00.000Z";

test("reviews longitudinal changes through edit, validate, and reject actions", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") await dialog.accept("donnees insuffisantes");
    else await dialog.accept();
  });

  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, value: makeData() });
  await page.goto("/");
  await page.getByRole("button", { name: /Études|Ã‰tudes/ }).click();
  await page.getByRole("button", { name: "Changements" }).click();

  await page.getByRole("button", { name: "Modifier" }).first().click();
  await page.getByRole("textbox", { name: "Titre" }).nth(1).fill("Titre modifie navigateur");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Proposition modifiee.")).toBeVisible();
  await expect(page.getByText("Modifiee").first()).toBeVisible();

  await page.getByRole("button", { name: "Valider comme transition" }).first().click();
  await expect(page.getByText("Transition validee et enregistree.")).toBeVisible();
  await page.getByRole("button", { name: "Validees" }).click();
  await expect(page.getByRole("button", { name: "Voir la transition" })).toBeVisible();

  const afterValidation = await page.evaluate((key) => {
    const study = JSON.parse(localStorage.getItem(key) ?? "{}").studies[0];
    return {
      status: study.longitudinalComparisons[0].status,
      transitions: study.transitions.length,
      states: study.states.length,
      deltaScores: study.deltaScores.length
    };
  }, storageKey);
  expect(afterValidation).toEqual({ status: "validated", transitions: 1, states: 2, deltaScores: 1 });

  await page.getByRole("button", { name: "A examiner" }).click();
  await page.getByRole("button", { name: "Rejeter" }).click();
  await expect(page.getByText("Proposition rejetee. Les observations sources sont conservees.")).toBeVisible();
  await page.getByRole("button", { name: "Rejetees" }).click();
  await expect(page.getByText("Rejetee", { exact: true })).toBeVisible();

  const afterRejection = await page.evaluate((key) => {
    const study = JSON.parse(localStorage.getItem(key) ?? "{}").studies[0];
    return {
      status: study.longitudinalComparisons[1].status,
      observations: study.observations.length,
      transitions: study.transitions.length
    };
  }, storageKey);
  expect(afterRejection).toEqual({ status: "rejected", observations: 2, transitions: 1 });
  expect(consoleErrors).toEqual([]);
});

function makeData() {
  return {
    version: 1,
    schemaVersion: 3,
    studies: [{
      id: "study-e2e",
      title: "Etude E2E",
      description: "Test",
      subject: "Incendies",
      startDate: "2026-07-16",
      status: "Observation ouverte",
      currentLevel: "Observation ouverte",
      notes: "",
      states: [],
      manifestations: [],
      transitions: [],
      recognitions: [],
      catalysts: [],
      emotionObservations: [],
      relations: [],
      timeline: [],
      map: { nodes: [], edges: [] },
      history: [],
      observations: [
        observation("obs-1", "Les gens restent impassibles face aux incendies.", "2026-07-15T10:00:00.000Z"),
        observation("obs-2", "Les habitants expriment une inquiétude pour les animaux et lancent des actions de solidarité.", "2026-07-16T10:00:00.000Z")
      ],
      openQuestions: [],
      structuredHistory: [],
      relationProposals: [],
      deltaScores: [],
      longitudinalComparisons: [comparison("comparison-1"), comparison("comparison-2")],
      createdAt: now,
      updatedAt: now
    }]
  };
}

function observation(id: string, rawText: string, createdAt: string) {
  return {
    id,
    studyId: "study-e2e",
    rawText,
    createdAt,
    updatedAt: createdAt,
    status: "active",
    detectedPeople: [],
    detectedManifestations: [],
    detectedEmotions: [],
    detectedCatalysts: [],
    detectedConcepts: [],
    detectedRelations: [],
    acceptedProposalIds: [],
    editedProposalIds: [],
    rejectedProposalIds: [],
    validationHistory: [],
    generatedManifestationIds: [],
    generatedEmotionIds: [],
    generatedCatalystIds: [],
    generatedRelationIds: [],
    generatedStateIds: [],
    generatedTransitionIds: [],
    generatedRecognitionIds: [],
    generatedTimelineEventIds: [],
    generatedDeltaIds: [],
    generatedLongitudinalComparisonIds: [],
    enginesExecuted: [],
    engineResultsSummary: [],
    methodologicalWarnings: [],
    sourceExcerpts: [rawText],
    openQuestions: []
  };
}

function comparison(id: string) {
  return {
    id,
    studyId: "study-e2e",
    sourceObservationIds: ["obs-1", "obs-2"],
    previousObservationId: "obs-1",
    currentObservationId: "obs-2",
    title: "Changement potentiel detecte",
    comparableObservations: [],
    dimensionsCompared: [{ key: "emotion", label: "Emotion exprimee", previous: ["faible emotion"], current: ["inquietude"] }],
    differences: [{ dimension: "emotion", label: "Emotion exprimee", previous: ["faible emotion"], current: ["inquietude"], summary: "Variation emotionnelle." }],
    proposedPreviousState: { scope: "collectif", evidenceLevel: "faible", summary: "faible emotion declaree", elements: ["faible emotion declaree"] },
    proposedCurrentState: { scope: "collectif", evidenceLevel: "moyen", summary: "inquietude pour les animaux", elements: ["inquietude pour les animaux"] },
    potentialTransition: "Changement potentiel detecte",
    missingData: [],
    methodologicalLimits: ["limite initiale"],
    confirmationQuestions: ["Confirmer ?"],
    sourceExcerpts: [{ observationId: "obs-1", excerpt: "Avant" }, { observationId: "obs-2", excerpt: "Apres" }],
    comparedAt: now,
    engine: "LongitudinalObservationEngine",
    engineVersion: "LongitudinalObservationEngine:v1",
    status: "proposed",
    confidence: "moyen",
    conclusion: "Changement detecte."
  };
}
