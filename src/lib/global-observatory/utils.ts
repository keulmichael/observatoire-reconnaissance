import type { GlobalEventCategory, GlobalEventSource, GlobalObservedEvent } from "../types";

export const GLOBAL_OBSERVATORY_VERSION = "GlobalObservatory:v1";

export function stableId(prefix: string, value: string) {
  return `${prefix}-${hash(normalizeText(value))}`;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(value: string) {
  const stopWords = new Set([
    "avec",
    "dans",
    "des",
    "les",
    "une",
    "pour",
    "sur",
    "par",
    "qui",
    "que",
    "and",
    "the",
    "from",
    "with",
    "this",
    "that"
  ]);
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function similarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

export function sourceText(source: GlobalEventSource) {
  return `${source.title} ${source.summary} ${source.excerpts.map((excerpt) => excerpt.text).join(" ")}`;
}

export function eventText(event: GlobalObservedEvent) {
  return `${event.title} ${event.summary} ${event.sources.map(sourceText).join(" ")}`;
}

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function categoryLabel(category: GlobalEventCategory) {
  return category;
}

export function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}
