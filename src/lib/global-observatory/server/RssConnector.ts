import type { GlobalEventSource, GlobalSourceConnector } from "../../types";
import { NewsClassifier } from "../NewsClassifier";
import { Normalization } from "../Normalization";
import { stableId } from "../utils";
import { validateRssEndpoint } from "./rss-security";

export interface RssConnectorResult {
  source: GlobalSourceConnector;
  articles: GlobalEventSource[];
  error?: string;
}

export class RssConnector {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchSource(source: GlobalSourceConnector, options: { timeoutMs: number; maxItems: number; now: string }): Promise<RssConnectorResult> {
    try {
      const url = validateRssEndpoint(source);
      const signal = AbortSignal.timeout(options.timeoutMs);
      const response = await this.fetchImpl(url, {
        signal,
        headers: {
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
          "user-agent": "ObservatoireReconnaissance/0.1 (+https://github.com/keulmichael/observatoire-reconnaissance)"
        },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const articles = parseFeed(xml, source, options.now).slice(0, options.maxItems);
      return { source, articles };
    } catch (error) {
      return { source, articles: [], error: error instanceof Error ? error.message : "Erreur RSS inconnue" };
    }
  }
}

export function parseFeed(xml: string, connector: GlobalSourceConnector, now: string): GlobalEventSource[] {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomItems = items.length ? [] : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return [...items, ...atomItems]
    .map((item) => parseItem(item, connector, now))
    .filter((item): item is GlobalEventSource => Boolean(item));
}

function parseItem(item: string, connector: GlobalSourceConnector, now: string): GlobalEventSource | null {
  const title = decodeXml(textOf(item, "title"));
  const link = decodeXml(linkOf(item));
  const rawDate = decodeXml(textOf(item, "pubDate") || textOf(item, "updated") || textOf(item, "published"));
  const publishedAt = normalizeDate(rawDate);
  const description = sanitizeExcerpt(decodeXml(textOf(item, "description") || textOf(item, "summary") || textOf(item, "content")));
  const guid = decodeXml(textOf(item, "guid") || textOf(item, "id") || link || title);
  if (!title || !publishedAt || (!description && !link)) return null;
  const normalized: GlobalEventSource = Normalization.source({
    id: stableId("article", `${connector.id}-${guid}`),
    externalId: guid,
    connectorId: connector.id,
    connectorName: connector.name,
    title,
    url: link,
    publishedAt,
    country: inferCountry(connector, title, description),
    language: inferLanguage(connector, title),
    summary: description || title,
    authors: [],
    excerpts: description
      ? [{
          id: stableId("excerpt", `${connector.id}-${guid}-${description}`),
          text: description,
          location: "rss:description",
          claimIds: []
        }]
      : [],
    collectedAt: now
  });
  return {
    ...normalized,
    categories: NewsClassifier.classify(normalized)
  };
}

function textOf(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripCdata(match?.[1] ?? "");
}

function linkOf(xml: string) {
  const textLink = textOf(xml, "link");
  if (textLink) return textLink;
  const atomLink = xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return atomLink?.[1] ?? "";
}

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function sanitizeExcerpt(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

function normalizeDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function inferLanguage(connector: GlobalSourceConnector, title: string) {
  if (connector.id.includes("france24") || /[àâçéèêëîïôùûü]/i.test(title)) return "fr";
  return "en";
}

function inferCountry(connector: GlobalSourceConnector, title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  if (text.includes("france") || text.includes("french")) return "France";
  if (text.includes("ukraine")) return "Ukraine";
  if (text.includes("china") || text.includes("chine")) return "Chine";
  if (text.includes("india") || text.includes("inde")) return "Inde";
  if (text.includes("brazil") || text.includes("bresil")) return "Brésil";
  return connector.countries[0] ?? "Monde";
}
