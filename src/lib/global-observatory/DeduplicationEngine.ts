import type { GlobalEventSource, GlobalObservedEvent } from "../types";
import { Normalization } from "./Normalization";
import { similarity, sourceText } from "./utils";

export type DeduplicationDecision =
  | { kind: "duplicate-article"; event: GlobalObservedEvent; reason: string; confidence: number }
  | { kind: "same-event-auto"; event: GlobalObservedEvent; reason: string; confidence: number }
  | { kind: "same-event-review"; event: GlobalObservedEvent; reason: string; confidence: number }
  | { kind: "distinct-event"; reason: string; confidence: number };

export class DeduplicationEngine {
  static decide(events: GlobalObservedEvent[], source: GlobalEventSource): DeduplicationDecision {
    const duplicate = events.find((event) =>
      event.sources.some((existing) => this.isSameArticle(existing, source))
    );
    if (duplicate) {
      return {
        kind: "duplicate-article",
        event: duplicate,
        reason: "Copie du meme article detectee par URL canonique, identifiant externe ou titre normalise.",
        confidence: 0.98
      };
    }

    const candidate = events
      .map((event) => {
        const confidence = this.eventConfidence(event, source);
        return { event, confidence };
      })
      .sort((left, right) => right.confidence - left.confidence)[0];

    if (!candidate || candidate.confidence < 0.42) {
      return { kind: "distinct-event", reason: "Similarite insuffisante avec les evenements existants.", confidence: candidate?.confidence ?? 0 };
    }
    if (candidate.confidence >= 0.74) {
      return {
        kind: "same-event-auto",
        event: candidate.event,
        reason: "Même evenement probable: forte similarite de titre/contenu avec proximite temporelle et geographique.",
        confidence: candidate.confidence
      };
    }
    return {
      kind: "same-event-review",
      event: candidate.event,
      reason: "Evenement possiblement identique, mais ambiguite suffisante pour demander une validation.",
      confidence: candidate.confidence
    };
  }

  static isSameArticle(left: GlobalEventSource, right: GlobalEventSource) {
    const leftUrl = Normalization.canonicalUrl(left.url);
    const rightUrl = Normalization.canonicalUrl(right.url);
    if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
    if (left.externalId && right.externalId && left.connectorId === right.connectorId && left.externalId === right.externalId) return true;
    if (left.id && right.id && left.id === right.id) return true;
    return Normalization.title(left.title) === Normalization.title(right.title)
      && left.connectorId === right.connectorId
      && Math.abs(new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime()) < 86_400_000;
  }

  private static eventConfidence(event: GlobalObservedEvent, source: GlobalEventSource) {
    const titleScore = similarity(event.title, source.title);
    const contentScore = similarity(`${event.title} ${event.summary}`, sourceText(source));
    const temporalBonus = temporalDistanceDays(event.startedAt, source.publishedAt) <= 3 ? 0.1 : 0;
    const countryBonus = event.country && source.country && event.country === source.country ? 0.12 : 0;
    return Math.min(1, Math.max(titleScore, contentScore) + temporalBonus + countryBonus);
  }
}

function temporalDistanceDays(left: string, right: string) {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftTime - rightTime) / 86_400_000;
}
