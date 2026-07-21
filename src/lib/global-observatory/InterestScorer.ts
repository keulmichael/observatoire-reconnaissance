import type { GlobalInterestScore, GlobalObservedEvent } from "../types";

export class InterestScorer {
  static score(event: GlobalObservedEvent): GlobalInterestScore {
    const factors = [
      {
        label: "Multiplicite des sources",
        impact: Math.min(20, event.sources.length * 6),
        reason: `${event.sources.length} source(s) rattachee(s) a l'evenement.`
      },
      {
        label: "Dimensions observables",
        impact: Math.min(24, event.categories.length * 5),
        reason: `${event.categories.length} categorie(s) classee(s).`
      },
      {
        label: "Mecanismes de reconnaissance",
        impact: Math.min(26, (event.analysis?.recognitionMechanisms.length ?? 0) * 7),
        reason: "Presence possible de mecanismes de reconnaissance ou de conflit de representation."
      },
      {
        label: "Apprentissage confirme",
        impact: Math.min(20, event.learningWeight * 4),
        reason: "Historique des propositions retenues, abandonnees et observees."
      },
      {
        label: "Traçabilite",
        impact: event.analysis?.claims.some((claim) => claim.sourceIds.length && claim.excerptIds.length) ? 10 : 0,
        reason: "Claims relies a des sources et extraits."
      }
    ];
    const score = Math.max(0, Math.min(100, factors.reduce((sum, factor) => sum + factor.impact, 0)));
    const stars = this.stars(score);
    return {
      level: this.level(stars),
      stars,
      score,
      explanation: `Score ${score}/100: ${factors.filter((factor) => factor.impact > 0).map((factor) => factor.label).join(", ")}.`,
      factors
    };
  }

  private static stars(score: number): 1 | 2 | 3 | 4 | 5 {
    if (score >= 78) return 5;
    if (score >= 60) return 4;
    if (score >= 42) return 3;
    if (score >= 22) return 2;
    return 1;
  }

  private static level(stars: 1 | 2 | 3 | 4 | 5) {
    if (stars === 5) return "Priorité très élevée";
    if (stars === 4) return "Élevée";
    if (stars === 3) return "Moyenne";
    if (stars === 2) return "Faible";
    return "Hors périmètre";
  }
}
