"use client";

import { useMemo, useState } from "react";
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
  GitCompare,
  GitBranch,
  Home,
  Import,
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
import type { AIConnectionStatus, AIObservationResult, AppView, ObservationAISettings, ObservationAnalysisDraft, Study, TransitionStage } from "@/lib/types";
import { RecognitionCharts } from "@/components/recognition-charts";
import { ObservationAnalysis } from "@/components/journal/ObservationAnalysis";
import { ObservationFollowup } from "@/components/journal/ObservationFollowup";
import { ObservationInput } from "@/components/journal/ObservationInput";
import { DeltaEngine } from "@/lib/engines/DeltaEngine";
import { ReflexivityDashboardEngine } from "@/lib/engines/ReflexivityDashboardEngine";
import { StateDifferenceEngine } from "@/lib/engines/StateDifferenceEngine";
import { TrajectoryEngine } from "@/lib/engines/TrajectoryEngine";
import { parseObservation } from "@/lib/parser/ObservationParser";
import { analyzeWithObservationAI, defaultAISettings } from "@/lib/ai/ObservationAI";
import {
  editLongitudinalComparison,
  normalizeComparison,
  normalizeStatus,
  rejectLongitudinalComparison,
  validateLongitudinalComparison,
  type LongitudinalEditPatch
} from "@/lib/longitudinal-review";

const views: Array<{ id: AppView; label: string; icon: React.ElementType }> = [
  { id: "journal", label: "Journal d'Observation", icon: ClipboardList },
  { id: "followup", label: "Suivi", icon: Eye },
  { id: "dashboard", label: "Tableau de bord", icon: Home },
  { id: "studies", label: "Études", icon: BookOpen },
  { id: "states", label: "États", icon: Brain },
  { id: "transitions", label: "Transitions Δ", icon: GitBranch },
  { id: "state-comparison", label: "Comparaison d'états", icon: GitCompare },
  { id: "understanding-evolution", label: "Evolution d'une compréhension", icon: TrendingUp },
  { id: "reflexivity-engine", label: "Moteur de Réflexivité", icon: Microscope },
  { id: "map", label: "Carte réflexive", icon: Network },
  { id: "emotions", label: "Émotions", icon: Activity },
  { id: "catalysts", label: "Catalyseurs", icon: Sparkles },
  { id: "recognitions", label: "Reconnaissances", icon: Search },
  { id: "timeline", label: "Chronologie", icon: CalendarDays },
  { id: "analysis", label: "Analyse", icon: BarChart3 }
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
    saveObservationDraft,
    integrateObservationDraft
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
  const dashboard = useMemo(() => buildDashboard(data), [data]);
  const analysis = useMemo(() => buildAnalysis(data), [data]);
  const reflexivityDashboard = useMemo(() => ReflexivityDashboardEngine.build(data), [data]);
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
          <nav className="grid gap-1" aria-label="Navigation principale">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {item.id === "journal" ? <p className="mb-1 mt-2 px-3 text-xs uppercase tracking-[0.18em] text-stone-500">Mode Observation</p> : null}
                  {item.id === "dashboard" ? <p className="mb-1 mt-4 px-3 text-xs uppercase tracking-[0.18em] text-stone-500">Mode Expert</p> : null}
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
          {view === "dashboard" && <Dashboard dashboard={dashboard} studies={studies} selectStudy={selectStudy} setView={setView} />}
          {view === "studies" && (
            <Studies
              studies={studies}
              selectedStudyId={selectedStudyId}
              selectStudy={selectStudy}
              updateStudy={updateStudy}
              deleteStudy={deleteStudy}
              duplicateStudy={duplicateStudy}
              isDeletingStudy={isDeletingStudy}
              studyNotice={studyNotice}
            />
          )}
          {view === "states" && <States study={selectedStudy} />}
          {view === "transitions" && <Transitions study={selectedStudy} />}
          {view === "state-comparison" && <StateComparison study={selectedStudy} />}
          {view === "understanding-evolution" && <UnderstandingEvolution study={selectedStudy} />}
          {view === "reflexivity-engine" && <ReflexivityEngineDashboard dashboard={reflexivityDashboard} />}
          {view === "map" && selectedStudy && <ReflexiveMap study={selectedStudy} onChange={updateMap} />}
          {view === "emotions" && <Emotions study={selectedStudy} />}
          {view === "catalysts" && <Catalysts study={selectedStudy} />}
          {view === "recognitions" && <Recognitions study={selectedStudy} />}
          {view === "timeline" && <Timeline events={timeline} />}
          {view === "analysis" && <Analysis analysis={analysis} />}
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
        <StatCard label="Changements proposes" value={(study.longitudinalComparisons ?? []).filter((item) => item.status === "propose").length} />
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
          Reanalyser les observations de cette etude
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
  return (
    <div className="mt-3 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
      Comparaison avec les observations anterieures de cette etude : {longitudinalComparisons.length} proposition(s). Ce que cette observation a change : {states.length} etat(s), {transitions.length} transition(s), {deltas.length} Delta(s). {states.length || transitions.length || deltas.length || longitudinalComparisons.length ? "" : "Aucune transition complete n'a ete creee, car les donnees restent insuffisantes."}
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
      {filteredComparisons.length ? (
        <div className="grid gap-4">
          {filteredComparisons.map((comparison) => {
            const status = normalizeStatus(comparison.status);
            const previous = comparison.previousObservationId
              ? (study.observations ?? []).find((observation) => observation.id === comparison.previousObservationId)
              : null;
            const current = (study.observations ?? []).find((observation) => observation.id === comparison.currentObservationId);
            const disabled = busyId === comparison.id;
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
                <TraceBlock title="Limites" items={comparison.limitations ?? comparison.methodologicalLimits} />
                <TraceBlock title="Donnees manquantes" items={comparison.missingData} />
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
                      <button type="button" className="rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft disabled:opacity-50" disabled={disabled} onClick={() => validateComparison(comparison.id)}>
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
  isDeletingStudy: boolean;
  studyNotice: string;
}) {
  const selected = props.studies.find((study) => study.id === props.selectedStudyId) ?? props.studies[0];
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
            updatedAt: now,
            enginesExecuted: [...new Set([...observation.enginesExecuted, "EmotionExtractor"])],
            engineResultsSummary: [...observation.engineResultsSummary, `${newEmotions.length} emotion(s) proposee(s) apres reanalyse.`]
          }
        : observation;
    });
    props.updateStudy({
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
          summary: "Reanalyse emotionnelle des observations existantes ; nouvelles propositions conservees sans validation automatique."
        }
      ]
    });
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
  const comparison = compareStates(study.states[0], study.states[study.states.length - 1]);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {study.states.map((state) => (
          <Panel key={state.id} title={state.title}>
            <p className="text-sm text-stone-400">{state.date}</p>
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
  if (!study || sortedStates.length < 2) return <EmptyState />;

  const fromState = sortedStates.find((state) => state.id === fromStateId) ?? sortedStates[0];
  const toState = sortedStates.find((state) => state.id === toStateId) ?? sortedStates[sortedStates.length - 1];
  const difference = StateDifferenceEngine.compare(fromState, toState);
  const delta = DeltaEngine.calculate(difference);

  return (
    <div className="grid gap-4">
      <Panel title="Choix des Ã©tats">
        <div className="grid gap-3 md:grid-cols-2">
          <StateSelect label="Etat A" states={sortedStates} value={fromState.id} onChange={setFromStateId} />
          <StateSelect label="Etat B" states={sortedStates} value={toState.id} onChange={setToStateId} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1fr_120px_1fr]">
        <StateSnapshot title="Etat A" state={fromState} />
        <div className="glass flex items-center justify-center rounded-lg p-4 text-3xl text-goldSoft">â†’</div>
        <StateSnapshot title="Etat B" state={toState} />
      </div>
      <Panel title="DiffÃ©rences dÃ©tectÃ©es">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCard label="DiffÃ©rences" value={difference.totalDifferences} />
          <StatCard label="CatÃ©gories" value={difference.categoriesConcerned.length} />
          <StatCard label="StabilitÃ©" value={difference.stabilityLevel} />
          <StatCard label="Temps entre Ã©tats" value={difference.timeBetweenDays === null ? "non calculable" : `${difference.timeBetweenDays} jours`} />
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
                  {item.before ? `Avant : ${item.before}` : ""} {item.after ? `AprÃ¨s : ${item.after}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <DeltaPanel delta={delta} />
    </div>
  );
}

function UnderstandingEvolution({ study }: { study?: Study }) {
  if (!study || study.states.length < 2) return <EmptyState />;
  const states = study.states.slice().sort((a, b) => a.date.localeCompare(b.date));
  const transitions = states.slice(1).map((state, index) => {
    const difference = StateDifferenceEngine.compare(states[index], state);
    return { before: states[index], after: state, difference, delta: DeltaEngine.calculate(difference) };
  });

  return (
    <div className="grid gap-4">
      {transitions.map((transition) => (
        <Panel key={`${transition.before.id}-${transition.after.id}`} title={`${transition.before.title} â†’ ${transition.after.title}`}>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Î”(S) brut" value={transition.delta.score} />
            <StatCard label="DiffÃ©rences" value={transition.difference.totalDifferences} />
            <StatCard label="StabilitÃ©" value={transition.difference.stabilityLevel} />
            <StatCard label="DurÃ©e" value={transition.difference.timeBetweenDays === null ? "non calculable" : `${transition.difference.timeBetweenDays} jours`} />
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
        <StatCard label="Î” moyen" value={dashboard.averageDelta ?? "indicateurs insuffisants"} />
        <StatCard label="Temps moyen entre Ã©tats" value={dashboard.averageDaysBetweenStates === null ? "indicateurs insuffisants" : `${dashboard.averageDaysBetweenStates} jours`} />
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
        <Panel title="Ã‰motions frÃ©quentes">
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
  return (
    <div className="grid gap-4">
      <Panel title="Suivi temporel">
        <RecognitionCharts study={study} mode="emotions" />
      </Panel>
      <Panel title="Observations émotionnelles">
        <div className="grid gap-3 md:grid-cols-2">
          {study.emotionObservations.map((emotion) => (
            <div key={emotion.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{emotion.canonicalEmotion ?? emotion.emotion}</p>
                <Badge>{emotion.intensity}/10</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{emotion.polarity ?? "present"}</Badge>
                <Badge>{emotion.scope ?? "indeterminate"}</Badge>
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
  return (
    <div className="grid gap-4">
      <Panel title="Reconnaissances">
        <div className="grid gap-3">
          {study.recognitions.map((recognition) => (
            <div key={recognition.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-white">{recognition.title}</h3>
                <div className="flex gap-2">
                  <Badge>Niveau {recognition.confirmationLevel}</Badge>
                  <Badge>{recognition.transmissible ? "Transmissible" : "Non transmissible"}</Badge>
                </div>
              </div>
              <p className="mt-3 leading-7 text-stone-100">{recognition.exactWording}</p>
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
        <StatCard label="StabilitÃ©" value={`${state.stability}/10`} />
        <StatCard label="Confiance" value={`${state.confidence}/10`} />
      </div>
    </Panel>
  );
}

function DeltaPanel({ delta }: { delta: ReturnType<typeof DeltaEngine.calculate> }) {
  return (
    <Panel title="Î”(S) - calcul transparent">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="Score brut" value={delta.score} />
        <StatCard label="Facteurs positifs" value={delta.positiveFactors.length} />
        <StatCard label="Facteurs nÃ©gatifs" value={delta.negativeFactors.length} />
        <StatCard label="Facteurs neutres" value={delta.neutralFactors.length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <FactorList title="Facteurs positifs" factors={delta.positiveFactors} />
        <FactorList title="Facteurs nÃ©gatifs" factors={delta.negativeFactors} />
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
          <p className="text-sm text-stone-500">Non renseignÃ©</p>
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

function EmptyState() {
  return (
    <Panel title="Aucune étude sélectionnée">
      <p className="text-stone-300">Créez ou sélectionnez une étude pour documenter le chemin observable Δ.</p>
    </Panel>
  );
}
