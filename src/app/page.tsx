"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  GitCompare,
  GitBranch,
  Globe2,
  Home,
  Import,
  Layers3,
  LogOut,
  Lock,
  MapPin,
  Microscope,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trash2
} from "lucide-react";
import { ReflexiveMap } from "@/components/reflexive-map";
import { Badge, Field, Panel, StatCard, Textarea } from "@/components/ui";
import { useObservatory } from "@/lib/use-observatory";
import {
  buildAnalysis,
  buildDashboard,
  buildTimeline,
  compareStates,
  exportStudy
} from "@/lib/analytics";
import type { AIConnectionStatus, AIObservationResult, AppView, GlobalCollectionReport, GlobalObservedEvent, GlobalObservatoryState, HistoricalImportRequest, HistoricalImportSession, HistoricalObservatoryStatistics, HistoricalSearchFilters, ObservationAISettings, ObservationAnalysisDraft, Study, StudySynthesis, TheoryEvidenceRelation, TheoryRevisionProposal, TransitionStage } from "@/lib/types";
import { RecognitionCharts } from "@/components/recognition-charts";
import { ObservationAnalysis } from "@/components/journal/ObservationAnalysis";
import { ObservationFollowup } from "@/components/journal/ObservationFollowup";
import { ObservationInput } from "@/components/journal/ObservationInput";
import { DeltaEngine } from "@/lib/engines/DeltaEngine";
import { ReflexivityDashboardEngine } from "@/lib/engines/ReflexivityDashboardEngine";
import { StateDifferenceEngine } from "@/lib/engines/StateDifferenceEngine";
import { TheoryEngine, reflexiveCycleSteps } from "@/lib/engines/TheoryEngine";
import { TrajectoryEngine } from "@/lib/engines/TrajectoryEngine";
import { parseObservation } from "@/lib/parser/ObservationParser";
import { extractCanonicalDimensions } from "@/lib/parser/DimensionExtractor";
import { analyzeWithObservationAI, defaultAISettings } from "@/lib/ai/ObservationAI";
import { emotionOriginLabel, inferStateType } from "@/lib/scientific-model";
import { analysisScopeSummary, dataForAnalysisScope } from "@/lib/analysis-scope";
import {
  editLongitudinalComparison,
  normalizeComparison,
  normalizeStatus,
  reanalyzeLongitudinalComparisons,
  rejectLongitudinalComparison,
  validateLongitudinalComparison,
  type LongitudinalEditPatch
} from "@/lib/longitudinal-review";
import { synthesisFilename } from "@/lib/engines/study-synthesis";
import {
  buildLocalStorageBackup,
  diagnoseBrowserStorage,
  OBSERVATORY_STORAGE_KEYS,
  type LocalStorageDiagnosticEntry
} from "@/lib/local-storage-diagnostics";
import { HistoricalImportEngine } from "@/lib/global-observatory/HistoricalImportEngine";
import { eventProvenanceStatus, provenanceLabel, sourceProvenanceStatus } from "@/lib/global-observatory/Provenance";
import type { LocalMigrationDiagnostic } from "@/lib/local-migration-diagnostics";

const views: Array<{ id: AppView; label: string; icon: React.ElementType }> = [
  { id: "journal", label: "Journal d'Observation", icon: ClipboardList },
  { id: "followup", label: "Suivi", icon: Eye },
  { id: "global-watch", label: "Veille mondiale", icon: Globe2 },
  { id: "dashboard", label: "Tableau de bord", icon: Home },
  { id: "studies", label: "Études", icon: BookOpen },
  { id: "states", label: "États", icon: Brain },
  { id: "transitions", label: "Transitions Δ", icon: GitBranch },
  { id: "state-comparison", label: "Comparaison d'états", icon: GitCompare },
  { id: "understanding-evolution", label: "Evolution d'une compréhension", icon: TrendingUp },
  { id: "reflexivity-engine", label: "Moteur de Réflexivité", icon: Microscope },
  { id: "map", label: "Carte réflexive", icon: Network },
  { id: "emotions", label: "Émotions", icon: Activity },
  { id: "attitudes-representations", label: "Representations", icon: SlidersHorizontal },
  { id: "multidimensional-changes", label: "Transformations multidimensionnelles", icon: GitCompare },
  { id: "catalysts", label: "Catalyseurs", icon: Sparkles },
  { id: "recognitions", label: "Reconnaissances", icon: Search },
  { id: "timeline", label: "Chronologie", icon: CalendarDays },
  { id: "analysis", label: "Analyse", icon: BarChart3 },
  { id: "local-diagnostics", label: "Diagnostic local", icon: FileText },
  { id: "theory-lab", label: "Laboratoire theorique", icon: Microscope },
  { id: "recognition-theorem", label: "Theoreme de la Reconnaissance", icon: GitBranch },
  { id: "reflexive-cycle", label: "Cycle reflexif", icon: RefreshCw },
  { id: "testimony-network", label: "Reseau des temoignages", icon: Network },
  { id: "reflexive-signatures", label: "Signatures reflexives", icon: Brain },
  { id: "theory-evolution", label: "Evolution de la theorie", icon: TrendingUp }
];

const discernmentQuestions = [
  "S'agit-il d'un fait ou d'une interprétation ?",
  "La relation est-elle observée ou seulement supposée ?",
  "Existe-t-il une confirmation indépendante ?",
  "Existe-t-il une explication plus simple ?",
  "Le changement est-il durable ?",
  "La personne concernée a-t-elle formulé elle-même cette reconnaissance ?",
  "La reconnaissance transforme-t-elle réellement le langage ou l'action ?"
];

const transitionStages: TransitionStage[] = [
  "État initial",
  "Perturbation",
  "Recherche",
  "Nouvelle relation",
  "Reconnaissance",
  "Transformation",
  "Stabilisation",
  "Transmission"
];

const appBuildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.1",
  commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local",
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? "build local"
};

export default function ObservatoryApp() {
  const {
    data,
    selectedStudyId,
    selectedStudy,
    selectStudy,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    isDeletingStudy,
    studyNotice,
    resetDemoData,
    importJson,
    exportAll,
    updateMap,
    observationDrafts,
    aiSettings,
    aiObservationResults,
    updateAISettings,
    saveAIObservationResult,
    refreshTheoryProposals,
    linkObservationToTheory,
    acceptTheoryRevision,
    setTheoryProposalStatus,
    createTheoryPrediction,
    linkPredictionObservation,
    generateStudySynthesis,
    collectGlobalEvents,
    runHistoricalImport,
    analyzeGlobalEvent,
    setGlobalSourceEnabled,
    createStudyFromGlobalEvent,
    abandonGlobalStudySuggestion,
    saveObservationDraft,
    integrateObservationDraft,
    authEmail,
    authConfigured,
    syncStatus,
    syncError,
    signIn,
    signUp,
    signOut,
    migrationSummary,
    compareLocalWithRemote,
    migrateLocalToRemote,
    removeLocalBackup
  } = useObservatory();
  const [view, setView] = useState<AppView>("journal");
  const [query, setQuery] = useState("");
  const [observationText, setObservationText] = useState("");
  const [currentDraft, setCurrentDraft] = useState<ObservationAnalysisDraft | null>(null);
  const [integrationNotice, setIntegrationNotice] = useState("");
  const [targetStudyId, setTargetStudyId] = useState<string | "new">("new");
  const [targetStudySearch, setTargetStudySearch] = useState("");
  const [aiConnectionStatus, setAIConnectionStatus] = useState<AIConnectionStatus | null>(null);
  const [aiConnectionTesting, setAIConnectionTesting] = useState(false);
  const [lastAnalysisNotice, setLastAnalysisNotice] = useState("Analyse locale uniquement");
  const effectiveAISettings = aiSettings ?? defaultAISettings;
  const selectedAnalysisScope = useMemo(
    () => selectedStudyId ? { mode: "selected-study" as const, studyId: selectedStudyId } : { mode: "all-studies" as const },
    [selectedStudyId]
  );
  const allStudiesAnalysisScope = useMemo(() => ({ mode: "all-studies" as const }), []);
  const selectedStudyData = useMemo(
    () => dataForAnalysisScope(data, selectedAnalysisScope),
    [data, selectedAnalysisScope]
  );
  const dashboard = useMemo(() => buildDashboard(dataForAnalysisScope(data, allStudiesAnalysisScope)), [data, allStudiesAnalysisScope]);
  const analysis = useMemo(() => buildAnalysis(dataForAnalysisScope(data, allStudiesAnalysisScope)), [data, allStudiesAnalysisScope]);
  const reflexivityDashboard = useMemo(() => ReflexivityDashboardEngine.build(selectedStudyData), [selectedStudyData]);
  const theoryAssessments = useMemo(() => TheoryEngine.assess(data), [data]);
  const reflexiveSignatures = useMemo(() => TheoryEngine.buildReflexiveSignatures(data), [data]);
  const timeline = useMemo(() => buildTimeline(selectedStudy), [selectedStudy]);

  const studies = data.studies.filter((study) =>
    `${study.title} ${study.subject} ${study.description}`.toLowerCase().includes(query.toLowerCase())
  );

  async function analyzeObservation() {
    const result = effectiveAISettings.mode === "ai-assisted"
      ? await analyzeObservationOnServer(observationText, effectiveAISettings, aiObservationResults)
      : await analyzeWithObservationAI({
          draft: parseObservation(observationText),
          settings: effectiveAISettings,
          cache: aiObservationResults
        });
    saveObservationDraft(result.draft);
    if (effectiveAISettings.keepResponses) saveAIObservationResult(result.result);
    setCurrentDraft(result.draft);
    setTargetStudyId(suggestStudies(result.draft, data.studies)[0]?.id ?? "new");
    const notice = analysisNotice(result.result);
    setLastAnalysisNotice(notice);
    setIntegrationNotice(result.result.error ? `${notice} : ${result.result.error}` : "");
  }

  async function testAIConnection() {
    setAIConnectionTesting(true);
    try {
      const response = await fetch(`/api/ai/status?model=${encodeURIComponent(effectiveAISettings.model)}`, {
        cache: "no-store"
      });
      const status = (await response.json()) as AIConnectionStatus;
      setAIConnectionStatus(status);
    } catch (error) {
      setAIConnectionStatus({
        configured: false,
        provider: "openai",
        reachable: false,
        model: effectiveAISettings.model,
        mode: "assisted",
        message: "Test de connexion impossible",
        latency: null,
        checkedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Erreur de test"
      });
    } finally {
      setAIConnectionTesting(false);
    }
  }

  function updateCurrentDraft(draft: ObservationAnalysisDraft) {
    setCurrentDraft(draft);
    saveObservationDraft(draft);
  }

  function validateObservation() {
    if (!currentDraft) return;
    if (hasPendingProposals(currentDraft)) {
      window.alert("Validez, modifiez ou ignorez chaque proposition avant l'integration.");
      return;
    }
    const result = integrateObservationDraft(currentDraft, targetStudyId);
    setCurrentDraft({ ...currentDraft, status: "validated" });
    setIntegrationNotice(
      result.warnings.length
        ? result.warnings.join(" ")
        : targetStudyId === "new"
          ? "Observation integree a une nouvelle etude."
          : "Observation ajoutee a l'etude existante."
    );
    setView("studies");
  }

  return (
    <main className="min-h-screen px-4 py-4 text-stone-100 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[280px_1fr_320px]">
        <aside className="glass sticky top-4 z-20 h-fit rounded-lg p-4">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-goldSoft/80">Instrument local</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">
              Observatoire de la Reconnaissance
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Observer le chemin Δ de la compréhension sans le confondre avec une preuve de vérité.
            </p>
          </div>
          <AuthPanel
            configured={authConfigured}
            userEmail={authEmail}
            syncStatus={syncStatus}
            syncError={syncError}
            onSignIn={signIn}
            onSignUp={signUp}
            onSignOut={signOut}
            migrationSummary={migrationSummary}
            onCompare={compareLocalWithRemote}
            onMigrate={migrateLocalToRemote}
            onRemoveLocalBackup={removeLocalBackup}
          />
          <nav className="grid gap-1" aria-label="Navigation principale">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {item.id === "journal" ? <p className="mb-1 mt-2 px-3 text-xs uppercase tracking-[0.18em] text-stone-500">Mode Observation</p> : null}
                  {item.id === "dashboard" ? <p className="mb-1 mt-4 px-3 text-xs uppercase tracking-[0.18em] text-stone-500">Mode Expert</p> : null}
                  {item.id === "theory-lab" ? <p className="mb-1 mt-4 px-3 text-xs uppercase tracking-[0.18em] text-stone-500">Mode Recherche</p> : null}
                  <button
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                      view === item.id
                        ? "bg-gold/18 text-goldSoft"
                        : "text-stone-300 hover:bg-white/7 hover:text-white"
                    }`}
                    onClick={() => setView(item.id)}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {item.label}
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="mt-5 grid gap-2">
            <button className="flex items-center justify-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={createStudy}>
              <Plus className="h-4 w-4" aria-hidden /> Nouvelle étude
            </button>
            <button className="flex items-center justify-center gap-2 rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={exportAll}>
              <Download className="h-4 w-4" aria-hidden /> Export global
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200">
              <Import className="h-4 w-4" aria-hidden /> Import JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJson(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={resetDemoData}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Réinitialiser la démo
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="glass mb-4 rounded-lg p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-goldSoft/80">Chemin observable Δ</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{views.find((item) => item.id === view)?.label}</h2>
              </div>
              <div className="flex max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-stone-400" aria-hidden />
                <input
                  aria-label="Filtrer les études"
                  className="w-full bg-transparent text-sm text-white placeholder:text-stone-500 focus:outline-none"
                  placeholder="Filtrer les études, sujets, observations..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </header>
          {query.trim() ? (
            <GlobalSearchResults
              query={query}
              data={data}
              onOpenStudy={(studyId) => {
                selectStudy(studyId);
                setView("studies");
              }}
            />
          ) : null}

          {view === "journal" && (
            <Journal
              observationText={observationText}
              setObservationText={setObservationText}
              currentDraft={currentDraft}
              studies={data.studies}
              targetStudyId={targetStudyId}
              targetStudySearch={targetStudySearch}
              integrationNotice={integrationNotice}
              analyzeObservation={analyzeObservation}
              updateCurrentDraft={updateCurrentDraft}
              setTargetStudyId={setTargetStudyId}
              setTargetStudySearch={setTargetStudySearch}
              validateObservation={validateObservation}
              aiSettings={effectiveAISettings}
              onAISettingsChange={updateAISettings}
              aiConnectionStatus={aiConnectionStatus}
              aiConnectionTesting={aiConnectionTesting}
              onTestAIConnection={testAIConnection}
              lastAnalysisNotice={lastAnalysisNotice}
            />
          )}
          {view === "followup" && <ObservationFollowup drafts={observationDrafts} study={selectedStudy} />}
          {view === "global-watch" && (
            <GlobalWatch
              state={data.globalObservatory}
              onCollect={collectGlobalEvents}
              onHistoricalImport={runHistoricalImport}
              onAnalyze={analyzeGlobalEvent}
              onCreateStudy={(eventId) => {
                const studyId = createStudyFromGlobalEvent(eventId);
                if (studyId) setView("studies");
              }}
              onAbandon={abandonGlobalStudySuggestion}
              onToggleSource={setGlobalSourceEnabled}
            />
          )}
          {view === "dashboard" && (
            <>
              <AnalysisScope scope="all" studies={data.studies} />
              <Dashboard dashboard={dashboard} studies={studies} selectStudy={selectStudy} setView={setView} />
            </>
          )}
          {view === "studies" && (
            <Studies
              studies={studies}
              selectedStudyId={selectedStudyId}
              selectStudy={selectStudy}
              updateStudy={updateStudy}
              deleteStudy={deleteStudy}
              duplicateStudy={duplicateStudy}
              generateStudySynthesis={generateStudySynthesis}
              isDeletingStudy={isDeletingStudy}
              studyNotice={studyNotice}
            />
          )}
          {view === "states" && <ScopedStudyView study={selectedStudy}><States study={selectedStudy} /></ScopedStudyView>}
          {view === "transitions" && <ScopedStudyView study={selectedStudy}><Transitions study={selectedStudy} /></ScopedStudyView>}
          {view === "state-comparison" && <ScopedStudyView study={selectedStudy}><StateComparison study={selectedStudy} /></ScopedStudyView>}
          {view === "understanding-evolution" && <ScopedStudyView study={selectedStudy}><UnderstandingEvolution study={selectedStudy} /></ScopedStudyView>}
          {view === "reflexivity-engine" && (
            <>
              <AnalysisScope scope="selected" study={selectedStudy} />
              <ReflexivityEngineDashboard dashboard={reflexivityDashboard} />
            </>
          )}
          {view === "map" && selectedStudy && <ReflexiveMap study={selectedStudy} onChange={updateMap} />}
          {view === "emotions" && <ScopedStudyView study={selectedStudy}><Emotions study={selectedStudy} /></ScopedStudyView>}
          {view === "attitudes-representations" && <ScopedStudyView study={selectedStudy}><AttitudesRepresentations study={selectedStudy} /></ScopedStudyView>}
          {view === "multidimensional-changes" && <ScopedStudyView study={selectedStudy}><MultidimensionalChanges study={selectedStudy} /></ScopedStudyView>}
          {view === "catalysts" && <ScopedStudyView study={selectedStudy}><Catalysts study={selectedStudy} /></ScopedStudyView>}
          {view === "recognitions" && <ScopedStudyView study={selectedStudy}><Recognitions study={selectedStudy} /></ScopedStudyView>}
          {view === "timeline" && <Timeline events={timeline} />}
          {view === "analysis" && (
            <>
              <AnalysisScope scope="all" studies={data.studies} />
              <Analysis analysis={analysis} />
            </>
          )}
          {view === "local-diagnostics" && <LocalDiagnosticsView />}
          {view === "theory-lab" && (
            <TheoryLab
              data={data}
              assessments={theoryAssessments}
              onRefreshProposals={refreshTheoryProposals}
              onLinkObservation={linkObservationToTheory}
              onCreatePrediction={createTheoryPrediction}
            />
          )}
          {view === "recognition-theorem" && <RecognitionTheorem data={data} assessments={theoryAssessments} />}
          {view === "reflexive-cycle" && <ReflexiveCycleView studies={data.studies} />}
          {view === "testimony-network" && <TestimonyNetwork data={data} />}
          {view === "reflexive-signatures" && <ReflexiveSignaturesView signatures={reflexiveSignatures} />}
          {view === "theory-evolution" && (
            <TheoryEvolution
              data={data}
              onAccept={acceptTheoryRevision}
              onReject={(id) => setTheoryProposalStatus(id, "rejected")}
              onDefer={(id) => setTheoryProposalStatus(id, "deferred")}
              onLinkPredictionObservation={linkPredictionObservation}
            />
          )}
        </section>

        <aside className="glass h-fit rounded-lg p-4 lg:sticky lg:top-4">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-goldSoft" aria-hidden />
            <div>
              <h2 className="font-semibold text-white">Mode discernement</h2>
              <p className="mt-1 text-sm leading-6 text-stone-300">
                Panneau permanent pour distinguer observation, hypothèse et confirmation.
              </p>
            </div>
          </div>
          <ul className="grid gap-2">
            {discernmentQuestions.map((question) => (
              <li key={question} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-stone-200">
                {question}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
            Les émotions sont des indicateurs de transition, pas des preuves de vérité.
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Version {appBuildInfo.version} · commit {appBuildInfo.commit} · build {formatBuildDate(appBuildInfo.buildDate)}
          </p>
        </aside>
      </div>
    </main>
  );
}

function LocalDiagnosticsView() {
  const [entries, setEntries] = useState<LocalStorageDiagnosticEntry[]>([]);
  const [scannedAt, setScannedAt] = useState("");
  const [scanError, setScanError] = useState("");

  async function refresh() {
    setScanError("");
    try {
      const result = await diagnoseBrowserStorage();
      setEntries(result);
      setScannedAt(new Date().toISOString());
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Diagnostic local impossible.");
    }
  }

  function exportBackup() {
    const backup = buildLocalStorageBackup(entries);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `observatoire-diagnostic-local-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const presentEntries = entries.filter((entry) => entry.present);
  const totals = presentEntries.reduce(
    (sum, entry) => ({
      studies: sum.studies + entry.studies,
      observations: sum.observations + entry.observations,
      drafts: sum.drafts + entry.drafts
    }),
    { studies: 0, observations: 0, drafts: 0 }
  );
  const personalCandidates = entries.filter((entry) =>
    entry.present
    && entry.likelyObservatoryData
    && !entry.technicalOnly
    && !entry.ownerIds.some((ownerId) => ownerId.startsWith("obs-"))
    && (entry.studies > 0 || entry.observations > 0 || entry.drafts > 0)
  );

  return (
    <div className="grid gap-4">
      <Panel title="Diagnostic local non destructif">
        <div className="grid gap-3 text-sm leading-6 text-stone-300">
          <p>
            Cette vue lit les stockages locaux candidats sur ce navigateur. Elle ne migre rien, ne supprime rien et ne modifie pas la base.
          </p>
          <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.04] p-3 text-xs text-stone-300">
            <p className="font-medium text-white">Cles localStorage connues ou historiques recherchees</p>
            <p className="break-all">{OBSERVATORY_STORAGE_KEYS.join(", ")}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Etudes detectees" value={totals.studies} />
            <StatCard label="Observations detectees" value={totals.observations} />
            <StatCard label="Brouillons detectes" value={totals.drafts} />
          </div>
          {personalCandidates.length ? (
            <p className="rounded-md border border-gold/30 bg-gold/10 p-3 text-goldSoft">
              Donnees candidates trouvees hors comptes techniques obs-*. Exportez une sauvegarde avant toute migration manuelle.
            </p>
          ) : (
            <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-stone-300">
              Aucune donnee personnelle candidate n&apos;est identifiee dans les cles lisibles. Les cles techniques Supabase/auth restent separees.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Relire le stockage
            </button>
            <button className="flex items-center gap-2 rounded-md border border-gold/30 px-3 py-2 text-xs text-goldSoft" disabled={!presentEntries.length} onClick={exportBackup}>
              <Download className="h-3.5 w-3.5" aria-hidden /> Exporter sauvegarde JSON
            </button>
          </div>
          {scanError ? <p className="text-xs text-amber-200">{scanError}</p> : null}
          {scannedAt ? <p className="text-xs text-stone-500">Derniere lecture : {scannedAt}</p> : null}
        </div>
      </Panel>

      <div className="grid gap-3">
        {entries.map((entry) => (
          <Panel key={`${entry.storage}:${entry.key}`} title={entry.key}>
            <div className="grid gap-3 text-sm text-stone-300">
              <div className="flex flex-wrap gap-2">
                <Badge>{entry.storage}</Badge>
                <Badge>{entry.present ? "Presente" : "Absente"}</Badge>
                <Badge>{entry.readable ? "JSON lisible" : "Non JSON"}</Badge>
                <Badge>{entry.technicalOnly ? "Technique" : "Donnees candidates"}</Badge>
                <Badge>{entry.bytes} caracteres</Badge>
                {entry.schemaVersion ? <Badge>schema {entry.schemaVersion}</Badge> : null}
                {entry.version ? <Badge>version {entry.version}</Badge> : null}
              </div>
              {entry.parseError ? <p className="text-xs text-amber-200">{entry.parseError}</p> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard label="Etudes" value={entry.studies} />
                <StatCard label="Observations" value={entry.observations} />
                <StatCard label="Brouillons" value={entry.drafts} />
              </div>
              {entry.ownerIds.length ? (
                <p className="break-all text-xs text-stone-400">OwnerId detectes : {entry.ownerIds.join(", ")}</p>
              ) : null}
              {entry.preview.length ? (
                <div className="overflow-x-auto rounded-md border border-white/10">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-white/[0.04] text-stone-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Titre</th>
                        <th className="px-3 py-2 font-medium">Creation</th>
                        <th className="px-3 py-2 font-medium">Mise a jour</th>
                        <th className="px-3 py-2 font-medium">Observations</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.preview.map((study, index) => (
                        <tr key={`${entry.key}-${study.id ?? index}`} className="border-t border-white/10">
                          <td className="px-3 py-2 text-stone-100">{study.title}</td>
                          <td className="px-3 py-2">{study.createdAt ?? "-"}</td>
                          <td className="px-3 py-2">{study.updatedAt ?? "-"}</td>
                          <td className="px-3 py-2">{study.observations}</td>
                          <td className="px-3 py-2">{study.ownerId ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {entry.draftPreview.length ? (
                <div className="overflow-x-auto rounded-md border border-white/10">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="bg-white/[0.04] text-stone-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Brouillon</th>
                        <th className="px-3 py-2 font-medium">Creation</th>
                        <th className="px-3 py-2 font-medium">Mise a jour</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.draftPreview.map((draft, index) => (
                        <tr key={`${entry.key}-draft-${draft.id ?? index}`} className="border-t border-white/10">
                          <td className="px-3 py-2 text-stone-100">{draft.title}</td>
                          <td className="px-3 py-2">{draft.createdAt ?? "-"}</td>
                          <td className="px-3 py-2">{draft.updatedAt ?? "-"}</td>
                          <td className="px-3 py-2">{draft.ownerId ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </Panel>
        ))}
        {!presentEntries.length ? (
          <Panel title="Aucune cle candidate">
            <p className="text-sm text-stone-300">Aucune cle locale presente liee a l&apos;Observatoire n&apos;a ete detectee sur cette origine.</p>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Journal({
  observationText,
  setObservationText,
  currentDraft,
  studies,
  targetStudyId,
  targetStudySearch,
  integrationNotice,
  analyzeObservation,
  updateCurrentDraft,
  setTargetStudyId,
  setTargetStudySearch,
  validateObservation,
  aiSettings,
  onAISettingsChange,
  aiConnectionStatus,
  aiConnectionTesting,
  onTestAIConnection,
  lastAnalysisNotice
}: {
  observationText: string;
  setObservationText: (value: string) => void;
  currentDraft: ObservationAnalysisDraft | null;
  studies: Study[];
  targetStudyId: string | "new";
  targetStudySearch: string;
  integrationNotice: string;
  analyzeObservation: () => void | Promise<void>;
  updateCurrentDraft: (draft: ObservationAnalysisDraft) => void;
  setTargetStudyId: (value: string | "new") => void;
  setTargetStudySearch: (value: string) => void;
  validateObservation: () => void;
  aiSettings: ObservationAISettings;
  onAISettingsChange: (settings: ObservationAISettings) => void;
  aiConnectionStatus: AIConnectionStatus | null;
  aiConnectionTesting: boolean;
  onTestAIConnection: () => void | Promise<void>;
  lastAnalysisNotice: string;
}) {
  return (
    <div className="grid gap-4">
      <ObservationModeIndicator settings={aiSettings} lastAnalysisNotice={lastAnalysisNotice} currentDraft={currentDraft} />
      <ObservationAISettingsPanel
        settings={aiSettings}
        onChange={onAISettingsChange}
        status={aiConnectionStatus}
        testing={aiConnectionTesting}
        onTest={onTestAIConnection}
      />
      <ObservationInput value={observationText} onChange={setObservationText} onAnalyze={analyzeObservation} />
      {currentDraft ? (
        <ObservationAnalysis
          draft={currentDraft}
          studies={studies}
          targetStudyId={targetStudyId}
          targetStudySearch={targetStudySearch}
          onTargetStudyChange={setTargetStudyId}
          onTargetStudySearchChange={setTargetStudySearch}
          onChange={updateCurrentDraft}
          onValidate={validateObservation}
          aiSettings={aiSettings}
        />
      ) : null}
      {integrationNotice ? (
        <div className="rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
          {integrationNotice}
        </div>
      ) : null}
    </div>
  );
}

function TheoryLab({
  data,
  assessments,
  onRefreshProposals,
  onLinkObservation,
  onCreatePrediction
}: {
  data: ReturnType<typeof useObservatory>["data"];
  assessments: ReturnType<typeof TheoryEngine.assess>;
  onRefreshProposals: () => void;
  onLinkObservation: (input: {
    studyId: string;
    observationId: string;
    theoryId: string;
    theoryElementId: string;
    relation: TheoryEvidenceRelation;
    reasoningSummary: string;
  }) => void;
  onCreatePrediction: (prediction: Omit<NonNullable<ReturnType<typeof useObservatory>["data"]["theoryPredictions"]>[number], "id" | "createdAt" | "updatedAt" | "status" | "futureObservationIds">) => void;
}) {
  const theories = data.theories ?? [];
  const observations = allObservationChoices(data.studies);
  const [theoryId, setTheoryId] = useState(theories[0]?.id ?? "");
  const selectedTheory = theories.find((theory) => theory.id === theoryId) ?? theories[0];
  const [elementId, setElementId] = useState(selectedTheory?.elements[0]?.id ?? "");
  const selectedElement = selectedTheory?.elements.find((element) => element.id === elementId) ?? selectedTheory?.elements[0];
  const [observationKey, setObservationKey] = useState(observations[0]?.key ?? "");
  const [relation, setRelation] = useState<TheoryEvidenceRelation>("supports");
  const [reasoningSummary, setReasoningSummary] = useState("Lien theorique propose et valide par l'utilisateur.");
  const [predictionText, setPredictionText] = useState("");
  const assessment = assessments.find((item) => item.theoryElementId === selectedElement?.id && item.theoryId === selectedTheory?.id);

  function submitEvidenceLink() {
    const observation = observations.find((item) => item.key === observationKey);
    if (!selectedTheory || !selectedElement || !observation) return;
    onLinkObservation({
      studyId: observation.studyId,
      observationId: observation.observationId,
      theoryId: selectedTheory.id,
      theoryElementId: selectedElement.id,
      relation,
      reasoningSummary
    });
  }

  function submitPrediction() {
    if (!selectedTheory || !selectedElement || !predictionText.trim()) return;
    onCreatePrediction({
      formulation: predictionText,
      theoryId: selectedTheory.id,
      theoryElementIds: [selectedElement.id],
      applicationContext: "Observation future a documenter.",
      expectedResult: "Resultat attendu a tester, sans certitude.",
      observableCriteria: ["observation source", "extrait", "validation utilisateur"],
      temporalWindow: "non definie",
      author: "Utilisateur",
      limitations: ["Prediction theorique prudente, non prophetique."]
    });
    setPredictionText("");
  }

  return (
    <div className="grid gap-4">
      <Panel title="Separation des niveaux">
        <div className="grid gap-3 md:grid-cols-4">
          <LevelCard title="Empirique" text="Observations, extraits, evenements, emotions, comportements." />
          <LevelCard title="Analytique" text="Etats, transitions, comparaisons et Delta." />
          <LevelCard title="Theorique" text="Axiomes, principes, propositions, theoremes et corollaires." />
          <LevelCard title="Predictif" text="Predictions a tester ulterieurement." />
        </div>
        <p className="mt-4 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
          Flux obligatoire : Observation {"->"} Analyse {"->"} Interpretation proposee {"->"} Lien theorique propose {"->"} Validation utilisateur {"->"} Mise a jour eventuelle du soutien theorique.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Theories">
          <div className="grid gap-3">
            {theories.map((theory) => (
              <button
                key={theory.id}
                className={`rounded-md border p-3 text-left ${selectedTheory?.id === theory.id ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04]"}`}
                onClick={() => {
                  setTheoryId(theory.id);
                  setElementId(theory.elements[0]?.id ?? "");
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{theory.title}</p>
                  <Badge>{theory.versions.at(-1)?.version ?? "1.0"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-300">{theory.summary}</p>
                <p className="mt-2 text-xs text-stone-500">Liee a : {theory.linkedTheoryIds.join(", ") || "aucune theorie"}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Elements theoriques">
          {selectedTheory ? (
            <div className="grid gap-2">
              {selectedTheory.elements.map((element) => (
                <button
                  key={element.id}
                  className={`rounded-md border p-3 text-left ${selectedElement?.id === element.id ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04]"}`}
                  onClick={() => setElementId(element.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">{element.title}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{element.type}</Badge>
                      <Badge>{element.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{element.statement}</p>
                </button>
              ))}
            </div>
          ) : <SmartEmpty text="Aucune theorie initialisee." />}
        </Panel>
      </div>

      {selectedTheory && selectedElement ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Evaluation prudente">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Observations" value={assessment?.observationCount ?? 0} />
              <StatCard label="Soutiens" value={assessment?.confirmations ?? 0} />
              <StatCard label="Contradictions" value={assessment?.contradictions ?? 0} />
              <StatCard label="Enrichissements" value={assessment?.enrichments ?? 0} />
            </div>
            <p className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
              {assessment?.cautiousSummary ?? "Les donnees sont insuffisantes."}
            </p>
            <TraceBlock title="Questions ouvertes" items={assessment?.openQuestions ?? selectedElement.unresolvedQuestions} />
            <TraceBlock title="Limites" items={selectedElement.limitations} />
          </Panel>

          <Panel title="Lier une observation a la theorie">
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Observation source</span>
                <select className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" value={observationKey} onChange={(event) => setObservationKey(event.target.value)}>
                  {observations.map((item) => <option className="bg-ink" key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Effet theorique valide par l&apos;utilisateur</span>
                <select className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" value={relation} onChange={(event) => setRelation(event.target.value as TheoryEvidenceRelation)}>
                  <option className="bg-ink" value="supports">confirme / soutient</option>
                  <option className="bg-ink" value="contradicts">contredit</option>
                  <option className="bg-ink" value="enriches">enrichit</option>
                  <option className="bg-ink" value="not-concerned">ne concerne pas</option>
                </select>
              </label>
              <Textarea label="Interpretation proposee" value={reasoningSummary} onChange={setReasoningSummary} />
              <button className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night" onClick={submitEvidenceLink}>
                Valider le lien theorique
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Propositions de revision">
          <button className="mb-3 rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={onRefreshProposals}>
            Analyser les observations et proposer
          </button>
          <RevisionProposalList proposals={data.theoryRevisionProposals ?? []} />
        </Panel>
        <Panel title="Predictions">
          <Textarea label="Nouvelle prediction prudente" value={predictionText} onChange={setPredictionText} />
          <button className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night" onClick={submitPrediction}>
            Creer une prediction a tester
          </button>
          <div className="mt-4 grid gap-2">
            {(data.theoryPredictions ?? []).map((prediction) => (
              <div key={prediction.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{prediction.formulation}</p>
                  <Badge>{prediction.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-stone-400">{prediction.expectedResult}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LevelCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-300">{text}</p>
    </div>
  );
}

function RevisionProposalList({ proposals }: { proposals: TheoryRevisionProposal[] }) {
  if (!proposals.length) return <p className="text-sm text-stone-500">Aucune proposition generee.</p>;
  return (
    <div className="grid gap-2">
      {proposals.slice(0, 8).map((proposal) => (
        <div key={proposal.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-white">{proposal.kind}</p>
            <div className="flex flex-wrap gap-2">
              <Badge>{proposal.status}</Badge>
              <Badge>{Math.round(proposal.confidence * 100)} %</Badge>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-300">{proposal.reasoningSummary}</p>
          <p className="mt-2 text-xs text-stone-500">Sources : {proposal.observationIds.join(", ") || "aucune observation"}</p>
        </div>
      ))}
    </div>
  );
}

function RecognitionTheorem({
  data,
  assessments
}: {
  data: ReturnType<typeof useObservatory>["data"];
  assessments: ReturnType<typeof TheoryEngine.assess>;
}) {
  const theory = (data.theories ?? []).find((item) => item.id === "theory-reflexive-recognition");
  const theorem = theory?.elements.find((item) => item.id === "theorem-general-cycle");
  const corollary = theory?.elements.find((item) => item.id === "corollary-universal-consciousness");
  const assessment = assessments.find((item) => item.theoryElementId === theorem?.id);
  if (!theory || !theorem) return <EmptyState />;
  return (
    <div className="grid gap-4">
      <Panel title="Version actuelle">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{theory.versions.at(-1)?.version ?? "1.0"}</Badge>
          <Badge>{theorem.status}</Badge>
          <Badge>{theorem.confidenceLabel}</Badge>
        </div>
        <p className="mt-4 text-lg leading-8 text-white">{theorem.statement}</p>
        {corollary ? <p className="mt-3 text-sm leading-6 text-goldSoft">{corollary.statement}</p> : null}
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Arguments">
          <TraceBlock title="Observations utilisees" items={assessment?.evidenceLinks.filter((link) => link.relation === "supports").map((link) => link.observationId) ?? []} />
          <TraceBlock title="Etudes concernees" items={assessment?.evidenceLinks.map((link) => link.studyId) ?? []} />
        </Panel>
        <Panel title="Contre-arguments">
          <TraceBlock title="Contradictions" items={assessment?.evidenceLinks.filter((link) => link.relation === "contradicts").map((link) => link.reasoningSummary) ?? []} />
          <TraceBlock title="Zones d'incertitude" items={assessment?.uncertaintyZones ?? []} />
        </Panel>
      </div>
      <Panel title="Graphique de progression">
        <div className="grid gap-2 md:grid-cols-6">
          {theory.versions.map((version, index) => (
            <div key={version.id} className="rounded-md border border-gold/25 bg-gold/10 p-3">
              <p className="text-xs text-stone-400">Version {version.version}</p>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(15, ((index + 1) / theory.versions.length) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-goldSoft">{version.reason}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Historique">
        <TraceBlock title="Versions" items={theory.versions.map((version) => `${version.version} - ${version.createdAt} - ${version.reason}`)} />
      </Panel>
    </div>
  );
}

function ReflexiveCycleView({ studies }: { studies: Study[] }) {
  const observations = allObservationChoices(studies);
  const positioned = observations.filter((item) => item.record.reflexiveCycleStepIds?.length);
  return (
    <div className="grid gap-4">
      <Panel title="Cycle reflexif">
        <div className="grid gap-2 md:grid-cols-6">
          {reflexiveCycleSteps.map((step) => (
            <div key={step} className="rounded-md border border-gold/25 bg-gold/10 p-3 text-center text-sm font-medium text-goldSoft">
              {cycleStepLabel(step)}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Position des observations">
        {positioned.length ? (
          <div className="grid gap-2">
            {positioned.map((item) => (
              <div key={item.key} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="font-medium text-white">{item.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.record.reflexiveCycleStepIds?.map((step) => <Badge key={step}>{cycleStepLabel(step)}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">Position dans le cycle non determinable.</p>
        )}
      </Panel>
    </div>
  );
}

function TestimonyNetwork({ data }: { data: ReturnType<typeof useObservatory>["data"] }) {
  const people = uniqueStrings(data.studies.flatMap((study) => (study.observations ?? []).flatMap((observation) => observation.detectedPeople.map((person) => person.label))));
  return (
    <div className="grid gap-4">
      <Panel title="Carte des temoignages">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => (
            <div key={person} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <p className="font-medium text-white">{person}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>temoin</Badge>
                <Badge>miroir</Badge>
                <Badge>observateur</Badge>
                <Badge>observe</Badge>
                <Badge>acteur</Badge>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Liens reciproques documentes">
        {(data.reciprocalTestimonies ?? []).length ? (
          <div className="grid gap-2">
            {(data.reciprocalTestimonies ?? []).map((item) => (
              <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="font-medium text-white">{item.witnessA} {"->"} {item.witnessB}</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">{item.testimonyAToB}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{item.effectStatusOnB}</Badge>
                  <Badge>{item.effectStatusOnA}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">Aucun temoignage reciproque valide. Aucun effet interieur n&apos;est deduit automatiquement.</p>
        )}
      </Panel>
    </div>
  );
}

function ReflexiveSignaturesView({ signatures }: { signatures: ReturnType<typeof TheoryEngine.buildReflexiveSignatures> }) {
  return (
    <Panel title="Signatures reflexives descriptives">
      {signatures.length ? (
        <div className="grid gap-3">
          {signatures.map((signature) => (
            <div key={signature.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{signature.personLabel}</p>
                <Badge>profil relationnel descriptif</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TraceBlock title="Temoignages associes" items={signature.testimonyTypes} />
                <TraceBlock title="Emotions documentees" items={signature.documentedEmotions} />
                <TraceBlock title="Contradictions recurrentes" items={signature.recurrentContradictions} />
                <TraceBlock title="Themes reveles" items={signature.revealedThemes} />
                <TraceBlock title="Transformations liees" items={signature.linkedTransformations} />
                <TraceBlock title="Limites" items={signature.sampleLimitations} />
              </div>
              <p className="mt-3 text-xs text-stone-500">Sorties interdites : {signature.prohibitedOutputs.join(", ")}.</p>
            </div>
          ))}
        </div>
      ) : (
        <SmartEmpty text="Aucune signature descriptive ne peut etre calculee sans personnes detectees dans les observations." />
      )}
    </Panel>
  );
}

function TheoryEvolution({
  data,
  onAccept,
  onReject,
  onDefer,
  onLinkPredictionObservation
}: {
  data: ReturnType<typeof useObservatory>["data"];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDefer: (id: string) => void;
  onLinkPredictionObservation: (predictionId: string, observationId: string) => void;
}) {
  const observations = allObservationChoices(data.studies);
  return (
    <div className="grid gap-4">
      <Panel title="Versions de theorie">
        <div className="grid gap-3">
          {(data.theories ?? []).flatMap((theory) => theory.versions.map((version) => (
            <div key={version.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{theory.title} - Version {version.version}</p>
                <Badge>{version.author}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-300">{version.reason}</p>
              <p className="mt-2 text-xs text-stone-500">Observations : {version.observationIds.join(", ") || "aucune"}</p>
            </div>
          )))}
        </div>
      </Panel>
      <Panel title="Propositions a valider">
        <div className="grid gap-3">
          {(data.theoryRevisionProposals ?? []).map((proposal) => (
            <div key={proposal.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{proposal.kind}</p>
                <Badge>{proposal.status}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-300">{proposal.reasoningSummary}</p>
              <TraceBlock title="Extraits" items={proposal.sourceExcerpts} />
              {proposal.status === "proposed" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={() => onAccept(proposal.id)}>Accepter</button>
                  <button className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200" onClick={() => onReject(proposal.id)}>Rejeter</button>
                  <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => onDefer(proposal.id)}>Differer</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Predictions et observations futures">
        <div className="grid gap-3">
          {(data.theoryPredictions ?? []).map((prediction) => (
            <div key={prediction.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{prediction.formulation}</p>
                <Badge>{prediction.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-stone-400">{prediction.applicationContext}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {observations.slice(0, 4).map((observation) => (
                  <button key={observation.key} className="rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200" onClick={() => onLinkPredictionObservation(prediction.id, observation.observationId)}>
                    Lier {observation.observationId}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-stone-500">Observations futures liees : {prediction.futureObservationIds.join(", ") || "aucune"}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function allObservationChoices(studies: Study[]) {
  return studies.flatMap((study) =>
    (study.observations ?? []).map((record) => ({
      key: `${study.id}:${record.id}`,
      studyId: study.id,
      observationId: record.id,
      label: `${study.title} - ${record.rawText.slice(0, 70)}`,
      record
    }))
  );
}

function cycleStepLabel(step: string) {
  const labels: Record<string, string> = {
    relation: "Relation",
    testimony: "Temoignage",
    solitude: "Solitude",
    recognition: "Reconnaissance",
    transformation: "Transformation",
    "new-relation": "Nouvelle relation"
  };
  return labels[step] ?? step;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function ScopedStudyView({ study, children }: { study?: Study; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <AnalysisScope scope="selected" study={study} />
      {children}
    </div>
  );
}

function AuthPanel({
  configured,
  userEmail,
  syncStatus,
  syncError,
  onSignIn,
  onSignUp,
  onSignOut,
  migrationSummary,
  onCompare,
  onMigrate,
  onRemoveLocalBackup
}: {
  configured: boolean;
  userEmail: string | null;
  syncStatus: string;
  syncError: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  migrationSummary: () => { hasLocalData: boolean; studies: number; observations: number; drafts: number; exportData: unknown };
  onCompare: () => Promise<LocalMigrationDiagnostic>;
  onMigrate: () => Promise<unknown>;
  onRemoveLocalBackup: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<LocalMigrationDiagnostic | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const summary = migrationSummary();
  const migrationRisk = summarizeMigrationExport(summary.exportData);

  useEffect(() => {
    let cancelled = false;
    async function refreshDiagnostic() {
      if (!configured || !userEmail || !summary.hasLocalData) {
        setDiagnostic(null);
        return;
      }
      setDiagnosticLoading(true);
      try {
        const result = await onCompare();
        if (!cancelled) setDiagnostic(result);
      } catch {
        if (!cancelled) setDiagnostic(null);
      } finally {
        if (!cancelled) setDiagnosticLoading(false);
      }
    }
    void refreshDiagnostic();
    return () => {
      cancelled = true;
    };
  }, [configured, onCompare, summary.hasLocalData, summary.observations, summary.studies, summary.drafts, userEmail]);

  async function exportLocalBackup(prefix: string) {
    const blob = new Blob([JSON.stringify(summary.exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function refreshComparison() {
    setBusy(true);
    setNotice("");
    try {
      const result = await onCompare();
      setDiagnostic(result);
      setNotice(migrationStatusNotice(result));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comparaison impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function removeLocalCopy() {
    const latest = await onCompare();
    setDiagnostic(latest);
    if (!latest.canDeleteLocal) {
      throw new Error("Suppression locale bloquee : les donnees correspondantes ne sont pas confirmees dans Supabase.");
    }
    const confirmation = window.prompt(
      [
        "Confirmez la suppression de la copie locale uniquement.",
        "Les donnees Supabase ne seront pas supprimees.",
        "Tapez SUPPRIMER LA COPIE LOCALE pour continuer."
      ].join("\n")
    );
    if (confirmation !== "SUPPRIMER LA COPIE LOCALE") {
      setNotice("Suppression locale annulee.");
      return;
    }
    await exportLocalBackup("observatoire-dernier-export-avant-suppression-locale");
    await onRemoveLocalBackup();
    setDiagnostic(null);
    setNotice("Copie locale supprimee. Aucune donnee Supabase n'a ete supprimee.");
  }

  async function run(action: "signin" | "signup" | "migrate" | "signout" | "compare" | "export" | "remove-local") {
    setBusy(true);
    setNotice("");
    try {
      if (action === "signin") await onSignIn(email, password);
      if (action === "signup") await onSignUp(email, password);
      if (action === "compare") {
        await refreshComparison();
        return;
      }
      if (action === "export") {
        await exportLocalBackup("observatoire-sauvegarde-locale");
        setNotice("Sauvegarde JSON exportee.");
      }
      if (action === "remove-local") {
        await removeLocalCopy();
        return;
      }
      if (action === "migrate") {
        if (migrationRisk.hasObsTechnicalData) {
          throw new Error("Migration bloquee : des ownerId obs-* ont ete detectes dans les donnees locales.");
        }
        const latest = await onCompare();
        setDiagnostic(latest);
        if (!latest.canMigrateMissing) {
          throw new Error("Migration bloquee : aucune donnee locale manquante n'a ete detectee.");
        }
        const confirmed = window.confirm(
          [
            `Confirmer l'import des donnees locales manquantes vers ${userEmail ?? "le compte connecte"} ?`,
            `${latest.missing.studies} etude(s), ${latest.missing.observations} observation(s), ${latest.missing.drafts} brouillon(s) manquant(s).`,
            migrationRisk.duplicateIds ? `${migrationRisk.duplicateIds} doublon(s) d'identifiant detecte(s) localement.` : "Aucun doublon d'identifiant local detecte.",
            "Une sauvegarde JSON sera telechargee avant l'import. Aucun import integral aveugle ne sera lance."
          ].join("\n")
        );
        if (!confirmed) {
          setNotice("Migration annulee. Aucune donnee n'a ete importee.");
          return;
        }
        await exportLocalBackup("observatoire-export-avant-migration");
        await onMigrate();
        const refreshed = await onCompare();
        setDiagnostic(refreshed);
      }
      if (action === "signout") await onSignOut();
      setNotice(action === "migrate"
        ? `Import termine vers ${userEmail ?? "le compte connecte"}. Les donnees locales sont conservees jusqu'a suppression explicite.`
        : "Operation terminee.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operation impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Lock className="h-4 w-4 text-goldSoft" aria-hidden />
          Compte
        </div>
        <Badge>{syncLabel(syncStatus)}</Badge>
      </div>
      {!configured ? (
        <p className="text-xs leading-5 text-amber-200">Supabase non configure. Le cache local reste disponible, mais la base distante ne peut pas etre source de verite.</p>
      ) : userEmail ? (
        <div className="grid gap-2">
          <p className="truncate text-xs text-stone-300">{userEmail}</p>
          <button className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200" disabled={busy} onClick={() => void run("signout")}>
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Deconnexion
          </button>
          {diagnosticLoading ? <p className="text-xs leading-5 text-stone-400">Comparaison de la sauvegarde locale avec le compte...</p> : null}
          {diagnostic?.status === "already-migrated" ? (
            <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold text-emerald-100">Sauvegarde locale conservee</p>
              <p className="mt-1 text-xs leading-5 text-emerald-50/90">Ces donnees ont deja ete migrees vers votre compte. La copie locale est conservee comme sauvegarde.</p>
            </div>
          ) : null}
          {diagnostic?.status === "local-new-data" || diagnostic?.status === "partial-difference" || diagnostic?.status === "migration-incomplete" ? (
            <p className="rounded-md border border-amber-300/30 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">Nouvelles donnees locales detectees</p>
          ) : null}
          {summary.hasLocalData && diagnostic?.canMigrateMissing ? (
            <button className="rounded-md border border-gold/30 px-3 py-2 text-xs text-goldSoft disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || migrationRisk.hasObsTechnicalData} onClick={() => void run("migrate")}>
              Importer les donnees locales manquantes ({diagnostic.missing.studies} etude(s), {diagnostic.missing.observations} observation(s))
            </button>
          ) : null}
          {summary.hasLocalData && diagnostic ? (
            <div className="grid grid-cols-1 gap-2">
              <button className="rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200 disabled:opacity-50" disabled={busy} onClick={() => void run("compare")}>Comparer avec le compte</button>
              <button className="rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200 disabled:opacity-50" disabled={busy} onClick={() => void run("export")}>Exporter la sauvegarde JSON</button>
              <button className="rounded-md border border-red-400/30 px-3 py-2 text-xs text-red-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !diagnostic.canDeleteLocal} onClick={() => void run("remove-local")}>Supprimer la copie locale</button>
            </div>
          ) : null}
          {migrationRisk.hasObsTechnicalData ? (
            <p className="text-xs leading-5 text-amber-200">Migration bloquee : des donnees techniques obs-* sont presentes dans le cache local courant.</p>
          ) : null}
          {diagnostic?.status === "migrated-to-other-owner" ? (
            <p className="text-xs leading-5 text-amber-200">Cette sauvegarde locale a deja ete migree vers un autre compte. L&apos;import automatique est bloque.</p>
          ) : null}
          {migrationRisk.duplicateIds ? (
            <p className="text-xs leading-5 text-amber-200">{migrationRisk.duplicateIds} doublon(s) d&apos;identifiant detecte(s) avant migration.</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <input className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white" placeholder="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white" placeholder="mot de passe" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-md bg-gold px-3 py-2 text-xs font-semibold text-night" disabled={busy} onClick={() => void run("signin")}>Connexion</button>
            <button className="rounded-md border border-white/10 px-3 py-2 text-xs text-stone-200" disabled={busy} onClick={() => void run("signup")}>Creer</button>
          </div>
        </div>
      )}
      {syncError ? <p className="mt-2 text-xs text-red-200">{syncError}</p> : null}
      {notice ? <p className="mt-2 text-xs text-goldSoft">{notice}</p> : null}
    </div>
  );
}

function syncLabel(status: string) {
  if (status === "synced") return "Synchronise";
  if (status === "syncing") return "En cours";
  if (status === "offline") return "Hors ligne";
  if (status === "error") return "Erreur de synchronisation";
  return "Cache local";
}

function migrationStatusNotice(diagnostic: LocalMigrationDiagnostic) {
  if (diagnostic.status === "already-migrated") return "La sauvegarde locale correspond au compte.";
  if (diagnostic.status === "remote-empty") return "Le compte ne contient pas encore ces donnees locales.";
  if (diagnostic.status === "local-new-data") return "Nouvelles donnees locales detectees.";
  if (diagnostic.status === "partial-difference") return "Differences partielles detectees entre la copie locale et le compte.";
  if (diagnostic.status === "migration-incomplete") return "Derniere migration incomplete : seuls les elements manquants seront proposes.";
  if (diagnostic.status === "migrated-to-other-owner") return "Cette sauvegarde a deja ete migree vers un autre compte.";
  return "Aucune donnee locale a comparer.";
}

function summarizeMigrationExport(value: unknown) {
  const studies = arrayFromField(value, "studies");
  const drafts = arrayFromField(value, "observationDrafts");
  const studyIds = studies.map((study) => stringFromField(study, "id")).filter(Boolean);
  const draftIds = drafts.map((draft) => stringFromField(draft, "id")).filter(Boolean);
  const ownerIds = [
    stringFromField(value, "ownerId"),
    ...studies.flatMap((study) => [
      stringFromField(study, "ownerId"),
      ...arrayFromField(study, "observations").map((observation) => stringFromField(observation, "ownerId"))
    ]),
    ...drafts.map((draft) => stringFromField(draft, "ownerId"))
  ].filter(Boolean);
  const ids = [...studyIds, ...draftIds];
  return {
    hasObsTechnicalData: ownerIds.some((ownerId) => ownerId?.startsWith("obs-")),
    duplicateIds: ids.length - new Set(ids).size
  };
}

function arrayFromField(value: unknown, field: string): Array<Record<string, unknown>> {
  if (value === null || typeof value !== "object") return [];
  const item = (value as Record<string, unknown>)[field];
  return Array.isArray(item) ? item.filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object") : [];
}

function stringFromField(value: unknown, field: string) {
  if (value === null || typeof value !== "object") return undefined;
  const item = (value as Record<string, unknown>)[field];
  return typeof item === "string" ? item : undefined;
}

function AnalysisScope({ scope, study, studies = [] }: { scope: "selected" | "all"; study?: Study; studies?: Study[] }) {
  const explicitScope = scope === "selected" && study
    ? { mode: "selected-study" as const, studyId: study.id }
    : { mode: "all-studies" as const };
  const scopedStudies = scope === "selected" && study ? [study] : studies;
  return (
    <Panel title="Contexte d'analyse">
      <div className="flex flex-wrap gap-3 text-sm text-stone-200">
        <span className={scope === "selected" ? "text-goldSoft" : "text-stone-500"}>○ étude sélectionnée</span>
        <span className={scope === "all" ? "text-goldSoft" : "text-stone-500"}>○ toutes les études</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-goldSoft">{analysisScopeSummary(scopedStudies, explicitScope)}</p>
      <p className="mt-2 text-sm leading-6 text-stone-400">
        {scope === "selected"
          ? `Les résultats utilisent uniquement ${study ? `l'étude « ${study.title} »` : "l'étude sélectionnée"}.`
          : "Les résultats agrègent explicitement toutes les études disponibles."}
      </p>
    </Panel>
  );
}

function ObservationAISettingsPanel({
  settings,
  onChange,
  status,
  testing,
  onTest
}: {
  settings: ObservationAISettings;
  onChange: (settings: ObservationAISettings) => void;
  status: AIConnectionStatus | null;
  testing: boolean;
  onTest: () => void | Promise<void>;
}) {
  function patch(partial: Partial<ObservationAISettings>) {
    onChange({ ...settings, ...partial });
  }

  return (
    <Panel title="Parametres d'observation">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-goldSoft" aria-hidden />
          <button
            className={`rounded-md border px-3 py-2 text-sm ${settings.mode === "local" ? "border-gold/60 bg-gold/10 text-goldSoft" : "border-white/10 text-stone-200"}`}
            onClick={() => patch({ mode: "local" })}
          >
            Local
          </button>
          <button
            className={`rounded-md border px-3 py-2 text-sm ${settings.mode === "ai-assisted" ? "border-gold/60 bg-gold/10 text-goldSoft" : "border-white/10 text-stone-200"}`}
            onClick={() => patch({ mode: "ai-assisted" })}
          >
            IA assistee
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-200">Modele</span>
            <input
              className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
              value={settings.model}
              onChange={(event) => patch({ model: event.target.value })}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-200">Temperature</span>
            <input
              className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(event) => patch({ temperature: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle label="Conserver les reponses IA" checked={settings.keepResponses} onChange={(value) => patch({ keepResponses: value })} />
          <Toggle label="Reanalyser automatiquement" checked={settings.autoReanalyze} onChange={(value) => patch({ autoReanalyze: value })} />
          <Toggle label="Afficher le raisonnement resume" checked={settings.showReasoningSummary} onChange={(value) => patch({ showReasoningSummary: value })} />
          <Toggle label="Afficher differences Parser / IA" checked={settings.showParserAIDifferences} onChange={(value) => patch({ showParserAIDifferences: value })} />
          <Toggle label="Autoriser l'IA a utiliser toute l'etude" checked={settings.allowFullStudyContext} onChange={(value) => patch({ allowFullStudyContext: value })} />
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Diagnostic IA</h3>
            <button
              className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onTest}
              disabled={testing}
            >
              {testing ? "Test en cours..." : "Tester la connexion IA"}
            </button>
          </div>
          <div className="grid gap-2 text-sm text-stone-300 md:grid-cols-2">
            <DiagnosticLine label="Configuree" value={status ? (status.configured ? "oui" : "non") : "non testee"} />
            <DiagnosticLine label="Fournisseur" value={status?.provider ?? settings.provider} />
            <DiagnosticLine label="Modele" value={status?.model ?? settings.model} />
            <DiagnosticLine label="Connexion" value={status ? (status.reachable ? "operationnelle" : "indisponible") : "non testee"} />
            <DiagnosticLine label="Latence" value={status?.latency === null || status?.latency === undefined ? "non mesuree" : `${status.latency} ms`} />
            <DiagnosticLine label="Dernier test" value={status?.checkedAt ?? "jamais"} />
          </div>
          {status?.lastError ? (
            <p className="mt-3 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
              Derniere erreur : {status.lastError}
            </p>
          ) : null}
          {status?.message ? <p className="mt-3 text-sm leading-6 text-stone-400">{status.message}</p> : null}
        </div>
        <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-400">
          Par defaut, seule l&apos;observation courante peut etre transmise a un fournisseur IA configure. Le moteur scientifique reste local et deterministe.
        </p>
      </div>
    </Panel>
  );
}

function ObservationModeIndicator({
  settings,
  lastAnalysisNotice,
  currentDraft
}: {
  settings: ObservationAISettings;
  lastAnalysisNotice: string;
  currentDraft: ObservationAnalysisDraft | null;
}) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{settings.mode === "ai-assisted" ? "Mode IA assistee" : "Mode Local"}</Badge>
          <Badge>{lastAnalysisNotice}</Badge>
        </div>
        {currentDraft?.aiError ? <span className="text-sm text-red-200">{currentDraft.aiError}</span> : null}
      </div>
    </div>
  );
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/10 p-2">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-1 text-stone-100">{value}</p>
    </div>
  );
}

async function analyzeObservationOnServer(
  rawText: string,
  settings: ObservationAISettings,
  cache: AIObservationResult[]
): Promise<{ draft: ObservationAnalysisDraft; result: AIObservationResult; cache: AIObservationResult[] }> {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText, settings, cache })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; latency?: number } | null;
    const draft = parseObservation(rawText);
    const fallback = await analyzeWithObservationAI({ draft, settings: { ...settings, mode: "local" } });
    return {
      ...fallback,
      result: {
        ...fallback.result,
        status: "error",
        error: payload?.error ?? `Erreur serveur IA ${response.status}`,
        latency: payload?.latency ?? 0
      },
      draft: {
        ...fallback.draft,
        observationMode: "ai-assisted",
        aiStatus: "error",
        aiError: payload?.error ?? `Erreur serveur IA ${response.status}`
      }
    };
  }
  return response.json() as Promise<{ draft: ObservationAnalysisDraft; result: AIObservationResult; cache: AIObservationResult[] }>;
}

function analysisNotice(result: AIObservationResult) {
  if (result.status === "success") return "Analyse IA reussie";
  if (result.status === "cached") return "Analyse IA issue du cache";
  if (result.status === "offline") return "Analyse IA indisponible, repli local";
  if (result.status === "error") return "Analyse IA en erreur";
  return "Analyse locale uniquement";
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-stone-200">
      <input className="h-4 w-4 accent-[#d7b56d]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function GlobalWatch({
  state,
  onCollect,
  onHistoricalImport,
  onAnalyze,
  onCreateStudy,
  onAbandon,
  onToggleSource
}: {
  state?: GlobalObservatoryState;
  onCollect: () => Promise<GlobalCollectionReport>;
  onHistoricalImport: (input: { request?: HistoricalImportRequest; sessionId?: string; command?: "run" | "pause" }) => Promise<HistoricalImportSession>;
  onAnalyze: (eventId: string) => void;
  onCreateStudy: (eventId: string) => void;
  onAbandon: (eventId: string) => void;
  onToggleSource: (sourceId: string, enabled: boolean) => void;
}) {
  const [collecting, setCollecting] = useState(false);
  const [mode, setMode] = useState<"realtime" | "historical">("realtime");
  const [collectionReport, setCollectionReport] = useState<GlobalCollectionReport | null>(null);
  const [collectionError, setCollectionError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState("all");
  const observatory = state ?? {
    sources: [],
    events: [],
    learningSignals: [],
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
    },
    collectionLogs: [],
    historicalImports: []
  };
  const filteredEvents = observatory.events.filter((event) =>
    (sourceFilter === "all" || event.sources.some((source) => source.connectorId === sourceFilter))
    && (countryFilter === "all" || (event.country ?? "Monde") === countryFilter)
    && (categoryFilter === "all" || event.categories.includes(categoryFilter as never))
    && (interestFilter === "all" || event.interest?.level === interestFilter)
  );
  const sortedEvents = [...filteredEvents].sort((left, right) => (right.interest?.score ?? 0) - (left.interest?.score ?? 0));
  const countries = [...new Set(observatory.events.map((event) => event.country ?? "Monde"))].sort();
  const categories = [...new Set(observatory.events.flatMap((event) => event.categories))].sort();
  const interestLevels = [...new Set(observatory.events.map((event) => event.interest?.level).filter(Boolean))].sort();

  return (
    <div className="grid gap-4">
      <Panel title="Observatoire mondial">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="max-w-3xl text-sm leading-6 text-stone-300">
              Les articles collectes sont traites comme des sources. Le centre de cette veille est l&apos;evenement observe:
              un meme evenement peut reunir plusieurs sources, produire une analyse traçable, puis devenir une etude.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>NewsCollector</Badge>
              <Badge>HistoricalImportEngine</Badge>
              <Badge>SourceManager</Badge>
              <Badge>ReflexiveAnalyzer</Badge>
              <Badge>LearningEngine</Badge>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex rounded-md border border-white/10 bg-white/[0.04] p-1">
              <button className={`rounded px-3 py-2 text-sm ${mode === "realtime" ? "bg-gold text-night" : "text-stone-200"}`} onClick={() => setMode("realtime")}>Temps reel</button>
              <button className={`rounded px-3 py-2 text-sm ${mode === "historical" ? "bg-gold text-night" : "text-stone-200"}`} onClick={() => setMode("historical")}>Import historique</button>
            </div>
            {mode === "realtime" ? (
              <button
                className="flex items-center justify-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night disabled:cursor-not-allowed disabled:opacity-60"
                disabled={collecting}
                onClick={async () => {
                  setCollecting(true);
                  setCollectionError("");
                  try {
                    setCollectionReport(await onCollect());
                  } catch (error) {
                    setCollectionError(error instanceof Error ? error.message : "Collecte impossible.");
                  } finally {
                    setCollecting(false);
                  }
                }}
              >
                <RefreshCw className={`h-4 w-4 ${collecting ? "animate-spin" : ""}`} aria-hidden /> Actualiser les actualites
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      {mode === "historical" ? (
        <HistoricalImportDashboard state={observatory} onHistoricalImport={onHistoricalImport} />
      ) : null}

      {mode === "realtime" && (collectionReport || collectionError || observatory.collectionLogs[0]) ? (
        <Panel title="Derniere collecte">
          {collectionError ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{collectionError}</p> : null}
          <CollectionReport report={collectionReport ?? observatory.collectionLogs[0]} />
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Evenements actifs" value={observatory.dashboard.activeEvents} />
        <StatCard label="Evenements analyses" value={observatory.dashboard.analyzedEvents} />
        <StatCard label="Etudes creees" value={observatory.dashboard.createdStudies} />
        <StatCard label="Sources actives" value={observatory.sources.filter((source) => source.enabled).length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Sources configurables">
          <div className="grid gap-3">
            {observatory.sources.map((source) => (
              <div key={source.id} className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{source.name}</p>
                    <Badge>{source.type}</Badge>
                    <Badge>fiabilite {Math.round(source.reliability * 100)}%</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-400">{source.notes ?? "Connecteur configurable."}</p>
                  <p className="mt-1 text-xs text-stone-500">Pays: {source.countries.join(", ")} - Categories: {source.categories.join(", ")}</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(event) => onToggleSource(source.id, event.target.checked)}
                  />
                  Actif
                </label>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tableau de bord mondial">
          <div className="grid gap-4">
            <MiniRank title="Categories emergentes" items={observatory.dashboard.frequentCategories} />
            <MiniRank title="Pays les plus observes" items={observatory.dashboard.representedCountries} />
            <MiniRank title="Phenomenes les plus etudies" items={observatory.dashboard.studiedPhenomena} />
            <MiniRank title="Themes emergents" items={observatory.dashboard.emergingThemes} />
            {observatory.dashboard.trends.length ? <TagBlock title="Nouvelles tendances" items={observatory.dashboard.trends} /> : null}
          </div>
        </Panel>
      </div>

      <Panel title="Carte mondiale">
        {observatory.mapPoints.length ? (
          <div className="relative min-h-72 overflow-hidden rounded-md border border-white/10 bg-[radial-gradient(circle_at_20%_25%,rgba(217,183,91,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.8),rgba(20,20,18,0.95))]">
            <div className="absolute inset-x-6 top-1/2 h-px bg-white/10" />
            <div className="absolute inset-y-6 left-1/2 w-px bg-white/10" />
            {observatory.mapPoints.map((point) => (
              <div
                key={point.id}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-gold/30 bg-night/85 px-2 py-1 text-xs text-goldSoft"
                style={{
                  left: `${Math.max(8, Math.min(92, ((point.longitude + 180) / 360) * 100))}%`,
                  top: `${Math.max(10, Math.min(90, ((90 - point.latitude) / 180) * 100))}%`
                }}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {point.country} · {point.interestStars}★
              </div>
            ))}
          </div>
        ) : (
          <SmartEmpty text="Aucun evenement geolocalisable. Lancez une mise a jour." />
        )}
      </Panel>

      <Panel title="Evenements observes">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <SelectFilter label="Source" value={sourceFilter} onChange={setSourceFilter} options={observatory.sources.map((source) => ({ value: source.id, label: source.name }))} />
          <SelectFilter label="Pays" value={countryFilter} onChange={setCountryFilter} options={countries.map((country) => ({ value: country, label: country }))} />
          <SelectFilter label="Categorie" value={categoryFilter} onChange={setCategoryFilter} options={categories.map((category) => ({ value: category, label: category }))} />
          <SelectFilter label="Interet" value={interestFilter} onChange={setInterestFilter} options={interestLevels.map((level) => ({ value: level ?? "", label: level ?? "" }))} />
        </div>
        <div className="grid gap-3">
          {sortedEvents.length ? sortedEvents.map((event) => (
            <GlobalEventCard
              key={event.id}
              event={event}
              onAnalyze={onAnalyze}
              onCreateStudy={onCreateStudy}
              onAbandon={onAbandon}
            />
          )) : <SmartEmpty text="Aucun evenement collecte. Activez au moins une source puis mettez a jour." />}
        </div>
      </Panel>
    </div>
  );
}

function HistoricalImportDashboard({
  state,
  onHistoricalImport
}: {
  state: GlobalObservatoryState;
  onHistoricalImport: (input: { request?: HistoricalImportRequest; sessionId?: string; command?: "run" | "pause" }) => Promise<HistoricalImportSession>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [granularity, setGranularity] = useState<HistoricalImportRequest["range"]["granularity"]>("year");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [batchSize, setBatchSize] = useState(24);
  const [maxArticles, setMaxArticles] = useState(360);
  const [sourceIds, setSourceIds] = useState<string[]>(state.sources.filter((source) => source.enabled).map((source) => source.id));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(state.historicalImports?.[0]?.id ?? null);
  const [filters, setFilters] = useState<HistoricalSearchFilters>({
    query: "",
    country: "all",
    category: "all",
    sourceId: "all",
    importance: "all",
    confidence: "all",
    startDate: "",
    endDate: ""
  });
  const activeSession = state.historicalImports?.find((session) => session.id === activeSessionId) ?? state.historicalImports?.[0];
  const statistics = HistoricalImportEngine.statistics(state);
  const results = HistoricalImportEngine.search(state, filters).slice(0, 80);
  const countries = [...new Set(state.events.map((event) => event.country ?? "Monde"))].sort();
  const categories = [...new Set(state.events.flatMap((event) => event.categories))].sort();
  const importance = [...new Set(state.events.map((event) => event.interest?.level).filter(Boolean))].sort();
  const selectedSources = state.sources.filter((source) => sourceIds.includes(source.id));
  const hasSimulatedSelectedSources = selectedSources.some((source) => source.id !== "source-gdelt");
  const provenanceCounts = countProvenance(state.events);

  function applyPreset(next: HistoricalImportRequest["range"]["granularity"]) {
    setGranularity(next);
    if (next === "day") setEndDate(startDate);
    if (next === "week") setEndDate(addDaysForUi(startDate, 6));
    if (next === "month") setEndDate(`${startDate.slice(0, 7)}-28`);
    if (next === "year") {
      const year = startDate.slice(0, 4) || today.slice(0, 4);
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    }
  }

  async function run(sessionId?: string) {
    setRunning(true);
    setError("");
    try {
      const request: HistoricalImportRequest = {
        range: { granularity, startDate, endDate },
        sourceIds,
        batchSize,
        maxArticles
      };
      const session = await onHistoricalImport(sessionId ? { sessionId } : { request });
      setActiveSessionId(session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import historique impossible.");
    } finally {
      setRunning(false);
    }
  }

  async function pause(sessionId: string) {
    setRunning(true);
    setError("");
    try {
      const session = await onHistoricalImport({ sessionId, command: "pause" });
      setActiveSessionId(session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Interruption impossible.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Panel title="Import historique">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-3">
            {hasSimulatedSelectedSources ? (
              <div className="rounded-md border border-amber-300/35 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
                <p className="font-medium">Mode demonstration</p>
                <p>Mode demonstration - aucune archive externe reelle interrogee. Les connecteurs selectionnes hors GDELT generent des donnees de test deterministes.</p>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-5">
              {(["day", "week", "month", "year", "custom"] as const).map((item) => (
                <button key={item} className={`rounded-md border px-3 py-2 text-sm ${granularity === item ? "border-gold/70 bg-gold/10 text-goldSoft" : "border-white/10 text-stone-200"}`} onClick={() => applyPreset(item)}>
                  {historicalGranularityLabel(item)}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Debut</span>
                <input className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Fin</span>
                <input className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Batch</span>
                <input className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" type="number" min={1} max={50} value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Limite articles</span>
                <input className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" type="number" min={1} max={500000} value={maxArticles} onChange={(event) => setMaxArticles(Number(event.target.value))} />
              </label>
            </div>
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Connecteurs historiques</p>
              <div className="grid gap-2 md:grid-cols-2">
                {state.sources.map((source) => (
                  <label key={source.id} className="flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-stone-200">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={sourceIds.includes(source.id)}
                      onChange={(event) => {
                        setSourceIds((current) => event.target.checked
                          ? [...new Set([...current, source.id])]
                          : current.filter((id) => id !== source.id));
                      }}
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2 text-white">
                        {source.name}
                        <Badge>{source.id === "source-gdelt" ? "Reel" : "Simulation"}</Badge>
                      </span>
                      <span className="block text-xs text-stone-500">{source.type} - {source.notes ?? "Connecteur extensible."}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night disabled:opacity-60" disabled={running || !sourceIds.length} onClick={() => void run()}>
                <Import className="h-4 w-4" aria-hidden /> Lancer un batch historique
              </button>
              {activeSession && activeSession.status !== "completed" ? (
                <>
                  <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200 disabled:opacity-60" disabled={running} onClick={() => void run(activeSession.id)}>Reprendre</button>
                  <button className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-100 disabled:opacity-60" disabled={running} onClick={() => void pause(activeSession.id)}>Interrompre</button>
                </>
              ) : null}
            </div>
            {error ? <p className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
          </div>

          <HistoricalProgressPanel session={activeSession} />
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Articles historiques" value={activeSession?.progress.articlesFetched ?? 0} />
        <StatCard label="Evenements historiques" value={activeSession?.progress.eventsCreated ?? 0} />
        <StatCard label="Sources selectionnees" value={sourceIds.length} />
        <StatCard label="Progression" value={`${activeSession?.progress.percent ?? 0}%`} />
        <StatCard label="Erreurs" value={activeSession?.progress.errors ?? 0} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Articles reels marques" value={provenanceCounts.real} />
        <StatCard label="Articles simules marques" value={provenanceCounts.simulated} />
        <StatCard label="Provenance non verifiable" value={provenanceCounts.unknown} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Couverture complete" value={activeSession?.progress.completeCoverage === false ? "Non" : "Oui"} />
        <StatCard label="Fenêtres tronquees" value={activeSession?.progress.truncatedWindows?.length ?? 0} />
        <StatCard label="Fenêtres subdivisees" value={activeSession?.progress.subdividedWindows ?? 0} />
        <StatCard label="MAXRECORDS GDELT" value={activeSession?.progress.maxRecordsPerCall ?? "n/a"} />
      </div>
      {activeSession?.progress.completeCoverage === false ? (
        <div className="rounded-md border border-amber-300/35 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
          Couverture historique incomplete: au moins une fenêtre GDELT est restee saturee. Niveau estime: {activeSession.progress.estimatedCoverageLevel ?? "partial"}.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <HistoricalStatisticsPanel statistics={statistics} />
        <HistoricalLogPanel session={activeSession} />
      </div>

      <Panel title="Recherche historique">
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-200">Texte</span>
            <input className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          </label>
          <SelectFilter label="Pays" value={filters.country} onChange={(value) => setFilters({ ...filters, country: value })} options={countries.map((country) => ({ value: country, label: country }))} />
          <SelectFilter label="Categorie" value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={categories.map((category) => ({ value: category, label: category }))} />
          <SelectFilter label="Source" value={filters.sourceId} onChange={(value) => setFilters({ ...filters, sourceId: value })} options={state.sources.map((source) => ({ value: source.id, label: source.name }))} />
          <SelectFilter label="Importance" value={filters.importance} onChange={(value) => setFilters({ ...filters, importance: value })} options={importance.map((item) => ({ value: item ?? "", label: item ?? "" }))} />
          <SelectFilter label="Confiance" value={filters.confidence} onChange={(value) => setFilters({ ...filters, confidence: value })} options={["Confiance elevee", "Confiance moyenne", "Confiance faible"].map((item) => ({ value: item, label: item }))} />
        </div>
        <div className="grid gap-3">
          {results.length ? results.map((event) => (
            <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{event.startedAt.slice(0, 10)}</Badge>
                <Badge>{event.country ?? "Monde"}</Badge>
                <Badge>{event.sources.length} source(s)</Badge>
                <Badge>{eventProvenanceLabel(event)}</Badge>
                {event.interest ? <Badge>{event.interest.level}</Badge> : null}
              </div>
              <p className="mt-2 font-medium text-white">{event.title}</p>
              <p className="mt-1 text-sm leading-6 text-stone-300">{event.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {event.sources.slice(0, 3).map((source) => (
                  <Badge key={source.id}>{source.connectorName}: {sourceProvenanceLabel(source)}</Badge>
                ))}
              </div>
            </div>
          )) : <SmartEmpty text="Aucun evenement ne correspond aux filtres historiques." />}
        </div>
      </Panel>
    </div>
  );
}

function HistoricalProgressPanel({ session }: { session?: HistoricalImportSession }) {
  if (!session) return <Panel title="Progression"><SmartEmpty text="Aucun import historique lance." /></Panel>;
  return (
    <Panel title="Progression">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{session.status}</Badge>
          <Badge>{session.request.range.startDate} - {session.request.range.endDate}</Badge>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gold" style={{ width: `${session.progress.percent}%` }} />
        </div>
        <p className="text-sm text-stone-300">{session.progress.percent}% - curseur {session.progress.cursorDate}, source {session.progress.cursorSourceIndex + 1}/{session.progress.totalSources}</p>
        <p className="text-xs text-stone-500">Temps restant estime: {formatDuration(session.progress.estimatedRemainingMs)}</p>
      </div>
    </Panel>
  );
}

function HistoricalStatisticsPanel({ statistics }: { statistics: HistoricalObservatoryStatistics }) {
  return (
    <Panel title="Statistiques historiques">
      <div className="grid gap-4 md:grid-cols-2">
        <MiniRank title="Par mois" items={statistics.eventsByMonth.slice(0, 8)} />
        <MiniRank title="Par pays" items={statistics.eventsByCountry.slice(0, 8)} />
        <MiniRank title="Par categorie" items={statistics.eventsByCategory.slice(0, 8)} />
        <MiniRank title="Par source" items={statistics.eventsBySource.slice(0, 8)} />
        <MiniRank title="Par theme" items={statistics.eventsByTheme.slice(0, 8)} />
        <MiniRank title="Par confiance" items={statistics.eventsByConfidence.slice(0, 8)} />
      </div>
    </Panel>
  );
}

function HistoricalLogPanel({ session }: { session?: HistoricalImportSession }) {
  return (
    <Panel title="Journal historique">
      <div className="max-h-80 overflow-auto">
        {session?.logs.length ? session.logs.slice(0, 80).map((entry) => (
          <div key={entry.id} className="border-b border-white/10 py-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{entry.level}</Badge>
              <span className="text-stone-500">{entry.at}</span>
              {entry.sourceId ? <span className="text-stone-500">{entry.sourceId}</span> : null}
            </div>
            <p className="mt-1 text-stone-300">{entry.message}</p>
          </div>
        )) : <SmartEmpty text="Aucune entree de journal." />}
      </div>
    </Panel>
  );
}

function historicalGranularityLabel(value: HistoricalImportRequest["range"]["granularity"]) {
  const labels = {
    day: "Journee",
    week: "Semaine",
    month: "Mois",
    year: "Annee",
    custom: "Personnalise"
  };
  return labels[value];
}

function countProvenance(events: GlobalObservedEvent[]) {
  return events.flatMap((event) => event.sources).reduce(
    (counts, source) => {
      counts[sourceProvenanceKind(source)] += 1;
      return counts;
    },
    { real: 0, simulated: 0, unknown: 0 }
  );
}

function eventProvenanceLabel(event: GlobalObservedEvent) {
  return provenanceLabel(eventProvenanceStatus(event));
}

function sourceProvenanceLabel(source: GlobalObservedEvent["sources"][number]) {
  return provenanceLabel(sourceProvenanceStatus(source));
}

function sourceProvenanceKind(source: GlobalObservedEvent["sources"][number]): "real" | "simulated" | "unknown" {
  return sourceProvenanceStatus(source);
}

function addDaysForUi(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDuration(ms: number) {
  if (!ms) return "non calcule";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.ceil(minutes / 60)} h`;
}

function GlobalEventCard({
  event,
  onAnalyze,
  onCreateStudy,
  onAbandon
}: {
  event: GlobalObservedEvent;
  onAnalyze: (eventId: string) => void;
  onCreateStudy: (eventId: string) => void;
  onAbandon: (eventId: string) => void;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{event.status}</Badge>
            <Badge>{event.country ?? "Monde"}</Badge>
            <Badge>{event.sources.length} source(s)</Badge>
            <Badge>{eventProvenanceLabel(event)}</Badge>
            {event.interest ? <Badge>{interestStars(event.interest.stars)} {event.interest.level}</Badge> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{event.title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-300">{event.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => onAnalyze(event.id)}>
            <Layers3 className="h-4 w-4" aria-hidden /> Analyser
          </button>
          <button className="flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={() => onCreateStudy(event.id)}>
            <Plus className="h-4 w-4" aria-hidden /> Creer une etude
          </button>
          <button className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-300" onClick={() => onAbandon(event.id)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Abandonner
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <TagBlock title="Categories" items={event.categories} />
          <TagBlock title="Themes" items={event.themes.slice(0, 8)} />
          {event.interest ? (
            <div className="mt-4 rounded-md border border-gold/20 bg-gold/8 p-3">
              <p className="text-sm font-medium text-goldSoft">Score explique</p>
              <p className="mt-2 text-sm leading-6 text-stone-200">{event.interest.explanation}</p>
            </div>
          ) : null}
          {event.mergeCandidates.length ? (
            <div className="mt-4 rounded-md border border-sky-300/25 bg-sky-400/10 p-3">
              <p className="text-sm font-medium text-sky-100">Fusion</p>
              {event.mergeCandidates.map((candidate) => (
                <p key={`${candidate.eventId}-${candidate.status}`} className="mt-2 text-sm leading-6 text-sky-100">
                  {candidate.status} · confiance {Math.round(candidate.confidence * 100)}% · {candidate.reason}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">Sources rattachees</h4>
          <div className="mt-2 grid gap-2">
            {event.sources.map((source) => (
              <div key={source.id} className="rounded-md border border-white/10 bg-night/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{source.connectorName}</p>
                  <Badge>{sourceProvenanceLabel(source)}</Badge>
                  <Badge>{source.collectionMode ?? "mode inconnu"}</Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-stone-300">{source.title}</p>
                {source.url ? <a className="mt-1 block text-xs text-goldSoft underline" href={source.url} target="_blank" rel="noreferrer">{source.url}</a> : null}
                {source.provenance?.requestedUrl ? <p className="mt-1 break-all text-xs text-stone-500">Appel: {source.provenance.requestedUrl}</p> : null}
                {source.excerpts.map((excerpt) => (
                  <p key={excerpt.id} className="mt-2 border-l border-gold/30 pl-3 text-xs leading-5 text-stone-400">{excerpt.text}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {event.analysis ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-medium text-white">Analyse reflexive</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">{event.analysis.observedPhenomenon}</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">{event.analysis.stakes}</p>
            <TagBlock title="Mecanismes possibles" items={event.analysis.recognitionMechanisms} />
            <TagBlock title="Questions de recherche" items={event.analysis.researchQuestions} />
            <TagBlock title="Hypotheses" items={event.analysis.hypotheses} />
            <TagBlock title="Elements hypothetiques" items={event.analysis.uncertainElements} />
            <TagBlock title="Confirme par plusieurs sources" items={event.analysis.sourceAgreement.confirmedByMultipleSources} />
            <TagBlock title="Une seule source" items={event.analysis.sourceAgreement.singleSourceOnly} />
            <TagBlock title="Conteste" items={event.analysis.sourceAgreement.contested} />
            <TagBlock title="Inconnu" items={event.analysis.sourceAgreement.unknown} />
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-medium text-white">Traçabilite des claims</p>
            <div className="mt-2 grid gap-2">
              {event.analysis.claims.map((claim) => (
                <div key={claim.id} className="rounded-md border border-white/10 bg-night/30 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{claim.status}</Badge>
                    <Badge>{Math.round(claim.confidence * 100)}%</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{claim.text}</p>
                  <p className="mt-2 text-xs text-stone-500">Sources: {claim.sourceIds.join(", ") || "non renseignees"} · Extraits: {claim.excerptIds.join(", ") || "limite methodologique"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MiniRank({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h3>
      <div className="mt-2 grid gap-2">
        {items.length ? items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="text-sm text-stone-200">{item.label}</span>
            <Badge>{item.value}</Badge>
          </div>
        )) : <p className="text-sm text-stone-500">Non renseigne</p>}
      </div>
    </div>
  );
}

function CollectionReport({ report }: { report?: GlobalCollectionReport | GlobalObservatoryState["collectionLogs"][number] }) {
  if (!report) return <SmartEmpty text="Aucune collecte executee." />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Sources interrogees" value={report.sourcesRequested.length} hint={`${report.sourcesSucceeded.length} reussie(s)`} />
      <StatCard label="Articles recuperes" value={report.articlesFetched} />
      <StatCard label="Nouveaux evenements" value={report.newEvents} />
      <StatCard label="Articles fusionnes" value={report.mergedArticles} hint={`${report.duplicateArticles} doublon(s), ${report.ambiguousMerges} ambigu(s)`} />
      <div className="md:col-span-2 xl:col-span-4">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Date de collecte</p>
        <p className="mt-1 text-sm text-stone-300">{formatBuildDate(report.completedAt)}</p>
        {report.sourcesFailed.length ? (
          <div className="mt-3 grid gap-2">
            {report.sourcesFailed.map((failure) => (
              <p key={failure.sourceId} className="rounded-md border border-red-400/25 bg-red-500/10 p-2 text-sm text-red-100">
                {failure.sourceName}: {failure.error}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <select
        className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option className="bg-ink" value="all">Tous</option>
        {options.map((option) => (
          <option className="bg-ink" key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function interestStars(stars: number) {
  return "★".repeat(Math.max(1, Math.min(5, stars)));
}

function Dashboard({
  dashboard,
  studies,
  selectStudy,
  setView
}: {
  dashboard: ReturnType<typeof buildDashboard>;
  studies: Study[];
  selectStudy: (id: string) => void;
  setView: (view: AppView) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Catalyseurs fréquents">
          <RankedList items={dashboard.topCatalysts} empty="Aucun catalyseur documenté." />
        </Panel>
        <Panel title="Émotions fréquentes">
          <RankedList items={dashboard.topEmotions} empty="Aucune émotion documentée." />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Dernières observations">
          <div className="grid gap-2">
            {dashboard.latestEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{event.title}</p>
                  <Badge>{event.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-400">{event.date}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Études récentes">
          <div className="grid gap-2">
            {studies.map((study) => (
              <button
                key={study.id}
                className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-gold/40"
                onClick={() => {
                  selectStudy(study.id);
                  setView("studies");
                }}
              >
                <p className="font-medium text-white">{study.title}</p>
                <p className="mt-1 text-sm text-stone-400">{study.subject} · {study.status}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function GlobalSearchResults({
  query,
  data,
  onOpenStudy
}: {
  query: string;
  data: ReturnType<typeof useObservatory>["data"];
  onOpenStudy: (studyId: string) => void;
}) {
  const results = data.studies.flatMap((study) => searchStudy(study, query));
  if (!results.length) return null;
  return (
    <Panel title="Recherche globale">
      <div className="grid gap-2">
        {results.slice(0, 12).map((result) => (
          <button
            key={`${result.studyId}-${result.type}-${result.id}`}
            className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-gold/35"
            onClick={() => onOpenStudy(result.studyId)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{result.label}</p>
              <Badge>{result.type}</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-stone-400">{result.detail}</p>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function searchStudy(study: Study, query: string) {
  const normalized = query.toLowerCase();
  const entries = [
    { type: "etude", id: study.id, label: study.title, detail: `${study.subject} ${study.description}` },
    ...(study.observations ?? []).map((item) => ({ type: "observation", id: item.id, label: item.rawText.slice(0, 80), detail: item.sourceExcerpts.join(" ") })),
    ...study.states.map((item) => ({ type: "etat", id: item.id, label: item.title, detail: item.formulation })),
    ...study.transitions.map((item) => ({ type: "transition", id: item.id, label: item.title, detail: item.explanation ?? item.observableImpact })),
    ...study.emotionObservations.map((item) => ({ type: "emotion", id: item.id, label: item.emotion, detail: item.context })),
    ...study.catalysts.map((item) => ({ type: "catalyseur", id: item.id, label: item.name, detail: item.context })),
    ...study.relations.map((item) => ({ type: "relation", id: item.id, label: `${item.source} -> ${item.target}`, detail: item.note })),
    ...study.recognitions.map((item) => ({ type: "reconnaissance", id: item.id, label: item.title, detail: item.exactWording })),
    ...(study.openQuestions ?? []).map((item) => ({ type: "question", id: item.id, label: item.text, detail: item.answer ?? item.status }))
  ];
  return entries
    .filter((entry) => `${entry.label} ${entry.detail}`.toLowerCase().includes(normalized))
    .map((entry) => ({ ...entry, studyId: study.id }));
}

const studyTabs = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "journal", label: "Journal" },
  { id: "timeline", label: "Chronologie" },
  { id: "objects", label: "Objets" },
  { id: "states", label: "Etats" },
  { id: "longitudinal", label: "Changements" },
  { id: "comparisons", label: "Comparaisons" },
  { id: "transitions", label: "Transitions" },
  { id: "delta", label: "Delta" },
  { id: "recognitions", label: "Reconnaissances" },
  { id: "synthesis", label: "Synthèse" },
  { id: "trajectories", label: "Trajectoires" },
  { id: "questions", label: "Questions" },
  { id: "stats", label: "Statistiques" },
  { id: "history", label: "Historique" },
  { id: "export", label: "Export / import" }
];

function StudyOverview({ study }: { study: Study }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Observations" value={study.observations?.length ?? 0} />
        <StatCard label="Etats" value={study.states.length} />
        <StatCard label="Transitions" value={study.transitions.length} />
        <StatCard label="Changements proposes" value={(study.longitudinalComparisons ?? []).filter((item) => normalizeStatus(item.status) === "proposed").length} />
      </div>
      <Panel title="Parcours de l'etude">
        <p className="text-sm leading-6 text-stone-300">
          Cette page regroupe le journal, les objets generes, les etats, les transitions, Delta et les sources. Chaque resultat doit pouvoir etre relie a une observation.
        </p>
        <TraceabilityHelp />
      </Panel>
    </div>
  );
}

function StudyJournal({
  study,
  observations,
  query,
  sort,
  onQueryChange,
  onSortChange,
  onEdit,
  onArchive,
  onReanalyze,
  onEmotionStatus
}: {
  study: Study;
  observations: NonNullable<Study["observations"]>;
  query: string;
  sort: "desc" | "asc";
  onQueryChange: (value: string) => void;
  onSortChange: (value: "desc" | "asc") => void;
  onEdit: (id: string, rawText: string) => void;
  onArchive: (id: string) => void;
  onReanalyze: () => void;
  onEmotionStatus: (observationId: string, emotionId: string, status: "accepted" | "rejected") => void;
}) {
  return (
    <Panel title="Journal permanent des observations">
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
          placeholder="Rechercher dans les observations et extraits"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <select
          className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as "desc" | "asc")}
        >
          <option className="bg-ink" value="desc">Plus recentes</option>
          <option className="bg-ink" value="asc">Plus anciennes</option>
        </select>
      </div>
      <div className="mb-4">
        <button className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={onReanalyze}>
          Reanalyser toute l&apos;etude
        </button>
      </div>
      {observations.length ? (
        <div className="grid gap-3">
          {observations.map((observation) => (
            <div key={observation.id} className={`rounded-md border p-4 ${observation.status === "archived" ? "border-red-400/30 bg-red-400/10" : "border-white/10 bg-white/[0.04]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-400">{observation.createdAt}</p>
                <Badge>{observation.status}</Badge>
              </div>
              <textarea
                className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm leading-6 text-white"
                value={observation.rawText}
                onChange={(event) => onEdit(observation.id, event.target.value)}
              />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TraceBlock title="Extraits sources" items={observation.sourceExcerpts} />
                <TraceBlock title="Objets generes" items={[
                  ...observation.generatedManifestationIds,
                  ...observation.generatedEmotionIds,
                  ...observation.generatedCatalystIds,
                  ...observation.generatedRelationIds,
                  ...observation.generatedStateIds,
                  ...observation.generatedTransitionIds,
                  ...observation.generatedDeltaIds
                ]} />
              </div>
              <ObservationEmotionReview observation={observation} onEmotionStatus={onEmotionStatus} />
              <ObservationImpact observationId={observation.id} study={study} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200" onClick={() => onArchive(observation.id)}>
                  Archiver
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SmartEmpty text="Cette etude ne contient encore aucune observation validee. Ajoutez une observation depuis le Journal pour commencer." />
      )}
    </Panel>
  );
}

function ObservationImpact({ observationId, study }: { observationId: string; study: Study }) {
  const states = study.states.filter((item) => item.sourceObservationIds?.includes(observationId));
  const transitions = study.transitions.filter((item) => item.sourceObservationIds?.includes(observationId));
  const deltas = (study.deltaScores ?? []).filter((item) => item.sourceObservationIds.includes(observationId));
  const longitudinalComparisons = (study.longitudinalComparisons ?? []).filter((item) => item.sourceObservationIds.includes(observationId));
  const multidimensionalChanges = (study.multidimensionalChanges ?? []).filter((item) => item.sourceObservationIds.includes(observationId));
  return (
    <div className="mt-3 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
      Ce qui semble avoir change : {multidimensionalChanges.length} changement(s) multidimensionnel(s), {longitudinalComparisons.length} comparaison(s) longitudinale(s), {states.length} etat(s), {transitions.length} transition(s), {deltas.length} Delta(s). {states.length || transitions.length || deltas.length || longitudinalComparisons.length || multidimensionalChanges.length ? "" : "Aucune transition complete n'a ete creee, car les donnees restent insuffisantes."}
    </div>
  );
}

function ObservationEmotionReview({
  observation,
  onEmotionStatus
}: {
  observation: NonNullable<Study["observations"]>[number];
  onEmotionStatus: (observationId: string, emotionId: string, status: "accepted" | "rejected") => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">Emotions ou etats detectes</h4>
      {observation.detectedEmotions.length ? (
        <div className="mt-2 grid gap-2">
          {observation.detectedEmotions.map((emotion) => (
            <div key={emotion.id} className="rounded-md border border-white/10 bg-black/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{emotion.originalExpression ?? emotion.label}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{emotion.canonicalEmotion ?? emotion.emotion}</Badge>
                  <Badge>{emotion.status}</Badge>
                  <Badge>{emotion.polarity ?? "present"}</Badge>
                  <Badge>{emotion.scope ?? "indeterminate"}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-300">{emotion.sourceExcerpt}</p>
              {emotion.status === "proposed" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={() => onEmotionStatus(observation.id, emotion.id, "accepted")}>
                    Accepter
                  </button>
                  <button className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200" onClick={() => onEmotionStatus(observation.id, emotion.id, "rejected")}>
                    Rejeter
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-500">Aucune emotion explicite detectee dans ce texte.</p>
      )}
    </div>
  );
}

function StudyObjects({ study, updateStudy }: { study: Study; updateStudy: (study: Study) => void }) {
  function updateRelationProposal(id: string, status: "accepted" | "rejected") {
    const proposal = (study.relationProposals ?? []).find((item) => item.id === id);
    if (!proposal) return;
    const relation = status === "accepted"
      ? {
          id: `relation-${crypto.randomUUID()}`,
          source: proposal.sourceA,
          target: proposal.sourceB,
          type: proposal.relationType,
          strength: Math.round(proposal.confidence * 100),
          date: new Date().toISOString().slice(0, 10),
          evidenceLevel: 1 as const,
          note: proposal.reason,
          status: "confirmée" as const,
          sourceObservationIds: proposal.sourceObservationIds,
          sourceExcerpt: proposal.sourceExcerpt,
          validatedProposalIds: [proposal.id],
          engineProvenance: [proposal.engine],
          createdFromObservationAt: proposal.createdAt,
          confidence: proposal.confidence,
          methodologicalStatus: "Relation validee par l'utilisateur"
        }
      : null;
    updateStudy({
      ...study,
      relationProposals: (study.relationProposals ?? []).map((item) =>
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
      ),
      relations: relation ? [...study.relations, relation] : study.relations,
      structuredHistory: [
        ...(study.structuredHistory ?? []),
        {
          id: `history-${crypto.randomUUID()}`,
          date: new Date().toISOString(),
          actionType: status === "accepted" ? "relation validee" : "proposition rejetee",
          objectType: "PersistentRelationProposal",
          objectId: proposal.id,
          sourceObservationIds: proposal.sourceObservationIds,
          summary: status === "accepted" ? "Relation proposee acceptee." : "Relation proposee rejetee et conservee."
        }
      ]
    });
  }
  return (
    <div className="grid gap-4">
      <Panel title="Manifestations"><ObjectList items={study.manifestations.map((item) => ({ id: item.id, label: item.title, source: item.sourceExcerpt }))} /></Panel>
      <Panel title="Concepts"><TagBlock title="Concepts detectes" items={[...new Set((study.observations ?? []).flatMap((observation) => observation.detectedConcepts.map((concept) => concept.label)))]} /></Panel>
      <Panel title="Emotions"><ObjectList items={study.emotionObservations.map((item) => ({ id: item.id, label: item.emotion, source: item.sourceExcerpt ?? item.context }))} /></Panel>
      <Panel title="Catalyseurs"><ObjectList items={study.catalysts.map((item) => ({ id: item.id, label: item.name, source: item.sourceExcerpt ?? item.context }))} /></Panel>
      <Panel title="Relations"><ObjectList items={study.relations.map((item) => ({ id: item.id, label: `${item.source} -> ${item.target}`, source: item.sourceExcerpt ?? item.note }))} /></Panel>
      <Panel title="Relations a examiner">
        {(study.relationProposals ?? []).length ? (
          <div className="grid gap-2">
            {(study.relationProposals ?? []).map((item) => (
              <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{item.label}</p>
                  <Badge>{item.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-300">{item.reason}</p>
                <p className="mt-1 text-xs text-stone-500">{item.sourceExcerpt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={() => updateRelationProposal(item.id, "accepted")}>
                    Accepter
                  </button>
                  <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => updateRelationProposal(item.id, "rejected")}>
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SmartEmpty text="Aucune relation a examiner." />
        )}
      </Panel>
    </div>
  );
}

function StudyStates({ study, updateStudy }: { study: Study; updateStudy: (study: Study) => void }) {
  if (!study.states.length) return <SmartEmpty text="Cette etude ne contient encore aucun etat. Les etats sont generes automatiquement apres observations suffisantes." />;
  function updateState(id: string, patch: Partial<Study["states"][number]>) {
    updateStudy({
      ...study,
      states: study.states.map((state) => (state.id === id ? { ...state, ...patch } : state))
    });
  }
  return (
    <div className="grid gap-4">
      {study.states.map((state) => (
        <Panel key={state.id} title={state.title}>
          <p className="text-sm text-stone-400">{state.date}</p>
          <p className="mt-3 leading-7 text-stone-100">{state.formulation}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="Stabilite" value={`${state.stability}/10`} />
            <StatCard label="Confiance" value={`${state.confidence}/10`} />
            <StatCard label="Validation" value={state.validationStatus ?? "a valider"} />
          </div>
          <TagBlock title="Concepts" items={[...state.confirmedElements, ...state.uncertainElements]} />
          <TagBlock title="Langage / emotions" items={state.language} />
          <TagBlock title="Decisions / comportements" items={state.associatedBehaviors} />
          <TraceBlock title="Observations sources" items={state.sourceObservationIds ?? []} />
          <TraceBlock title="Extrait source" items={state.sourceExcerpt ? [state.sourceExcerpt] : []} />
          <div className="mt-4 flex flex-wrap gap-2">
            {(["valide", "conteste", "revision demandee"] as const).map((status) => (
              <button key={status} className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => updateState(state.id, { validationStatus: status })}>
                {status}
              </button>
            ))}
          </div>
          <textarea
            className="mt-3 min-h-20 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
            placeholder="Commentaire utilisateur"
            value={(state.userComments ?? []).join("\n")}
            onChange={(event) => updateState(state.id, { userComments: event.target.value.split("\n").filter(Boolean) })}
          />
        </Panel>
      ))}
    </div>
  );
}

function StudyLongitudinalComparisons({ study, updateStudy }: { study: Study; updateStudy: (study: Study) => void }) {
  const comparisons = (study.longitudinalComparisons ?? []).map(normalizeComparison);
  const [filter, setFilter] = useState<"active" | "validated" | "edited" | "rejected">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<LongitudinalEditingState | null>(null);

  const filteredComparisons = comparisons.filter((comparison) => {
    const status = normalizeStatus(comparison.status);
    if (filter === "active") return status === "proposed" || status === "edited";
    return status === filter;
  });

  function runAction(id: string, action: () => { study: Study; message: string }) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const result = action();
      updateStudy(result.study);
      setNotice(result.message);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Action impossible.";
      console.error("longitudinal-review-action", { id, message });
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(comparison: NonNullable<Study["longitudinalComparisons"]>[number]) {
    const normalized = normalizeComparison(comparison);
    const currentPatch = longitudinalEditPatchFromComparison(normalized);
    const initialPatch = normalized.initialVersion ? longitudinalEditPatchFromInitialVersion(normalized.initialVersion, currentPatch) : currentPatch;
    setEditing({ ...currentPatch, id: normalized.id, initial: initialPatch });
  }

  function saveEdit() {
    if (!editing) return;
    runAction(editing.id, () => {
      const result = editLongitudinalComparison(study, editing.id, editing);
      setEditing(null);
      return result;
    });
  }

  function validateComparison(id: string) {
    if (!window.confirm("Valider cette proposition comme transition persistante ?")) return;
    runAction(id, () => validateLongitudinalComparison(study, id));
  }

  function rejectComparison(id: string) {
    const reason = window.prompt(
      "Motif du rejet : comparaison non pertinente, donnees insuffisantes, mauvaise interpretation, observations non comparables, autre",
      "donnees insuffisantes"
    );
    if (reason === null) return;
    runAction(id, () => rejectLongitudinalComparison(study, id, reason));
  }

  return (
    <Panel title="Changements detectes entre observations">
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["active", "A examiner"],
          ["validated", "Validees"],
          ["edited", "Modifiees"],
          ["rejected", "Rejetees"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-md border px-3 py-2 text-sm ${filter === id ? "border-gold/60 bg-gold/10 text-goldSoft" : "border-white/10 text-stone-200"}`}
            onClick={() => setFilter(id as typeof filter)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? <div className="mb-4 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm text-goldSoft">{notice}</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
      {editing ? (
        <LongitudinalEditPanel
          value={editing}
          onChange={setEditing}
          onSave={saveEdit}
          onCancel={() => setEditing(null)}
          disabled={busyId === editing.id}
        />
      ) : null}
      <CategorizedLongitudinalSections comparisons={filteredComparisons} />
      {filteredComparisons.length ? (
        <div className="grid gap-4">
          {filteredComparisons.map((comparison) => {
            const status = normalizeStatus(comparison.status);
            const previous = comparison.previousObservationId
              ? (study.observations ?? []).find((observation) => observation.id === comparison.previousObservationId)
              : null;
            const current = (study.observations ?? []).find((observation) => observation.id === comparison.currentObservationId);
            const disabled = busyId === comparison.id;
            const canValidateTransition = comparison.resultStatus === "transition_candidate" || comparison.resultStatus === "observable_understanding_change";
            return (
              <div key={comparison.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white">{comparison.title ?? comparison.potentialTransition ?? "Comparaison longitudinale"}</h3>
                    <p className="mt-1 text-sm text-stone-400">{comparison.comparedAt} · {comparison.engineVersion}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{longitudinalStatusLabel(status)}</Badge>
                    <Badge>Confiance {comparison.confidence}</Badge>
                  </div>
                </div>
                <p className="mt-3 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
                  {comparison.conclusion}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <TraceBlock title="Observation anterieure" items={previous ? [previous.rawText] : ["Aucune comparaison suffisante"]} />
                  <TraceBlock title="Observation actuelle" items={current ? [current.rawText] : [comparison.currentObservationId]} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <TraceBlock title="Etat anterieur propose" items={(comparison.previousStateProposal ?? comparison.proposedPreviousState)?.elements ?? ["Non propose"]} />
                  <TraceBlock title="Etat actuel propose" items={(comparison.currentStateProposal ?? comparison.proposedCurrentState)?.elements ?? ["Non propose"]} />
                </div>
                <TraceBlock
                  title="Dimensions comparees"
                  items={comparison.dimensionsCompared.map((dimension) =>
                    `${dimension.label} : avant [${dimension.previous.join(", ") || "non renseigne"}] / actuel [${dimension.current.join(", ") || "non renseigne"}]`
                  )}
                />
                <TraceBlock title="Differences" items={(comparison.detectedDifferences ?? comparison.differences).map((difference) => difference.summary)} />
                <TraceBlock title="Perturbations et emotions" items={comparison.emotionalPerturbations ?? []} />
                <TraceBlock title="Interpretations de l'observateur" items={comparison.observerInterpretations ?? []} />
                <TraceBlock title="Formulations directes de la personne" items={comparison.directPersonFormulations ?? []} />
                <TraceBlock title="Transformations observables" items={comparison.observableTransformations ?? []} />
                <TraceBlock title="Limites" items={comparison.limitations ?? comparison.methodologicalLimits} />
                <TraceBlock title="Donnees manquantes" items={comparison.missingData} />
                <TraceBlock title="Raison de l'absence de transition" items={comparison.noTransitionReason ? [comparison.noTransitionReason] : []} />
                <TraceBlock title="Questions de confirmation" items={comparison.questions ?? comparison.confirmationQuestions} />
                <TraceBlock title="Extraits sources" items={comparison.sourceExcerpts.map((item) => `${item.observationId} : ${item.excerpt}`)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {status === "validated" && comparison.generatedTransitionId ? (
                    <>
                      <button type="button" className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={() => setNotice(`Transition : ${comparison.generatedTransitionId}`)}>
                        Voir la transition
                      </button>
                      <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => setNotice(`Etats : ${(comparison.previousStateProposal ?? comparison.proposedPreviousState)?.summary ?? "etat anterieur"} / ${(comparison.currentStateProposal ?? comparison.proposedCurrentState)?.summary ?? "etat actuel"}`)}>
                        Voir les etats
                      </button>
                      <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => setNotice(`Observations sources : ${comparison.sourceObservationIds.join(", ")}`)}>
                        Voir les observations sources
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft disabled:opacity-50"
                        disabled={disabled || !canValidateTransition}
                        title={canValidateTransition ? "Valider cette transition candidate" : (comparison.noTransitionReason ?? "Donnees insuffisantes")}
                        onClick={() => validateComparison(comparison.id)}
                      >
                        {disabled ? "Traitement..." : "Valider comme transition"}
                      </button>
                      <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200 disabled:opacity-50" disabled={disabled} onClick={() => openEdit(comparison)}>
                        Modifier
                      </button>
                      <button type="button" className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200 disabled:opacity-50" disabled={disabled} onClick={() => rejectComparison(comparison.id)}>
                        Rejeter
                      </button>
                    </>
                  )}
                  {comparison.generatedDeltaId ? (
                    <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => setNotice(`Delta : ${comparison.generatedDeltaId}`)}>
                      Voir Delta
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <SmartEmpty text={comparisons.length ? "Aucune proposition dans ce filtre." : "Aucune comparaison suffisante pour le moment. Une comparaison sera produite apres chaque nouvelle observation."} />
      )}
    </Panel>
  );
}

function CategorizedLongitudinalSections({
  comparisons
}: {
  comparisons: LongitudinalComparisonView[];
}) {
  const emotional = comparisons.filter((comparison) => comparison.resultStatus === "emotional_perturbation" || (comparison.emotionalPerturbations ?? []).length);
  const reformulations = comparisons.filter((comparison) =>
    comparison.resultStatus === "possible_reformulation"
    || comparison.resultStatus === "observable_understanding_change"
    || (comparison.observerInterpretations ?? []).length
    || (comparison.directPersonFormulations ?? []).length
  );
  const transitions = comparisons.filter((comparison) => comparison.resultStatus === "transition_candidate");
  return (
    <div className="mb-4 grid gap-3">
      <LongitudinalSectionSummary
        title="Perturbations et evolutions emotionnelles"
        empty="Aucune trajectoire emotionnelle explicite dans ce filtre. Si les observations decrivent seulement une perturbation sans formulation directe, elle apparaitra ici avec un Delta non calculable."
        comparisons={emotional}
        describe={(comparison) => comparison.emotionalPerturbations?.join(" ; ") || comparison.conclusion}
      />
      <LongitudinalSectionSummary
        title="Changements de formulation possibles"
        empty="Aucune reformulation possible dans ce filtre. Une interpretation du narrateur sera conservee comme hypothese, sans devenir automatiquement une transition."
        comparisons={reformulations}
        describe={(comparison) =>
          [
            ...(comparison.directPersonFormulations ?? []),
            ...(comparison.observerInterpretations ?? [])
          ].join(" ; ") || comparison.conclusion
        }
      />
      <LongitudinalSectionSummary
        title="Transitions de comprehension validables"
        empty="Aucune transition validable dans ce filtre. Il faut deux formulations de comprehension, ou une transformation observable documentee, avant validation utilisateur et calcul du Delta."
        comparisons={transitions}
        describe={(comparison) => comparison.potentialTransition ?? comparison.conclusion}
      />
    </div>
  );
}

type LongitudinalComparisonView = ReturnType<typeof normalizeComparison>;

function LongitudinalSectionSummary({
  title,
  empty,
  comparisons,
  describe
}: {
  title: string;
  empty: string;
  comparisons: LongitudinalComparisonView[];
  describe: (comparison: LongitudinalComparisonView) => string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Badge>{comparisons.length}</Badge>
      </div>
      {comparisons.length ? (
        <div className="mt-3 grid gap-2">
          {comparisons.map((comparison) => (
            <div key={`${title}-${comparison.id}`} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm leading-6 text-stone-200">{describe(comparison)}</p>
              <p className="mt-1 text-xs text-stone-500">
                Observations : {comparison.sourceObservationIds.join(", ")} · {comparison.methodologicalStatus}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-stone-400">{empty}</p>
      )}
    </section>
  );
}

type LongitudinalEditingState = LongitudinalEditPatch & { id: string; initial: LongitudinalEditPatch };

function longitudinalEditPatchFromComparison(comparison: NonNullable<Study["longitudinalComparisons"]>[number]): LongitudinalEditPatch {
  return {
    title: comparison.title ?? comparison.potentialTransition ?? "Comparaison longitudinale",
    conclusion: comparison.conclusion,
    previousStateProposal: comparison.previousStateProposal ?? comparison.proposedPreviousState,
    currentStateProposal: comparison.currentStateProposal ?? comparison.proposedCurrentState,
    dimensionsCompared: comparison.dimensionsCompared,
    detectedDifferences: comparison.detectedDifferences ?? comparison.differences,
    confidence: comparison.confidence,
    limitations: comparison.limitations ?? comparison.methodologicalLimits,
    questions: comparison.questions ?? comparison.confirmationQuestions,
    sourceExcerpts: comparison.sourceExcerpts
  };
}

function longitudinalEditPatchFromInitialVersion(
  initialVersion: NonNullable<NonNullable<Study["longitudinalComparisons"]>[number]["initialVersion"]>,
  fallback: LongitudinalEditPatch
): LongitudinalEditPatch {
  return {
    title: initialVersion.title ?? fallback.title,
    conclusion: initialVersion.conclusion ?? fallback.conclusion,
    previousStateProposal: initialVersion.proposedPreviousState ?? fallback.previousStateProposal,
    currentStateProposal: initialVersion.proposedCurrentState ?? fallback.currentStateProposal,
    dimensionsCompared: initialVersion.dimensionsCompared ?? fallback.dimensionsCompared,
    detectedDifferences: initialVersion.differences ?? fallback.detectedDifferences,
    confidence: initialVersion.confidence ?? fallback.confidence,
    limitations: initialVersion.methodologicalLimits ?? fallback.limitations,
    questions: initialVersion.confirmationQuestions ?? fallback.questions,
    sourceExcerpts: initialVersion.sourceExcerpts ?? fallback.sourceExcerpts
  };
}

function LongitudinalEditPanel({
  value,
  onChange,
  onSave,
  onCancel,
  disabled
}: {
  value: LongitudinalEditingState;
  onChange: (value: LongitudinalEditingState) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4 rounded-md border border-gold/25 bg-gold/10 p-4">
      <h3 className="font-semibold text-white">Modifier la proposition</h3>
      <div className="mt-3 grid gap-3">
        <Field label="Titre" value={value.title} onChange={(title) => onChange({ ...value, title })} />
        <Textarea label="Description du changement" value={value.conclusion} onChange={(conclusion) => onChange({ ...value, conclusion })} />
        <Textarea
          label="Etat anterieur propose"
          value={value.previousStateProposal?.summary ?? ""}
          onChange={(summary) =>
            onChange({
              ...value,
              previousStateProposal: value.previousStateProposal
                ? { ...value.previousStateProposal, summary, elements: splitLines(summary) }
                : { scope: "indetermine", evidenceLevel: "faible", summary, elements: splitLines(summary) }
            })
          }
        />
        <Textarea
          label="Etat actuel propose"
          value={value.currentStateProposal?.summary ?? ""}
          onChange={(summary) =>
            onChange({
              ...value,
              currentStateProposal: value.currentStateProposal
                ? { ...value.currentStateProposal, summary, elements: splitLines(summary) }
                : { scope: "indetermine", evidenceLevel: "faible", summary, elements: splitLines(summary) }
            })
          }
        />
        <Textarea
          label="Dimensions comparees"
          value={value.dimensionsCompared.map((dimension) => `${dimension.label}: ${dimension.previous.join(", ")} -> ${dimension.current.join(", ")}`).join("\n")}
          onChange={(text) => onChange({ ...value, dimensionsCompared: parseDimensionLines(text, value.dimensionsCompared) })}
        />
        <Textarea
          label="Differences"
          value={value.detectedDifferences.map((difference) => difference.summary).join("\n")}
          onChange={(text) =>
            onChange({
              ...value,
              detectedDifferences: splitLines(text).map((summary, index) => value.detectedDifferences[index] ? { ...value.detectedDifferences[index], summary } : {
                dimension: "concepts",
                label: "Difference utilisateur",
                previous: [],
                current: [],
                summary
              })
            })
          }
        />
        <label className="grid gap-2">
          <span className="text-sm font-medium text-stone-200">Confiance utilisateur</span>
          <select
            className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
            value={value.confidence}
            onChange={(event) => onChange({ ...value, confidence: event.target.value as LongitudinalEditPatch["confidence"] })}
          >
            <option className="bg-ink" value="faible">faible</option>
            <option className="bg-ink" value="moyen">moyen</option>
            <option className="bg-ink" value="eleve">eleve</option>
          </select>
        </label>
        <Textarea label="Limites" value={value.limitations.join("\n")} onChange={(text) => onChange({ ...value, limitations: splitLines(text) })} />
        <Textarea label="Questions ouvertes" value={value.questions.join("\n")} onChange={(text) => onChange({ ...value, questions: splitLines(text) })} />
        <Textarea
          label="Extraits sources selectionnes"
          value={value.sourceExcerpts.map((item) => `${item.observationId}: ${item.excerpt}`).join("\n")}
          onChange={(text) =>
            onChange({
              ...value,
              sourceExcerpts: splitLines(text).map((line) => {
                const [observationId, ...excerpt] = line.split(":");
                return { observationId: observationId.trim(), excerpt: excerpt.join(":").trim() };
              })
            })
          }
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night disabled:opacity-50" disabled={disabled} onClick={onSave}>
          Enregistrer
        </button>
        <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" disabled={disabled} onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" disabled={disabled} onClick={() => onChange({ ...value.initial, id: value.id, initial: value.initial })}>
          Revenir a la proposition initiale
        </button>
      </div>
    </div>
  );
}

function longitudinalStatusLabel(status: ReturnType<typeof normalizeStatus>) {
  if (status === "validated") return "Validee";
  if (status === "edited") return "Modifiee";
  if (status === "rejected") return "Rejetee";
  return "Proposition";
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function parseDimensionLines(value: string, fallback: LongitudinalEditPatch["dimensionsCompared"]) {
  return splitLines(value).map((line, index) => {
    const [labelPart, values = ""] = line.split(":");
    const [previous = "", current = ""] = values.split("->");
    const base = fallback[index];
    return {
      key: base?.key ?? `user-dimension-${index + 1}`,
      label: labelPart.trim() || base?.label || "Dimension utilisateur",
      previous: previous.split(",").map((item) => item.trim()).filter(Boolean),
      current: current.split(",").map((item) => item.trim()).filter(Boolean)
    };
  });
}

function StudyTransitions({ study }: { study: Study }) {
  if (!study.transitions.length) return <SmartEmpty text="Aucune transition complete. Une transition necessite deux etats suffisamment documentes." />;
  return (
    <div className="grid gap-4">
      {study.transitions.map((transition) => {
        const delta = (study.deltaScores ?? []).find((item) => item.id === transition.deltaScoreId);
        return (
          <Panel key={transition.id} title={transition.title}>
            <p className="text-sm leading-6 text-stone-300">{transition.explanation ?? "Transition generee depuis les observations validees."}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <StatCard label="Etat depart" value={transition.fromStateId} />
              <StatCard label="Etat arrivee" value={transition.toStateId} />
              <StatCard label="Delta" value={delta?.interpretationLabel ?? "Calcul non disponible"} />
            </div>
            <TagBlock title="Manifestations" items={transition.triggeringManifestations} />
            <TagBlock title="Relations" items={transition.newRelations} />
            <TagBlock title="Emotions" items={transition.emotions} />
            <TagBlock title="Catalyseurs" items={transition.catalysts} />
            <TraceBlock title="Sources" items={transition.sourceObservationIds ?? []} />
            {delta ? <DeltaDetails delta={delta} /> : <SmartEmpty text="Delta necessite deux etats valides." />}
          </Panel>
        );
      })}
    </div>
  );
}

function StudyDelta({ study }: { study: Study }) {
  const deltas = study.deltaScores ?? [];
  if (!deltas.length) return <SmartEmpty text="Delta necessite une transition entre deux etats suffisamment documentes." />;
  return (
    <div className="grid gap-4">
      {deltas.map((delta) => (
        <Panel key={delta.id} title={delta.interpretationLabel}>
          <DeltaDetails delta={delta} />
        </Panel>
      ))}
    </div>
  );
}

function DeltaDetails({ delta }: { delta: NonNullable<Study["deltaScores"]>[number] }) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Score brut" value={delta.rawScore} />
        <StatCard label="Facteurs positifs" value={delta.positiveFactors.length} />
        <StatCard label="Facteurs neutres" value={delta.neutralFactors.length} />
        <StatCard label="Facteurs negatifs" value={delta.negativeFactors.length} />
      </div>
      <TraceBlock title="Observations sources" items={delta.sourceObservationIds} />
      <TraceBlock title="Limites" items={delta.limitations} />
      <TraceBlock title="Donnees manquantes" items={delta.missingData} />
    </div>
  );
}

function StudyTrajectories({ study, studies }: { study: Study; studies: Study[] }) {
  const comparisons = TrajectoryEngine.compare(studies).filter((item) => item.studyIds.includes(study.id));
  return (
    <Panel title="Trajectoires">
      {comparisons.length ? (
        <div className="grid gap-3">
          {comparisons.map((comparison) => (
            <div key={comparison.studyIds.join("-")} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">{comparison.studyIds.join(" / ")}</p>
                <Badge>{comparison.similarity}</Badge>
              </div>
              <TraceBlock title="Etapes communes" items={comparison.commonSteps} />
              <TraceBlock title="Catalyseurs communs" items={comparison.commonCatalysts} />
              <TraceBlock title="Emotions recurrentes" items={comparison.commonEmotions} />
              <TraceBlock title="Limites" items={comparison.limits} />
            </div>
          ))}
        </div>
      ) : (
        <SmartEmpty text="Comparer plusieurs trajectoires necessite au moins deux etudes." />
      )}
    </Panel>
  );
}

function StudyQuestions({ study, updateStudy }: { study: Study; updateStudy: (study: Study) => void }) {
  const questions = study.openQuestions ?? [];
  return (
    <Panel title="Questions ouvertes">
      {questions.length ? (
        <div className="grid gap-3">
          {questions.map((question) => (
            <div key={question.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{question.text}</p>
                <Badge>{question.status}</Badge>
              </div>
              <input
                className="mt-3 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                placeholder="Reponse"
                value={question.answer ?? ""}
                onChange={(event) =>
                  updateStudy({
                    ...study,
                    openQuestions: questions.map((item) =>
                      item.id === question.id ? { ...item, answer: event.target.value, status: event.target.value ? "repondue" : "ouverte", resolvedAt: event.target.value ? new Date().toISOString() : undefined } : item
                    )
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <SmartEmpty text="Aucune question ouverte. Les questions apparaissent apres validation d'une observation." />
      )}
    </Panel>
  );
}

function StudyStats({ study }: { study: Study }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Manifestations" value={study.manifestations.length} />
      <StatCard label="Relations" value={study.relations.length} />
      <StatCard label="Catalyseurs" value={study.catalysts.length} />
      <StatCard label="Reconnaissances" value={study.recognitions.length} />
    </div>
  );
}

function StudyHistory({ study }: { study: Study }) {
  const entries = study.structuredHistory ?? [];
  return (
    <Panel title="Historique complet">
      {entries.length ? (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{entry.summary}</span>
                <Badge>{entry.actionType}</Badge>
              </div>
              <p className="mt-1 text-xs text-stone-500">{entry.date} - {entry.objectType}:{entry.objectId}</p>
            </div>
          ))}
        </div>
      ) : (
        <SmartEmpty text="Aucun historique structure disponible pour cette etude." />
      )}
    </Panel>
  );
}

function StudySynthesisPanel({
  study,
  updateStudy,
  generateStudySynthesis
}: {
  study: Study;
  updateStudy: (study: Study) => void;
  generateStudySynthesis: (studyId: string) => string;
}) {
  const syntheses = study.studySyntheses ?? [];
  const active = syntheses.find((item) => item.id === study.activeStudySynthesisId) ?? syntheses[0];
  const [selectedId, setSelectedId] = useState(active?.id ?? "");
  const [compareId, setCompareId] = useState(syntheses.find((item) => item.id !== selectedId)?.id ?? "");
  const [progress, setProgress] = useState(0);
  const selected = syntheses.find((item) => item.id === selectedId) ?? active;
  const compared = syntheses.find((item) => item.id === compareId);

  function runGeneration() {
    setProgress(15);
    window.setTimeout(() => {
      const id = generateStudySynthesis(study.id);
      setSelectedId(id);
      setProgress(100);
      window.setTimeout(() => setProgress(0), 700);
    }, 40);
  }

  function restoreVersion(synthesis: StudySynthesis) {
    updateStudy({ ...study, activeStudySynthesisId: synthesis.id, updatedAt: new Date().toISOString() });
    setSelectedId(synthesis.id);
  }

  return (
    <div className="grid gap-4">
      <Panel title="Synthèse d'étude">
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night" onClick={runGeneration}>
            <FileText className="h-4 w-4" aria-hidden /> Générer la synthèse
          </button>
          {selected ? (
            <>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => downloadMarkdown(selected)}>
                <Download className="h-4 w-4" aria-hidden /> Markdown
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => printSynthesisPdf(selected)}>
                <Download className="h-4 w-4" aria-hidden /> PDF
              </button>
            </>
          ) : null}
        </div>
        {progress ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-stone-400">{progress < 100 ? "Analyse en cours..." : "Synthèse générée."}</p>
          </div>
        ) : null}
        {!selected ? (
          <div className="mt-4">
            <SmartEmpty text="Aucune synthèse générée. Lancez une génération manuelle pour analyser les observations de cette étude." />
          </div>
        ) : null}
      </Panel>

      {selected ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Version" value={`v${selected.version}`} />
            <StatCard label="Observations" value={selected.observationsAnalyzed} />
            <StatCard label="Durée" value={`${selected.analysisDurationMs} ms`} />
            <StatCard label="Modèle" value={selected.model.replace("StudySynthesisEngine:", "")} />
          </div>

          <Panel title="Versions">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Version consultée</span>
                <select className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
                  {syntheses.map((synthesis) => (
                    <option key={synthesis.id} value={synthesis.id}>v{synthesis.version} - {formatBuildDate(synthesis.generatedAt)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-200">Comparer avec</span>
                <select className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white" value={compareId} onChange={(event) => setCompareId(event.target.value)}>
                  <option value="">Aucune comparaison</option>
                  {syntheses.filter((synthesis) => synthesis.id !== selected.id).map((synthesis) => (
                    <option key={synthesis.id} value={synthesis.id}>v{synthesis.version} - {formatBuildDate(synthesis.generatedAt)}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={() => restoreVersion(selected)}>
                  Revenir à cette version
                </button>
              </div>
            </div>
            {compared ? <SynthesisComparison current={selected} compared={compared} /> : null}
          </Panel>

          <SynthesisReport synthesis={selected} />
        </>
      ) : null}
    </div>
  );
}

function SynthesisReport({ synthesis }: { synthesis: StudySynthesis }) {
  return (
    <div className="grid gap-4">
      {synthesis.sections.map((section) => (
        <Panel key={section.id} title={section.title}>
          <div className="grid gap-3">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-paragraph-${index}`} className="text-sm leading-6 text-stone-300">{paragraph}</p>
            ))}
            {section.claims.length ? (
              <div className="grid gap-2">
                {section.claims.map((claim) => (
                  <div key={claim.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{claim.kind}</Badge>
                      <Badge>Confiance : {claim.confidence}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white">{claim.text}</p>
                    <p className="mt-2 text-xs leading-5 text-stone-400">{claim.justification}</p>
                    <div className="mt-2 grid gap-1">
                      {claim.evidence.length ? claim.evidence.map((evidence) => (
                        <p key={`${claim.id}-${evidence.observationId}`} className="text-xs leading-5 text-stone-500">
                          Source {evidence.observationId} : {evidence.excerpt}
                        </p>
                      )) : <p className="text-xs text-stone-500">Aucune observation directe suffisante.</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function SynthesisComparison({ current, compared }: { current: StudySynthesis; compared: StudySynthesis }) {
  const currentClaims = current.sections.flatMap((section) => section.claims);
  const comparedClaims = compared.sections.flatMap((section) => section.claims);
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <StatCard label="Observations v actuelle" value={current.observationsAnalyzed} />
      <StatCard label="Observations comparée" value={compared.observationsAnalyzed} />
      <StatCard label="Conclusions nouvelles" value={Math.max(0, currentClaims.length - comparedClaims.length)} />
    </div>
  );
}

function downloadMarkdown(synthesis: StudySynthesis) {
  downloadText(synthesisFilename(synthesis, "md"), synthesis.markdown, "text/markdown");
}

function printSynthesisPdf(synthesis: StudySynthesis) {
  const printable = window.open("", "_blank", "noopener,noreferrer");
  if (!printable) return;
  printable.document.write(`<!doctype html><html><head><title>${escapeHtml(synthesisFilename(synthesis, "html"))}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;padding:32px;color:#111} h1,h2{color:#111} pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${escapeHtml(synthesis.markdown)}</pre><script>window.print();</script></body></html>`);
  printable.document.close();
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function StudyExportImport({ study }: { study: Study }) {
  return (
    <Panel title="Export / import de l'etude">
      <div className="grid gap-3 md:grid-cols-2">
        <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => exportStudy(study)}>
          <Download className="mr-2 inline h-4 w-4" aria-hidden /> Exporter l&apos;etude active
        </button>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
          Import securise a finaliser : previsualisation des conflits, fusion, remplacement et import comme nouvelle etude.
        </div>
      </div>
    </Panel>
  );
}

function ObjectList({ items }: { items: Array<{ id: string; label: string; source?: string }> }) {
  if (!items.length) return <SmartEmpty text="Aucune donnee disponible pour cette section." />;
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
          <p className="font-medium text-white">{item.label}</p>
          {item.source ? <p className="mt-1 text-sm leading-6 text-stone-400">{item.source}</p> : null}
        </div>
      ))}
    </div>
  );
}

function TraceBlock({ title, items }: { title: string; items: string[] }) {
  return <TagBlock title={title} items={items.length ? items : ["Non renseigne"]} />;
}

function TraceabilityHelp() {
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
      Chaque carte affiche ses sources lorsque les observations validees ont produit des objets scientifiques.
    </div>
  );
}

function SmartEmpty({ text }: { text: string }) {
  return <div className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">{text}</div>;
}

function Studies(props: {
  studies: Study[];
  selectedStudyId: string | null;
  selectStudy: (id: string) => void;
  updateStudy: (study: Study) => void;
  deleteStudy: (id: string) => void;
  duplicateStudy: (id: string) => void;
  generateStudySynthesis: (studyId: string) => string;
  isDeletingStudy: boolean;
  studyNotice: string;
}) {
  const selected = props.selectedStudyId ? props.studies.find((study) => study.id === props.selectedStudyId) : undefined;
  const [tab, setTab] = useState("overview");
  const [journalQuery, setJournalQuery] = useState("");
  const [journalSort, setJournalSort] = useState<"desc" | "asc">("desc");
  const observations = (selected?.observations ?? [])
    .filter((observation) =>
      `${observation.rawText} ${observation.sourceExcerpts.join(" ")}`.toLowerCase().includes(journalQuery.toLowerCase())
    )
    .sort((left, right) => (journalSort === "desc" ? right.createdAt.localeCompare(left.createdAt) : left.createdAt.localeCompare(right.createdAt)));

  function updateObservationRawText(observationId: string, rawText: string) {
    if (!selected) return;
    props.updateStudy({
      ...selected,
      observations: (selected.observations ?? []).map((observation) =>
        observation.id === observationId ? { ...observation, rawText, updatedAt: new Date().toISOString() } : observation
      )
    });
  }

  function archiveObservation(observationId: string) {
    if (!selected) return;
    const observation = (selected.observations ?? []).find((item) => item.id === observationId);
    if (!observation) return;
    const linkedCount = [
      ...observation.generatedManifestationIds,
      ...observation.generatedEmotionIds,
      ...observation.generatedCatalystIds,
      ...observation.generatedRelationIds,
      ...observation.generatedStateIds,
      ...observation.generatedTransitionIds,
      ...observation.generatedRecognitionIds,
      ...observation.generatedTimelineEventIds,
      ...observation.generatedDeltaIds
    ].length;
    const message = linkedCount
      ? "Cette observation a produit des objets scientifiques. Elle sera archivee et les objets lies resteront consultables avec leur provenance. Continuer ?"
      : "Supprimer cette observation ?";
    if (!window.confirm(message)) return;
    props.updateStudy({
      ...selected,
      observations: (selected.observations ?? []).map((item) =>
        item.id === observationId ? { ...item, status: "archived", updatedAt: new Date().toISOString() } : item
      )
    });
  }

  function reanalyzeStudyObservations() {
    if (!selected) return;
    const now = new Date().toISOString();
    const updatedObservations = (selected.observations ?? []).map((observation) => {
      const draft = parseObservation(observation.rawText, observation.createdAt);
      const existingKeys = new Set(
        observation.detectedEmotions.map((emotion) =>
          `${(emotion.canonicalEmotion ?? emotion.emotion).toLowerCase()}-${(emotion.originalExpression ?? emotion.label).toLowerCase()}-${emotion.sourceExcerpt}`
        )
      );
      const newEmotions = draft.detectedEmotions.filter((emotion) => {
        const key = `${(emotion.canonicalEmotion ?? emotion.emotion).toLowerCase()}-${(emotion.originalExpression ?? emotion.label).toLowerCase()}-${emotion.sourceExcerpt}`;
        return !existingKeys.has(key);
      });
      return newEmotions.length
        ? {
            ...observation,
            detectedEmotions: [...observation.detectedEmotions, ...newEmotions],
            detectedDimensions: extractCanonicalDimensions({ ...observation, detectedEmotions: [...observation.detectedEmotions, ...newEmotions] }),
            updatedAt: now,
            enginesExecuted: [...new Set([...observation.enginesExecuted, "EmotionExtractor", "DimensionExtractor", "MultidimensionalChangeEngine"])],
            engineResultsSummary: [...observation.engineResultsSummary, `${newEmotions.length} emotion(s) proposee(s) apres reanalyse. Dimensions canoniques recalculees.`]
          }
        : {
            ...observation,
            detectedDimensions: extractCanonicalDimensions(observation),
            enginesExecuted: [...new Set([...observation.enginesExecuted, "DimensionExtractor", "MultidimensionalChangeEngine"])]
          };
    });
    const emotionReanalyzedStudy: Study = {
      ...selected,
      observations: updatedObservations,
      structuredHistory: [
        ...(selected.structuredHistory ?? []),
        {
          id: `history-${crypto.randomUUID()}`,
          date: now,
          actionType: "observation modifiee",
          objectType: "Study",
          objectId: selected.id,
          sourceObservationIds: (selected.observations ?? []).map((observation) => observation.id),
          summary: "Reanalyse emotionnelle et multidimensionnelle des observations existantes ; nouvelles propositions conservees sans validation automatique."
        }
      ]
    };
    const result = reanalyzeLongitudinalComparisons(emotionReanalyzedStudy, now);
    props.updateStudy(result.study);
  }

  function updateObservationEmotionStatus(
    observationId: string,
    emotionId: string,
    status: "accepted" | "rejected"
  ) {
    if (!selected) return;
    const now = new Date().toISOString();
    const observation = (selected.observations ?? []).find((item) => item.id === observationId);
    const emotion = observation?.detectedEmotions.find((item) => item.id === emotionId);
    if (!observation || !emotion) return;
    const emotionObservationId = `emotion-observation-${crypto.randomUUID()}`;
    const emotionObservation = status === "accepted" && !selected.emotionObservations.some((item) => item.validatedProposalIds?.includes(emotion.id))
      ? {
          id: emotionObservationId,
          emotion: emotion.label,
          canonicalEmotion: emotion.canonicalEmotion ?? emotion.emotion,
          originalExpression: emotion.originalExpression ?? emotion.label,
          expressionKind: emotion.expressionKind,
          sourceKind: emotion.sourceKind,
          polarity: emotion.polarity ?? "present",
          scope: emotion.scope ?? "indeterminate",
          intensity: 5,
          date: now.slice(0, 10),
          context: emotion.sourceExcerpt,
          duration: "non renseigne",
          comment: emotion.reason,
          sourceObservationIds: [observation.id],
          sourceExcerpt: emotion.sourceExcerpt,
          validatedProposalIds: [emotion.id],
          engineProvenance: ["EmotionExtractor"],
          createdFromObservationAt: now,
          confidence: emotion.confidence,
          methodologicalStatus: "Emotion validee apres reanalyse utilisateur"
        }
      : null;
    props.updateStudy({
      ...selected,
      observations: (selected.observations ?? []).map((item) =>
        item.id === observationId
          ? {
              ...item,
              detectedEmotions: item.detectedEmotions.map((candidate) =>
                candidate.id === emotionId ? { ...candidate, status } : candidate
              ),
              generatedEmotionIds: emotionObservation ? [...item.generatedEmotionIds, emotionObservation.id] : item.generatedEmotionIds,
              updatedAt: now
            }
          : item
      ),
      emotionObservations: emotionObservation ? [...selected.emotionObservations, emotionObservation] : selected.emotionObservations,
      structuredHistory: [
        ...(selected.structuredHistory ?? []),
        {
          id: `history-${crypto.randomUUID()}`,
          date: now,
          actionType: status === "accepted" ? "proposition acceptee" : "proposition rejetee",
          objectType: "DetectedEmotion",
          objectId: emotion.id,
          sourceObservationIds: [observation.id],
          summary: status === "accepted" ? "Emotion proposee acceptee apres reanalyse." : "Emotion proposee rejetee apres reanalyse."
        }
      ]
    });
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Panel title="Liste des études">
        <div className="grid gap-2">
          {props.studyNotice ? (
            <div className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-goldSoft">{props.studyNotice}</div>
          ) : null}
          {props.studies.length ? props.studies.map((study) => (
            <button
              key={study.id}
              onClick={() => props.selectStudy(study.id)}
              className={`rounded-md border p-3 text-left transition ${
                study.id === props.selectedStudyId ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04] hover:border-gold/30"
              }`}
            >
              <p className="font-medium text-white">{study.title}</p>
              <p className="mt-1 text-sm text-stone-400">{study.subject}</p>
            </button>
          )) : <SmartEmpty text="Aucune étude enregistrée. Ajoutez une observation ou créez une étude vide pour commencer." />}
        </div>
      </Panel>
      {selected && (
        <Panel title="Fiche d'étude">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre" value={selected.title} onChange={(title) => props.updateStudy({ ...selected, title })} />
            <Field label="Sujet observé" value={selected.subject} onChange={(subject) => props.updateStudy({ ...selected, subject })} />
            <Field label="Date de début" type="date" value={selected.startDate} onChange={(startDate) => props.updateStudy({ ...selected, startDate })} />
            <Field label="Statut" value={selected.status} onChange={(status) => props.updateStudy({ ...selected, status })} />
            <Field label="Niveau actuel" value={selected.currentLevel} onChange={(currentLevel) => props.updateStudy({ ...selected, currentLevel })} />
          </div>
          <div className="mt-3 grid gap-3">
            <Textarea label="Description" value={selected.description} onChange={(description) => props.updateStudy({ ...selected, description })} />
            <Textarea label="Notes" value={selected.notes} onChange={(notes) => props.updateStudy({ ...selected, notes })} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={() => props.updateStudy({ ...selected, updatedAt: new Date().toISOString() })}>
              <Save className="mr-2 inline h-4 w-4" aria-hidden /> Sauvegarder
            </button>
            <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => props.duplicateStudy(selected.id)}>
              <Copy className="mr-2 inline h-4 w-4" aria-hidden /> Dupliquer
            </button>
            <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => exportStudy(selected)}>
              <Download className="mr-2 inline h-4 w-4" aria-hidden /> Export JSON
            </button>
            <button
              className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => props.deleteStudy(selected.id)}
              disabled={props.isDeletingStudy}
            >
              <Trash2 className="mr-2 inline h-4 w-4" aria-hidden /> {props.isDeletingStudy ? "Suppression..." : "Supprimer"}
            </button>
          </div>
        </Panel>
      )}
      {selected && (
        <div className="grid gap-4 xl:col-start-2">
          <div className="glass rounded-lg p-3">
            <div className="flex flex-wrap gap-2">
              {studyTabs.map((item) => (
                <button
                  key={item.id}
                  className={`rounded-md px-3 py-2 text-sm transition ${tab === item.id ? "bg-gold/18 text-goldSoft" : "text-stone-300 hover:bg-white/7"}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {tab === "overview" && <StudyOverview study={selected} />}
          {tab === "journal" && (
            <StudyJournal
              study={selected}
              observations={observations}
              query={journalQuery}
              sort={journalSort}
              onQueryChange={setJournalQuery}
              onSortChange={setJournalSort}
              onEdit={updateObservationRawText}
              onArchive={archiveObservation}
              onReanalyze={reanalyzeStudyObservations}
              onEmotionStatus={updateObservationEmotionStatus}
            />
          )}
          {tab === "timeline" && <Timeline events={buildTimeline(selected)} />}
          {tab === "objects" && <StudyObjects study={selected} updateStudy={props.updateStudy} />}
          {tab === "states" && <StudyStates study={selected} updateStudy={props.updateStudy} />}
          {tab === "longitudinal" && <StudyLongitudinalComparisons study={selected} updateStudy={props.updateStudy} />}
          {tab === "comparisons" && <StateComparison study={selected} />}
          {tab === "transitions" && <StudyTransitions study={selected} />}
          {tab === "delta" && <StudyDelta study={selected} />}
          {tab === "recognitions" && <Recognitions study={selected} />}
          {tab === "synthesis" && <StudySynthesisPanel study={selected} updateStudy={props.updateStudy} generateStudySynthesis={props.generateStudySynthesis} />}
          {tab === "trajectories" && <StudyTrajectories study={selected} studies={props.studies} />}
          {tab === "questions" && <StudyQuestions study={selected} updateStudy={props.updateStudy} />}
          {tab === "stats" && <StudyStats study={selected} />}
          {tab === "history" && <StudyHistory study={selected} />}
          {tab === "export" && <StudyExportImport study={selected} />}
        </div>
      )}
      {!selected && (
        <div className="xl:col-start-2">
          <Panel title="Aucune étude sélectionnée">
            <SmartEmpty text="Aucune étude n'est disponible. Le journal d'observation permet de créer ou d'alimenter une étude." />
          </Panel>
        </div>
      )}
    </div>
  );
}

function States({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  if (!study.states.length) {
    return <MethodologyEmpty title="Aucun état construit" reason="Aucun état de compréhension, émotionnel ou comportemental n'est suffisamment documenté." needs={["une observation source", "une formulation explicite", "des éléments validés"]} />;
  }
  const comparison = compareStates(study.states[0], study.states[study.states.length - 1]);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {study.states.map((state) => (
          <Panel key={state.id} title={state.title}>
            <p className="text-sm text-stone-400">{state.date}</p>
            <div className="mt-2"><Badge>{state.type ?? inferStateType(state)}</Badge></div>
            <p className="mt-3 leading-7 text-stone-100">{state.formulation}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="Stabilité" value={`${state.stability}/10`} />
              <StatCard label="Confiance" value={`${state.confidence}/10`} />
            </div>
            <TagBlock title="Confirmés" items={state.confirmedElements} />
            <TagBlock title="Incertains" items={state.uncertainElements} />
            <TagBlock title="Langage" items={state.language} />
            <TagBlock title="Décisions / comportements" items={state.associatedBehaviors} />
          </Panel>
        ))}
      </div>
      <Panel title="Comparaison avant / après">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <TagBlock title="Changé" items={comparison.changed} />
          <TagBlock title="Apparu" items={comparison.appeared} />
          <TagBlock title="Disparu" items={comparison.disappeared} />
          <TagBlock title="Reformulé" items={comparison.reformulated} />
          <TagBlock title="Reste incertain" items={comparison.uncertain} />
        </div>
      </Panel>
    </div>
  );
}

function StateComparison({ study }: { study?: Study }) {
  const sortedStates = useMemo(() => study?.states.slice().sort((a, b) => a.date.localeCompare(b.date)) ?? [], [study]);
  const [fromStateId, setFromStateId] = useState("");
  const [toStateId, setToStateId] = useState("");
  if (!study) return <EmptyState />;
  if (sortedStates.length < 2) {
    return <MethodologyEmpty title="Comparaison impossible" reason="Deux états documentés dans la même étude sont nécessaires." needs={["un état précédent", "un état actuel", "une même compréhension comparable"]} />;
  }

  const fromState = sortedStates.find((state) => state.id === fromStateId) ?? sortedStates[0];
  const toState = sortedStates.find((state) => state.id === toStateId) ?? sortedStates[sortedStates.length - 1];
  const difference = StateDifferenceEngine.compare(fromState, toState);
  const delta = DeltaEngine.calculateBreakdown(difference);

  return (
    <div className="grid gap-4">
      <Panel title="Choix des états">
        <div className="grid gap-3 md:grid-cols-2">
          <StateSelect label="Etat A" states={sortedStates} value={fromState.id} onChange={setFromStateId} />
          <StateSelect label="Etat B" states={sortedStates} value={toState.id} onChange={setToStateId} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1fr_120px_1fr]">
        <StateSnapshot title="Etat A" state={fromState} />
        <div className="glass flex items-center justify-center rounded-lg p-4 text-3xl text-goldSoft">→</div>
        <StateSnapshot title="Etat B" state={toState} />
      </div>
      <Panel title="Différences détectées">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCard label="Différences" value={difference.totalDifferences} />
          <StatCard label="Catégories" value={difference.categoriesConcerned.length} />
          <StatCard label="Stabilité" value={difference.stabilityLevel} />
          <StatCard label="Temps entre états" value={difference.timeBetweenDays === null ? "non calculable" : `${difference.timeBetweenDays} jours`} />
        </div>
        <div className="grid gap-2">
          {difference.items.map((item) => (
            <div key={item.id} className={`rounded-md border p-3 ${differenceColor(item.kind)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{item.label}</p>
                <Badge>{item.category}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-200">{item.detail}</p>
              {item.before || item.after ? (
                <p className="mt-2 text-xs text-stone-400">
                  {item.before ? `Avant : ${item.before}` : ""} {item.after ? `Après : ${item.after}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <DeltaPanel delta={delta.global} breakdown={delta} />
    </div>
  );
}

function UnderstandingEvolution({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  if (study.states.length < 2) {
    return <MethodologyEmpty title="Evolution non calculable" reason="Aucune évolution de compréhension ne peut être construite sans deux états comparables." needs={["deux états de compréhension", "un même objet de compréhension", "des formulations avant/après"]} />;
  }
  const states = study.states.slice().sort((a, b) => a.date.localeCompare(b.date));
  const transitions = states.slice(1).map((state, index) => {
    const difference = StateDifferenceEngine.compare(states[index], state);
    return { before: states[index], after: state, difference, delta: DeltaEngine.calculate(difference) };
  });

  return (
    <div className="grid gap-4">
      {transitions.map((transition) => (
        <Panel key={`${transition.before.id}-${transition.after.id}`} title={`${transition.before.title} → ${transition.after.title}`}>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Δ(S) brut" value={transition.delta.score} />
            <StatCard label="Différences" value={transition.difference.totalDifferences} />
            <StatCard label="Stabilité" value={transition.difference.stabilityLevel} />
            <StatCard label="Durée" value={transition.difference.timeBetweenDays === null ? "non calculable" : `${transition.difference.timeBetweenDays} jours`} />
          </div>
          <div className="mt-4 grid gap-2">
            {transition.delta.limits.map((limit) => (
              <div key={limit} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
                {limit}
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function ReflexivityEngineDashboard({ dashboard }: { dashboard: ReturnType<typeof ReflexivityDashboardEngine.build> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Δ moyen" value={dashboard.averageDelta ?? "indicateurs insuffisants"} />
        <StatCard label="Temps moyen entre états" value={dashboard.averageDaysBetweenStates === null ? "indicateurs insuffisants" : `${dashboard.averageDaysBetweenStates} jours`} />
        <StatCard label="Temps avant stabilisation" value={dashboard.averageDaysBeforeStabilization === null ? "indicateurs insuffisants" : `${dashboard.averageDaysBeforeStabilization} jours`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Concepts et vocabulaire nouveaux">
          <TagBlock title="Concepts nouveaux" items={dashboard.newConcepts} />
          <TagBlock title="Vocabulaire nouveau" items={dashboard.newVocabulary.slice(0, 18)} />
        </Panel>
        <Panel title="Relations et transmissions">
          <TagBlock title="Relations nouvelles" items={dashboard.newRelations} />
          <TagBlock title="Transmissions" items={dashboard.transmissions} />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Émotions fréquentes">
          <RankedList items={dashboard.frequentEmotions} empty="Indicateurs insuffisants." />
        </Panel>
        <Panel title="Catalyseurs selon observations">
          <div className="grid gap-2">
            {dashboard.frequentCatalysts.map((catalyst) => (
              <div key={catalyst.name} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{catalyst.name}</p>
                  <Badge>{catalyst.influenceScore}</Badge>
                </div>
                <p className="mt-2 text-sm text-stone-400">{catalyst.limits[0]}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Limites du calcul">
        <div className="grid gap-2">
          {dashboard.limits.map((limit) => (
            <div key={limit} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
              {limit}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Transitions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  if (!study.transitions.length) {
    return <MethodologyEmpty title="Aucune transition" reason="Aucune transition n'est créée : il faut deux états comparables dans la même étude et portant sur la même compréhension." needs={["état précédent", "état actuel", "même compréhension", "observation source"]} />;
  }
  return (
    <div className="grid gap-4">
      {study.transitions.map((transition) => (
        <Panel key={transition.id} title={transition.title}>
          <div className="grid gap-3 lg:grid-cols-3">
            <StatCard label="Durée de maturation" value={transition.maturationDuration} />
            <StatCard label="Confirmation" value={`${transition.confirmationLevel}/3`} />
            <StatCard label="Transmission" value={transition.transmissionCapacity} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {transitionStages.map((stage) => (
              <div key={stage} className="rounded-md border border-gold/20 bg-gold/8 p-3 text-sm text-goldSoft">
                {stage}
              </div>
            ))}
          </div>
          <p className="mt-4 leading-7 text-stone-100">{transition.recognitionWording}</p>
          <TagBlock title="Manifestations déclenchantes" items={transition.triggeringManifestations} />
          <TagBlock title="Relations nouvelles" items={transition.newRelations} />
          <TagBlock title="Émotions" items={transition.emotions} />
          <TagBlock title="Catalyseurs" items={transition.catalysts} />
          <TagBlock title="Impact observable" items={[transition.observableImpact]} />
        </Panel>
      ))}
    </div>
  );
}

function Emotions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  if (!study.emotionObservations.length) {
    return <MethodologyEmpty title="Aucune émotion documentée" reason="Aucune émotion validée ou proposée n'est attachée à cette étude." needs={["une expression émotionnelle", "son origine", "une observation source"]} />;
  }
  return (
    <div className="grid gap-4">
      <Panel title="Suivi temporel">
        {study.emotionObservations.some((emotion) => emotion.intensity != null)
          ? <RecognitionCharts study={study} mode="emotions" />
          : <SmartEmpty text="Intensite non disponible" />}
      </Panel>
      <Panel title="Observations émotionnelles">
        <div className="grid gap-3 md:grid-cols-2">
          {study.emotionObservations.map((emotion) => (
            <div key={emotion.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{emotion.canonicalEmotion ?? emotion.emotion}</p>
                <Badge>{emotion.intensity == null ? "Intensite non disponible" : `${emotion.intensity}/10`}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{emotion.polarity ?? "present"}</Badge>
                <Badge>{emotion.scope ?? "indeterminate"}</Badge>
                <Badge>{emotionOriginLabel(emotion.origin)}</Badge>
                <Badge>{emotion.originalExpression ?? emotion.emotion}</Badge>
              </div>
              <p className="mt-2 text-sm text-stone-300">{emotion.context}</p>
              <p className="mt-2 text-xs text-stone-500">{emotion.date} · {emotion.duration}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AttitudesRepresentations({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  const elements = (study.observations ?? [])
    .flatMap((observation) => (observation.detectedDimensions ?? []).map((dimension) => ({ observation, dimension })))
    .filter(({ dimension }) => dimension.category === "Attitude" || dimension.category === "Representation");
  if (!elements.length) {
    return <MethodologyEmpty title="Aucune attitude ou representation documentee" reason="Les observations de cette etude ne contiennent pas encore d'attitude ou de representation proposee." needs={["un extrait source", "un objet concerne", "une validation utilisateur"]} />;
  }
  return (
    <div className="grid gap-4">
      <Panel title="Chronologie des attitudes et representations">
        <div className="grid gap-3">
          {elements.map(({ observation, dimension }) => (
            <div key={dimension.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{dimension.label}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{dimension.category}</Badge>
                  <Badge>{dimension.subtype ?? "sans sous-type"}</Badge>
                  <Badge>{dimension.polarity}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-300">{dimension.sourceExcerpt}</p>
              <p className="mt-2 text-xs text-stone-500">{observation.createdAt.slice(0, 10)} - objet : {dimension.object ?? "non precise"} - observation {observation.id}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Changements de polarite">
        <div className="grid gap-2">
          {(study.multidimensionalChanges ?? [])
            .flatMap((change) => change.changesDetected.filter((item) => item.kind === "polarity-inversion"))
            .map((change) => (
              <div key={change.id} className="rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
                {change.before ?? "etat anterieur"} -&gt; {change.after ?? "etat actuel"} : {change.summary}
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}

function MultidimensionalChanges({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  const changes = study.multidimensionalChanges ?? [];
  if (!changes.length) {
    return <MethodologyEmpty title="Aucun changement multidimensionnel propose" reason="Ajoutez au moins deux observations actives puis utilisez Reanalyser toute l'etude." needs={["deux observations chronologiques", "dimensions validees ou proposees", "extraits sources"]} />;
  }
  return (
    <div className="grid gap-4">
      {changes.map((change) => (
        <Panel key={change.id} title={change.proposedCurrentState?.summary ?? "Ce qui semble avoir change"}>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Statut" value={change.status} />
            <StatCard label="Confiance" value={`${Math.round(change.confidence * 100)}%`} />
            <StatCard label="Observations" value={change.sourceObservationIds.length} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white">Etat anterieur propose</h3>
              <p className="mt-2 text-sm leading-6 text-stone-300">{change.proposedPreviousState?.summary ?? "Donnees insuffisantes"}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white">Etat actuel propose</h3>
              <p className="mt-2 text-sm leading-6 text-stone-300">{change.proposedCurrentState?.summary ?? "Donnees insuffisantes"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {change.changesDetected.map((item) => (
              <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-200">
                <span className="text-goldSoft">{item.dimension}</span> - {item.summary}
              </div>
            ))}
          </div>
          <TagBlock title="Limites" items={change.limitations} />
          <TagBlock title="Questions" items={change.questions} />
          <div className="mt-4 grid gap-2">
            {change.sourceExcerpts.map((source) => (
              <div key={`${change.id}-${source.observationId}`} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-stone-400">
                {source.observationId} : {source.excerpt}
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Catalysts({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  return (
    <Panel title="Bibliothèque des catalyseurs / ponts">
      <div className="grid gap-3 md:grid-cols-2">
        {study.catalysts.map((catalyst) => (
          <div key={catalyst.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">{catalyst.name}</h3>
              <Badge>{catalyst.type}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-300">{catalyst.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard label="Fréquence" value={catalyst.frequency} />
              <StatCard label="Impact moyen" value={`${catalyst.averageImpact}/10`} />
              <StatCard label="Confirmation" value={`${catalyst.confirmationLevel}/3`} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Recognitions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  const validRecognitions = study.recognitions.filter((recognition) => recognition.confirmed || recognition.validation === "valide");
  if (!validRecognitions.length) {
    return <MethodologyEmpty title="Aucune reconnaissance validée" reason="Aucune reconnaissance validée." needs={["formulation exacte", "état précédent", "état actuel", "observation source", "validation"]} />;
  }
  return (
    <div className="grid gap-4">
      <Panel title="Reconnaissances">
        <div className="grid gap-3">
          {validRecognitions.map((recognition) => (
            <div key={recognition.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-white">{recognition.title}</h3>
                <div className="flex gap-2">
                  <Badge>Niveau {recognition.confirmationLevel}</Badge>
                  <Badge>{recognition.transmissible ? "Transmissible" : "Non transmissible"}</Badge>
                </div>
              </div>
              <p className="mt-3 leading-7 text-stone-100">{recognition.exactWording}</p>
              <p className="mt-2 text-xs text-stone-500">Observation source : {recognition.sourceObservationIds?.join(", ") ?? "non renseignée"}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TagBlock title="Déclencheurs" items={recognition.triggers} />
                <TagBlock title="Relations reconnues" items={recognition.newRecognizedRelations} />
                <TagBlock title="Impact langage" items={[recognition.languageImpact]} />
                <TagBlock title="Impact décisions" items={[recognition.decisionImpact]} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Distribution">
        <RecognitionCharts study={study} mode="recognitions" />
      </Panel>
    </div>
  );
}

function Timeline({ events }: { events: ReturnType<typeof buildTimeline> }) {
  return (
    <Panel title="Chronologie par étude">
      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className={`rounded-md border p-4 ${event.inDeltaPath ? "border-gold/45 bg-gold/10" : "border-white/10 bg-white/[0.04]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-white">{event.title}</p>
              <Badge>{event.kind}</Badge>
            </div>
            <p className="mt-1 text-sm text-stone-400">{event.date}</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">{event.summary}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Analysis({ analysis }: { analysis: ReturnType<typeof buildAnalysis> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analysis.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
        ))}
      </div>
      <Panel title="Hypothèses locales">
        <div className="grid gap-3">
          {analysis.insights.map((insight) => (
            <div key={insight} className="rounded-md border border-white/10 bg-white/[0.04] p-3 leading-6 text-stone-200">
              {insight}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Relations récurrentes">
        <RankedList items={analysis.recurrentRelations} empty="Les données sont insuffisantes pour conclure." />
      </Panel>
    </div>
  );
}

function StateSelect({
  label,
  states,
  value,
  onChange
}: {
  label: string;
  states: Study["states"];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-stone-200">{label}</span>
      <select
        className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {states.map((state) => (
          <option className="bg-ink" key={state.id} value={state.id}>
            {state.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function StateSnapshot({ title, state }: { title: string; state: Study["states"][number] }) {
  return (
    <Panel title={title}>
      <p className="text-sm text-stone-400">{state.date}</p>
      <h3 className="mt-2 font-semibold text-white">{state.title}</h3>
      <p className="mt-3 text-sm leading-6 text-stone-200">{state.formulation || "Indicateurs insuffisants"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Stabilité" value={`${state.stability}/10`} />
        <StatCard label="Confiance" value={`${state.confidence}/10`} />
      </div>
    </Panel>
  );
}

function DeltaPanel({ delta, breakdown }: { delta: ReturnType<typeof DeltaEngine.calculate>; breakdown?: ReturnType<typeof DeltaEngine.calculateBreakdown> }) {
  return (
    <Panel title="Δ(S) - calcul transparent">
      {breakdown ? (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCard label="Δ émotion" value={breakdown.emotion.interpretation} />
          <StatCard label="Δ compréhension" value={breakdown.understanding.score} />
          <StatCard label="Δ comportement" value={breakdown.behaviour.score} />
          <StatCard label="Δ transmission" value={breakdown.transmission.interpretation} />
        </div>
      ) : null}
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="Δ global" value={delta.score} />
        <StatCard label="Facteurs positifs" value={delta.positiveFactors.length} />
        <StatCard label="Facteurs négatifs" value={delta.negativeFactors.length} />
        <StatCard label="Facteurs neutres" value={delta.neutralFactors.length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <FactorList title="Facteurs positifs" factors={delta.positiveFactors} />
        <FactorList title="Facteurs négatifs" factors={delta.negativeFactors} />
        <FactorList title="Facteurs neutres" factors={delta.neutralFactors} />
      </div>
      <TagBlock title="Limites" items={delta.limits} />
    </Panel>
  );
}

function FactorList({ title, factors }: { title: string; factors: ReturnType<typeof DeltaEngine.calculate>["positiveFactors"] }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h4>
      <div className="mt-2 grid gap-2">
        {factors.length ? (
          factors.map((factor) => (
            <div key={`${factor.label}-${factor.value}`} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{factor.label}</p>
                <Badge>{factor.value}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-400">{factor.reason}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">Non renseigné</p>
        )}
      </div>
    </div>
  );
}

function differenceColor(kind: string) {
  if (kind === "addition") return "border-emerald-400/35 bg-emerald-400/10";
  if (kind === "probable-reformulation") return "border-orange-400/35 bg-orange-400/10";
  if (kind === "removal" || kind === "potential-contradiction") return "border-red-400/35 bg-red-400/10";
  if (kind === "stabilization") return "border-sky-400/35 bg-sky-400/10";
  return "border-white/10 bg-white/[0.04]";
}

function formatBuildDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function hasPendingProposals(draft: ObservationAnalysisDraft) {
  return [
    ...draft.detectedPeople,
    ...draft.detectedManifestations,
    ...draft.detectedEmotions,
    ...draft.detectedCatalysts,
    ...draft.detectedConcepts,
    ...draft.relationProposals
  ].some((item) => item.status === "proposed");
}

function suggestStudies(draft: ObservationAnalysisDraft, studies: Study[]) {
  const draftTerms = new Set([
    ...draft.detectedPeople.map((person) => person.label.toLowerCase()),
    ...draft.detectedConcepts.map((concept) => concept.label.toLowerCase())
  ]);

  return studies
    .map((study) => {
      const studyText = [
        study.title,
        study.subject,
        study.description,
        ...study.states.flatMap((state) => [...state.confirmedElements, ...state.uncertainElements, ...state.language]),
        ...study.catalysts.map((catalyst) => catalyst.name),
        ...study.manifestations.map((manifestation) => manifestation.description)
      ].join(" ").toLowerCase();
      const score = [...draftTerms].filter((term) => term && studyText.includes(term)).length;
      return { study, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.study);
}

function RankedList({ items, empty }: { items: Array<{ label: string; value: number | string }>; empty: string }) {
  if (!items.length) return <p className="text-sm text-stone-400">{empty}</p>;
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="text-sm text-stone-200">{item.label}</span>
          <Badge>{item.value}</Badge>
        </div>
      ))}
    </div>
  );
}

function TagBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? items.map((item) => <Badge key={item}>{item}</Badge>) : <span className="text-sm text-stone-500">Non renseigné</span>}
      </div>
    </div>
  );
}

function MethodologyEmpty({ title, reason, needs }: { title: string; reason: string; needs: string[] }) {
  return (
    <Panel title={title}>
      <p className="text-sm leading-6 text-stone-300">{reason}</p>
      <TagBlock title="Informations nécessaires" items={needs} />
    </Panel>
  );
}

function EmptyState() {
  return (
    <Panel title="Aucune étude sélectionnée">
      <p className="text-stone-300">Créez ou sélectionnez une étude pour documenter le chemin observable Δ.</p>
    </Panel>
  );
}
