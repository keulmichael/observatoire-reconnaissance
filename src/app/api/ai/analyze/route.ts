import { NextResponse } from "next/server";
import { recordAIError, getOpenAIKey, clearAIError } from "@/lib/ai/AIConnectionStatus";
import { analyzeWithObservationAI, defaultAISettings, OpenAIProvider } from "@/lib/ai/ObservationAI";
import { parseObservation } from "@/lib/parser/ObservationParser";
import type { AIObservationResult, ObservationAISettings } from "@/lib/types";

export const runtime = "nodejs";

type AnalyzeBody = {
  rawText?: string;
  settings?: Partial<ObservationAISettings>;
  cache?: AIObservationResult[];
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  let settings: ObservationAISettings = defaultAISettings;

  try {
    const body = (await request.json()) as AnalyzeBody;
    const rawText = body.rawText?.trim();
    settings = { ...defaultAISettings, ...(body.settings ?? {}), mode: "ai-assisted", provider: "openai" };
    const cache = Array.isArray(body.cache) ? body.cache : [];

    if (!rawText) {
      return NextResponse.json({ error: "Observation vide." }, { status: 400 });
    }

    const configured = Boolean(getOpenAIKey());
    console.info("[ai-analyze] debut appel IA", {
      provider: settings.provider,
      model: settings.model,
      configured,
      textLength: rawText.length
    });

    const draft = parseObservation(rawText);
    const provider = configured ? new OpenAIProvider(getOpenAIKey()) : undefined;
    const analysis = await analyzeWithObservationAI({
      draft,
      settings,
      provider,
      cache
    });

    if (analysis.result.status === "success" || analysis.result.status === "cached") {
      clearAIError();
      console.info("[ai-analyze] succes", {
        provider: settings.provider,
        model: settings.model,
        status: analysis.result.status,
        latency: analysis.result.latency
      });
    } else {
      recordAIError(analysis.result.error ?? analysis.result.status);
      console.warn("[ai-analyze] fallback local", {
        provider: settings.provider,
        model: settings.model,
        status: analysis.result.status,
        latency: analysis.result.latency,
        error: analysis.result.error
      });
    }

    return NextResponse.json({
      ...analysis,
      serverLatency: Date.now() - startedAt
    });
  } catch (error) {
    const latency = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Erreur serveur IA";
    recordAIError(message);
    console.error("[ai-analyze] erreur", {
      provider: settings.provider,
      model: settings.model,
      latency,
      error: message
    });
    return NextResponse.json({ error: message, latency }, { status: 500 });
  }
}
