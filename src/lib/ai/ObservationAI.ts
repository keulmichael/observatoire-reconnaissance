import type {
  AIObservationResult,
  ObservationAIResponse,
  ObservationAISettings,
  ObservationAnalysisDraft
} from "../types";
import { stableId } from "../parser/ObservationParser";
import { buildObservationPrompt, hashPrompt } from "./ObservationPrompt";
import { normalizeAIResponse } from "./ObservationAISchema";
import { applyMergedObservationToDraft, mergeObservationAnalyses, parserDraftToAIResponse } from "./ObservationMerge";

export interface AIProvider {
  readonly id: string;
  analyze(input: AIProviderInput): Promise<AIProviderOutput>;
}

export interface AIProviderInput {
  prompt: string;
  model: string;
  temperature: number;
}

export interface AIProviderOutput {
  response: unknown;
  tokenUsage?: AIObservationResult["tokenUsage"];
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";

  constructor(private readonly apiKey?: string) {}

  async analyze(input: AIProviderInput): Promise<AIProviderOutput> {
    if (!this.apiKey) {
      throw new Error("Fournisseur OpenAI non configure. Aucun appel IA n'a ete effectue.");
    }
    const result = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        messages: [
          {
            role: "system",
            content: "Tu reponds uniquement avec un objet JSON valide."
          },
          {
            role: "user",
            content: input.prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });
    if (!result.ok) throw new Error(`OpenAIProvider error ${result.status}`);
    const payload = await result.json();
    const text = extractResponseText(payload);
    const response = JSON.parse(text);
    const corrected = needsSolidarityCorrection(input.prompt, response)
      ? await this.correctSolidarityBehaviours(input, response)
      : null;
    return {
      response: corrected?.response ?? response,
      tokenUsage: {
        promptTokens: sumTokens(payload.usage?.prompt_tokens, corrected?.tokenUsage?.promptTokens),
        completionTokens: sumTokens(payload.usage?.completion_tokens, corrected?.tokenUsage?.completionTokens),
        totalTokens: sumTokens(payload.usage?.total_tokens, corrected?.tokenUsage?.totalTokens)
      }
    };
  }

  private async correctSolidarityBehaviours(input: AIProviderInput, previousResponse: unknown): Promise<AIProviderOutput> {
    const result = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        messages: [
          { role: "system", content: "Tu reponds uniquement avec un objet JSON valide conforme au schema deja demande." },
          { role: "user", content: input.prompt },
          { role: "assistant", content: JSON.stringify(previousResponse) },
          {
            role: "user",
            content:
              "Corrige uniquement la collection behaviours. Le texte mentionne des actions de solidarite : elle doit contenir deux elements distincts avec les labels exacts Mobilisation et Solidarite. Conserve le reste du JSON."
          }
        ],
        response_format: { type: "json_object" }
      })
    });
    if (!result.ok) throw new Error(`OpenAIProvider correction error ${result.status}`);
    const payload = await result.json();
    return {
      response: JSON.parse(extractResponseText(payload)),
      tokenUsage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens
      }
    };
  }
}

export async function analyzeWithObservationAI({
  draft,
  settings,
  provider,
  cache = [],
  now = new Date().toISOString()
}: {
  draft: ObservationAnalysisDraft;
  settings: ObservationAISettings;
  provider?: AIProvider;
  cache?: AIObservationResult[];
  now?: string;
}): Promise<{ draft: ObservationAnalysisDraft; result: AIObservationResult; cache: AIObservationResult[] }> {
  const parserAnalysis = parserDraftToAIResponse(draft);
  const prompt = buildObservationPrompt(draft.rawText);
  const promptHash = hashPrompt(`${settings.model}:${settings.temperature}:${prompt}`);
  const cached = settings.keepResponses ? cache.find((item) => item.promptHash === promptHash && item.response) : undefined;

  if (settings.mode === "local") {
    const result = buildResult(promptHash, settings.model, now, null, 0, "disabled");
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, null, now);
    return {
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "local", deterministicAnalysis: parserAnalysis, aiStatus: result.status, aiLatency: result.latency, aiModel: result.model, aiAnalyzedAt: result.createdAt, mergedObservation },
      result,
      cache
    };
  }

  if (cached) {
    const result = { ...cached, status: "cached" as const };
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, cached.response, now);
    return {
      draft: {
        ...applyMergedObservationToDraft(draft, mergedObservation),
        observationMode: "ai-assisted",
        deterministicAnalysis: parserAnalysis,
        aiAnalysis: cached.response ?? undefined,
        aiResultId: cached.id,
        aiStatus: result.status,
        aiLatency: result.latency,
        aiModel: result.model,
        aiAnalyzedAt: result.createdAt,
        mergedObservation
      },
      result,
      cache
    };
  }

  if (!provider) {
    const result = buildResult(promptHash, settings.model, now, null, 0, "offline", "Aucun fournisseur IA disponible.");
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, null, now);
    return {
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "ai-assisted", deterministicAnalysis: parserAnalysis, aiStatus: result.status, aiError: result.error, aiLatency: result.latency, aiModel: result.model, aiAnalyzedAt: result.createdAt, mergedObservation },
      result,
      cache: settings.keepResponses ? [result, ...cache] : cache
    };
  }

  const start = Date.now();
  try {
    const output = await provider.analyze({ prompt, model: settings.model, temperature: settings.temperature });
    const latency = Date.now() - start;
    const response = normalizeAIResponse(output.response, { model: settings.model, promptHash, createdAt: now, latency });
    const result = buildResult(promptHash, settings.model, now, response, latency, "success", undefined, output.tokenUsage);
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, response, now);
    return {
      draft: {
        ...applyMergedObservationToDraft(draft, mergedObservation),
        observationMode: "ai-assisted",
        deterministicAnalysis: parserAnalysis,
        aiAnalysis: response,
        aiResultId: result.id,
        aiStatus: result.status,
        aiLatency: result.latency,
        aiModel: result.model,
        aiAnalyzedAt: result.createdAt,
        mergedObservation
      },
      result,
      cache: settings.keepResponses ? [result, ...cache] : cache
    };
  } catch (error) {
    const result = buildResult(promptHash, settings.model, now, null, Date.now() - start, "error", error instanceof Error ? error.message : "Erreur IA");
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, null, now);
    return {
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "ai-assisted", deterministicAnalysis: parserAnalysis, aiStatus: result.status, aiError: result.error, aiLatency: result.latency, aiModel: result.model, aiAnalyzedAt: result.createdAt, mergedObservation },
      result,
      cache: settings.keepResponses ? [result, ...cache] : cache
    };
  }
}

export const defaultAISettings: ObservationAISettings = {
  mode: "local",
  provider: "openai",
  model: "gpt-4.1-mini",
  temperature: 0.1,
  keepResponses: true,
  autoReanalyze: false,
  showReasoningSummary: false,
  showParserAIDifferences: true,
  allowFullStudyContext: false
};

function buildResult(
  promptHash: string,
  model: string,
  createdAt: string,
  response: ObservationAIResponse | null,
  latency: number,
  status: AIObservationResult["status"],
  error?: string,
  tokenUsage: AIObservationResult["tokenUsage"] = {}
): AIObservationResult {
  return {
    id: stableId("ai-result", `${promptHash}-${createdAt}-${status}`),
    promptHash,
    provider: "openai",
    model,
    createdAt,
    response,
    tokenUsage,
    latency,
    status,
    error
  };
}

function extractResponseText(payload: { choices?: Array<{ message?: { content?: string } }>; output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  const chatText = payload.choices?.[0]?.message?.content;
  if (chatText) return chatText;
  if (payload.output_text) return payload.output_text;
  const text = payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n");
  if (!text) throw new Error("Reponse IA vide.");
  return text;
}

function needsSolidarityCorrection(prompt: string, response: unknown) {
  if (!/actions?\s+de\s+solidarit/i.test(prompt)) return false;
  const behaviours = response && typeof response === "object" && Array.isArray((response as { behaviours?: unknown }).behaviours)
    ? ((response as { behaviours: Array<{ label?: unknown }> }).behaviours)
    : [];
  const labels = behaviours.map((item) => (typeof item.label === "string" ? normalize(item.label) : ""));
  return !labels.includes("mobilisation") || !labels.includes("solidarite");
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function sumTokens(left?: number, right?: number) {
  if (left === undefined && right === undefined) return undefined;
  return (left ?? 0) + (right ?? 0);
}
