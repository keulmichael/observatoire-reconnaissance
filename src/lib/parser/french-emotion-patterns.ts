import type { DetectedEmotion, EmotionPolarity, EmotionScope } from "../types";
import { splitSentences } from "./ObservationParser";

export type FrenchEmotionMatch = {
  canonicalEmotion: string;
  originalExpression: string;
  family: string;
  polarity: EmotionPolarity;
  scope: EmotionScope;
  expressionKind: DetectedEmotion["expressionKind"];
  sourceKind: DetectedEmotion["sourceKind"];
  sourceExcerpt: string;
  confidence: number;
  reason: string;
};

type PatternRule = {
  family: string;
  canonicalEmotion: string;
  expressions: string[];
  polarity?: EmotionPolarity;
};

const EMOTION_RULES: PatternRule[] = [
  {
    family: "inquietude",
    canonicalEmotion: "inquietude",
    expressions: [
      "inquiet",
      "inquiete",
      "inquiets",
      "inquietes",
      "inquietude",
      "s'inquiete",
      "s'inquietent",
      "se montrent inquiets",
      "sont inquiets",
      "expriment leur inquietude",
      "manifestent leur inquietude",
      "s'inquietent pour les animaux"
    ]
  },
  {
    family: "indifference",
    canonicalEmotion: "absence de reaction declaree",
    polarity: "absent",
    expressions: [
      "impassible",
      "impassibles",
      "indifferent",
      "indifferents",
      "aucune emotion",
      "aucune emotion particuliere",
      "pas d'emotion",
      "pas de reaction",
      "sans reaction",
      "ne montrent pas d'emotion",
      "n'ont pas de reaction"
    ]
  },
  {
    family: "confusion",
    canonicalEmotion: "confusion",
    expressions: [
      "perdu",
      "perdue",
      "perdus",
      "perdues",
      "confus",
      "confuse",
      "desoriente",
      "desorientee",
      "desorientes",
      "desorientees",
      "ne sait plus",
      "remise en question",
      "se sentent perdus",
      "se sent perdue"
    ]
  },
  {
    family: "peur",
    canonicalEmotion: "peur ou angoisse",
    expressions: [
      "peur",
      "effraye",
      "effrayee",
      "effrayes",
      "effrayees",
      "angoisse",
      "angoisse",
      "angoissee",
      "angoisses",
      "angoissees",
      "anxieux",
      "anxieuse",
      "manifestent de la peur"
    ]
  },
  {
    family: "tristesse",
    canonicalEmotion: "tristesse",
    expressions: [
      "triste",
      "attriste",
      "attristee",
      "attristes",
      "attristees",
      "bouleverse",
      "bouleversee",
      "bouleverses",
      "bouleversees",
      "touche",
      "touchee",
      "touches",
      "touchees",
      "profondement touches",
      "sont profondement touches"
    ]
  },
  {
    family: "apaisement",
    canonicalEmotion: "apaisement",
    expressions: [
      "apaise",
      "apaisee",
      "apaises",
      "apaisees",
      "serein",
      "sereine",
      "sereins",
      "sereines",
      "rassure",
      "rassuree",
      "rassures",
      "rassurees"
    ]
  },
  {
    family: "motivation",
    canonicalEmotion: "motivation",
    expressions: ["motive", "motivee", "motives", "motivees", "volonte d'agir"]
  },
  {
    family: "preoccupation",
    canonicalEmotion: "preoccupation",
    expressions: ["preoccupe", "preoccupee", "preoccupes", "preoccupees", "preoccupation"]
  },
  {
    family: "compassion",
    canonicalEmotion: "compassion",
    expressions: ["compassion", "compatissant", "compatissante", "empathie"]
  }
];

const BEHAVIOR_ONLY_EXPRESSIONS = [
  "solidarite",
  "solidaire",
  "solidaires",
  "action de solidarite",
  "actions de solidarite",
  "mobilisation",
  "s'impliquer",
  "prets a s'impliquer",
  "pret a s'impliquer",
  "sauvegarde de la faune",
  "volonte d'implication"
];

export function normalizeFrench(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectFrenchEmotionExpressions(rawText: string): FrenchEmotionMatch[] {
  const normalizedText = normalizeFrench(rawText);
  const matches = new Map<string, FrenchEmotionMatch>();

  for (const rule of EMOTION_RULES) {
    for (const expression of rule.expressions) {
      const normalizedExpression = normalizeFrench(expression);
      const pattern = expressionPattern(normalizedExpression);
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalizedText))) {
        const originalExpression = originalSlice(rawText, match.index, match[0].length);
        const sourceExcerpt = sourceAroundNormalized(rawText, originalExpression);
        const polarity = classifyPolarity(normalizedText, match.index, rule.polarity);
        const sourceKind = classifySourceKind(sourceExcerpt);
        const expressionKind = classifyExpressionKind(sourceExcerpt, sourceKind);
        const scope = classifyScope(sourceExcerpt);
        const confidence = confidenceFor(polarity, expressionKind, rule.polarity);
        const key = `${rule.canonicalEmotion}-${polarity}-${normalizeFrench(sourceExcerpt)}-${normalizeFrench(originalExpression)}`;
        matches.set(key, {
          canonicalEmotion: rule.canonicalEmotion,
          originalExpression,
          family: rule.family,
          polarity,
          scope,
          expressionKind,
          sourceKind,
          sourceExcerpt,
          confidence,
          reason: reasonFor(rule.canonicalEmotion, polarity, expressionKind, scope)
        });
      }
    }
  }

  return [...matches.values()].filter((match) => !isBehaviorOnly(match.originalExpression));
}

export function emotionLabelsFromText(rawText: string): string[] {
  return detectFrenchEmotionExpressions(rawText).map((match) => match.canonicalEmotion);
}

function expressionPattern(expression: string): RegExp {
  const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
  return new RegExp(`(^|\\b)${escaped}(?=$|\\b)`, "g");
}

function originalSlice(rawText: string, normalizedStart: number, normalizedLength: number): string {
  return rawText.slice(normalizedStart, normalizedStart + normalizedLength).trim();
}

function sourceAroundNormalized(rawText: string, originalExpression: string): string {
  const normalizedExpression = normalizeFrench(originalExpression);
  return splitSentences(rawText).find((sentence) => normalizeFrench(sentence).includes(normalizedExpression)) ?? rawText;
}

function classifyPolarity(normalizedText: string, matchIndex: number, defaultPolarity?: EmotionPolarity): EmotionPolarity {
  const before = normalizedText.slice(Math.max(0, matchIndex - 40), matchIndex);
  if (/\b(ne|n')\s+(sont|est|se sentent|se sent|montrent|montre|ressentent|ressent)\s+pas\s*$/i.test(before)) return "negated";
  if (/\b(pas|aucun|aucune|sans)\s*$/i.test(before)) return "absent";
  return defaultPolarity ?? "present";
}

function classifySourceKind(sourceExcerpt: string): DetectedEmotion["sourceKind"] {
  if (/[«"].+[»"]/.test(sourceExcerpt)) return "citation";
  if (/\b(m'a dit|m’a dit|a dit|dit qu|rapporte|selon|se sentait|se sent|je suis|elle est|il est|ils sont|elles sont)\b/i.test(sourceExcerpt)) {
    return "discours rapporte";
  }
  return "narration";
}

function classifyExpressionKind(sourceExcerpt: string, sourceKind: DetectedEmotion["sourceKind"]): DetectedEmotion["expressionKind"] {
  if (/\b(je pense|j'imagine|j’imagine|semble|semblent|semblait|peut-etre|peut être|probablement)\b/i.test(sourceExcerpt)) {
    return "supposee";
  }
  if (sourceKind === "citation" || /\b(je suis|se sent|se sentait|exprime|expriment|manifestent)\b/i.test(sourceExcerpt)) {
    return "exprimee directement";
  }
  return "attribuee par le narrateur";
}

function classifyScope(sourceExcerpt: string): EmotionScope {
  if (/\b(les francais|la population|tout le monde|collectif|collective)\b/i.test(sourceExcerpt)) return "collective";
  if (/\b(les gens|ils|elles|habitants|personnes|groupe|communauté|communaute)\b/i.test(sourceExcerpt)) return "group";
  if (/\b(je|j'|j’|il|elle|une personne|un homme|une femme)\b/i.test(sourceExcerpt)) return "individual";
  return "indeterminate";
}

function confidenceFor(polarity: EmotionPolarity, expressionKind: DetectedEmotion["expressionKind"], defaultPolarity?: EmotionPolarity) {
  if (expressionKind === "supposee") return 0.42;
  if (polarity === "negated") return 0.62;
  if (defaultPolarity === "absent" || polarity === "absent") return 0.7;
  return 0.78;
}

function reasonFor(canonicalEmotion: string, polarity: EmotionPolarity, expressionKind: DetectedEmotion["expressionKind"], scope: EmotionScope) {
  if (polarity === "absent") {
    return `${canonicalEmotion} detectee comme absence ou faible reaction declaree ; portee ${scope}.`;
  }
  if (polarity === "negated") {
    return `${canonicalEmotion} mentionnee sous forme niee ; elle ne doit pas etre interpretee comme emotion presente.`;
  }
  if (expressionKind === "supposee") {
    return `${canonicalEmotion} seulement supposee ou attribuee avec incertitude ; confirmation requise.`;
  }
  return `${canonicalEmotion} detectee dans le texte ; portee ${scope}.`;
}

function isBehaviorOnly(expression: string) {
  const normalized = normalizeFrench(expression);
  return BEHAVIOR_ONLY_EXPRESSIONS.includes(normalized);
}
