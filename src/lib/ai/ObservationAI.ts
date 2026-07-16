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
    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        input: input.prompt,
        text: { format: { type: "json_object" } }
      })
    });
    if (!result.ok) throw new Error(`OpenAIProvider error ${result.status}`);
    const payload = await result.json();
    const text = extractResponseText(payload);
    return {
      response: JSON.parse(text),
      tokenUsage: {
        promptTokens: payload.usage?.input_tokens,
        completionTokens: payload.usage?.output_tokens,
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
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "local", aiStatus: result.status, mergedObservation },
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
        aiAnalysis: cached.response ?? undefined,
        aiResultId: cached.id,
        aiStatus: result.status,
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
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "ai-assisted", aiStatus: result.status, mergedObservation },
      result,
      cache: settings.keepResponses ? [result, ...cache] : cache
    };
  }

  const start = Date.now();
  try {
    const output = await provider.analyze({ prompt, model: settings.model, temperature: settings.temperature });
    const response = normalizeAIResponse(output.response, { model: settings.model, promptHash, createdAt: now });
    const result = buildResult(promptHash, settings.model, now, response, Date.now() - start, "success", undefined, output.tokenUsage);
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, response, now);
    return {
      draft: {
        ...applyMergedObservationToDraft(draft, mergedObservation),
        observationMode: "ai-assisted",
        aiAnalysis: response,
        aiResultId: result.id,
        aiStatus: result.status,
        mergedObservation
      },
      result,
      cache: settings.keepResponses ? [result, ...cache] : cache
    };
  } catch (error) {
    const result = buildResult(promptHash, settings.model, now, null, Date.now() - start, "error", error instanceof Error ? error.message : "Erreur IA");
    const mergedObservation = mergeObservationAnalyses(parserAnalysis, null, now);
    return {
      draft: { ...applyMergedObservationToDraft(draft, mergedObservation), observationMode: "ai-assisted", aiStatus: result.status, mergedObservation },
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
    model,
    createdAt,
    response,
    tokenUsage,
    latency,
    status,
    error
  };
}

function extractResponseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (payload.output_text) return payload.output_text;
  const text = payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n");
  if (!text) throw new Error("Reponse IA vide.");
  return text;
}
