import type { AIConnectionStatus, ObservationAISettings } from "../types";
import { defaultAISettings } from "./ObservationAI";

let lastAIError: string | undefined;

export function recordAIError(error: unknown) {
  lastAIError = sanitizeError(error);
}

export function clearAIError() {
  lastAIError = undefined;
}

export function getLastAIError() {
  return lastAIError;
}

export function getOpenAIKey() {
  return process.env.OPENAI_API_KEY;
}

export async function checkAIConnection(model = defaultAISettings.model): Promise<AIConnectionStatus> {
  const provider: ObservationAISettings["provider"] = "openai";
  const checkedAt = new Date().toISOString();
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    const message = "OPENAI_API_KEY absente.";
    lastAIError = message;
    return {
      configured: false,
      provider,
      reachable: false,
      model,
      mode: "local",
      message,
      latency: null,
      checkedAt,
      lastError: lastAIError
    };
  }

  const start = Date.now();
  console.info("[ai-status] test connexion", { provider, model });
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    const latency = Date.now() - start;
    if (!response.ok) {
      const message = `OpenAI status ${response.status}`;
      lastAIError = message;
      console.warn("[ai-status] echec", { provider, model, latency, status: response.status });
      return {
        configured: true,
        provider,
        reachable: false,
        model,
        mode: "assisted",
        message,
        latency,
        checkedAt,
        lastError: lastAIError
      };
    }
    clearAIError();
    console.info("[ai-status] succes", { provider, model, latency });
    return {
      configured: true,
      provider,
      reachable: true,
      model,
      mode: "assisted",
      message: "Connexion IA operationnelle",
      latency,
      checkedAt
    };
  } catch (error) {
    const latency = Date.now() - start;
    lastAIError = sanitizeError(error);
    console.warn("[ai-status] erreur", { provider, model, latency, error: lastAIError });
    return {
      configured: true,
      provider,
      reachable: false,
      model,
      mode: "assisted",
      message: "Connexion IA indisponible",
      latency,
      checkedAt,
      lastError: lastAIError
    };
  }
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Erreur IA inconnue";
}
