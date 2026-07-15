import { Panel, StatCard } from "@/components/ui";
import type { ObservationAnalysisDraft, Study } from "@/lib/types";

export function ObservationFollowup({ drafts, study }: { drafts: ObservationAnalysisDraft[]; study?: Study }) {
  const latestDraft = drafts[0];
  const latestObservation = study?.observations?.[study.observations.length - 1];
  const latestManifestation = study?.manifestations[study.manifestations.length - 1]?.title ?? latestDraft?.detectedManifestations[0]?.label ?? "Non renseigne";
  const latestEmotion = study?.emotionObservations[study.emotionObservations.length - 1]?.emotion ?? latestDraft?.detectedEmotions[0]?.label ?? "Non renseignee";
  const latestRecognition = study?.recognitions[study.recognitions.length - 1]?.exactWording ?? "Aucune comprehension explicitement formulee";
  const status = study?.currentLevel ?? latestDraft?.methodologicalStatus ?? "Observation ouverte";

  return (
    <div className="grid gap-4">
      <Panel title={study ? `Suivi de l'etude : ${study.title}` : "Suivi de l'observation"}>
        <p className="text-sm leading-6 text-stone-300">
          {study ? "Le suivi affiche uniquement les donnees de l'etude selectionnee." : "Selectionnez ou creez une etude pour contextualiser le suivi."}
        </p>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Observation ouverte" value={latestDraft && latestDraft.status !== "validated" ? "oui" : "non"} />
        <StatCard label="Temps ecoule" value={latestObservation ? elapsedTime(latestObservation.createdAt) : latestDraft ? elapsedTime(latestDraft.createdAt) : "non calculable"} />
        <StatCard label="Statut methodologique" value={status} />
      </div>
      <Panel title="Suivi">
        <div className="grid gap-3 md:grid-cols-2">
          <FollowupItem label="Derniere manifestation" value={latestManifestation} />
          <FollowupItem label="Derniere emotion exprimee" value={latestEmotion} />
          <FollowupItem label="Derniere comprehension explicitement formulee" value={latestRecognition} />
          <FollowupItem label="Observation en cours" value={latestObservation?.rawText ?? latestDraft?.rawText ?? "Aucune observation ouverte"} />
        </div>
      </Panel>
      <Panel title="Questions ouvertes">
        <ul className="grid gap-2">
          {expectedItems(study, latestDraft).map((item) => (
            <li key={item} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-200">
              {item}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function FollowupItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-stone-100">{value}</p>
    </div>
  );
}

function expectedItems(study?: Study, draft?: ObservationAnalysisDraft) {
  const questions = study?.openQuestions?.filter((question) => question.status === "ouverte").map((question) => question.text) ?? [];
  if (questions.length) return questions;
  if (!draft) return ["Nouvelle observation a documenter."];
  const items = [
    draft.detectedManifestations.length ? "" : "Manifestation explicite.",
    draft.detectedEmotions.length ? "" : "Emotion exprimee ou absence d'emotion a confirmer.",
    draft.relationProposals.length ? "Relation proposee a valider, modifier ou ignorer." : "Relation temporelle encore non observable.",
    draft.methodologicalStatus === "Donnees insuffisantes" ? "Observation supplementaire avant construction Delta." : ""
  ].filter(Boolean);
  return items.length ? items : ["Aucun element attendu detecte pour le moment."];
}

function elapsedTime(date: string) {
  const created = Date.parse(date);
  if (!Number.isFinite(created)) return "non calculable";
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} j`;
}
