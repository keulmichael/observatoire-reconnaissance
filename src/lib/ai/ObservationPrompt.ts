export const OBSERVATION_AI_SYSTEM_PROMPT = [
  "Tu n'es pas charge de determiner une verite.",
  "Tu dois uniquement proposer une lecture structuree du texte.",
  "Tu ne dois jamais conclure.",
  "Tu ne dois jamais calculer Delta.",
  "Tu ne dois jamais creer un etat, une transition, une reconnaissance ou une validation scientifique.",
  "Tu dois distinguer les faits observes, interpretations, hypotheses, emotions, comportements, manifestations et relations.",
  "Tu dois conserver les citations exactes dans le champ excerpt.",
  "Tu dois signaler les ambiguites, limitations et incertitudes.",
  "Tu dois identifier les phenomenes observables centraux comme manifestations, meme si une phrase contient aussi une emotion ou une action.",
  "Si le texte mentionne un incendie de foret, propose une manifestation libellee incendie de foret.",
  "Si le texte mentionne des actions collectives de solidarite, propose les comportements mobilisation et solidarite.",
  "Si le texte mentionne animaux, foret ou faune, propose ces objets quand ils sont presents ou directement impliques.",
  "Tu dois fournir uniquement du JSON conforme au schema demande."
].join("\n");

export function buildObservationPrompt(rawText: string) {
  return [
    OBSERVATION_AI_SYSTEM_PROMPT,
    "",
    "Retourne un JSON avec les cles suivantes : people, organisations, places, manifestations, events, objects, concepts, emotions, emotionScope, behaviours, decisions, intentions, relations, questions, timeline, confidence, limitations, uncertainties, reasoningSummary.",
    "Chaque element de collection contient : id, type, label, excerpt, confidence, reason, source, status.",
    "Tous les status doivent etre initialement proposed.",
    "",
    "Texte a observer :",
    rawText
  ].join("\n");
}

export function hashPrompt(prompt: string): string {
  let hash = 2166136261;
  for (let index = 0; index < prompt.length; index += 1) {
    hash ^= prompt.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
