import type { GlobalEventCategory, GlobalEventSource } from "../types";
import { tokenize } from "./utils";

const categoryKeywords: Record<GlobalEventCategory, string[]> = {
  Individu: ["personne", "leader", "victime", "temoin", "athlete", "artiste", "chercheur"],
  Famille: ["famille", "parent", "enfant", "generation", "foyer"],
  Société: ["societe", "manifestation", "identite", "migration", "inegalite", "collectif", "population"],
  Politique: ["election", "gouvernement", "president", "parlement", "reforme", "diplomatie"],
  Économie: ["marche", "emploi", "inflation", "industrie", "entreprise", "commerce", "budget"],
  Guerre: ["guerre", "attaque", "cessez", "feu", "armee", "conflit", "frontiere"],
  Santé: ["sante", "hopital", "epidemie", "vaccin", "maladie", "oms", "soin"],
  Spiritualité: ["spirituel", "meditation", "sens", "rituel", "conscience"],
  Religion: ["religion", "eglise", "mosquee", "temple", "foi", "culte"],
  Éducation: ["ecole", "universite", "enseignant", "eleve", "education", "formation"],
  Science: ["science", "etude", "chercheur", "nature", "science", "arxiv", "publication"],
  IA: ["ia", "intelligence", "artificielle", "algorithme", "modele", "automatisation"],
  Environnement: ["climat", "biodiversite", "environnement", "pollution", "energie", "catastrophe"],
  Culture: ["culture", "cinema", "livre", "musee", "art", "langue", "patrimoine"],
  Justice: ["justice", "tribunal", "droit", "proces", "police", "loi", "condamnation"],
  Technologie: ["technologie", "donnees", "plateforme", "reseau", "cyber", "robot", "satellite"]
};

export class NewsClassifier {
  static classify(source: GlobalEventSource): GlobalEventCategory[] {
    const tokens = new Set(tokenize(`${source.title} ${source.summary}`));
    const ranked = Object.entries(categoryKeywords)
      .map(([category, keywords]) => ({
        category: category as GlobalEventCategory,
        score: keywords.filter((keyword) => tokens.has(keyword)).length
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.category);
    return ranked.length ? ranked.slice(0, 4) : ["Société"];
  }

  static themes(source: GlobalEventSource) {
    return tokenize(`${source.title} ${source.summary}`)
      .filter((token) => token.length > 4)
      .slice(0, 8);
  }
}
