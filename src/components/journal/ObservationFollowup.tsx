import { Panel, StatCard } from "@/components/ui";
import type { ObservationAnalysisDraft, Study } from "@/lib/types";

export function ObservationFollowup({ drafts, studies }: { drafts: ObservationAnalysisDraft[]; studies: Study[] }) {
  const latestDraft = drafts[0];
  const latestStudy = studies[0];
  const latestManifestation = latestStudy?.manifestations[0]?.title ?? latestDraft?.detectedManifestations[0]?.label ?? "Non renseigné";
  const latestEmotion = latestStudy?.emotionObservations[0]?.emotion ?? latestDraft?.detectedEmotions[0]?.label ?? "Non renseignée";
  const latestRecognition = latestStudy?.recognitions[0]?.exactWording ?? "Aucune compréhension explicitement formulée";
  const status = latestDraft?.methodologicalStatus ?? latestStudy?.currentLevel ?? "Observation ouverte";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Observation ouverte" value={latestDraft && latestDraft.status !== "validated" ? "oui" : "non"} />
        <StatCard label="Temps écoulé" value={latestDraft ? elapsedTime(latestDraft.createdAt) : "non calculable"} />
        <StatCard label="Statut méthodologique" value={status} />
      </div>
      <Panel title="Suivi">
        <div className="grid gap-3 md:grid-cols-2">
          <FollowupItem label="Dernière manifestation" value={latestManifestation} />
          <FollowupItem label="Dernière émotion exprimée" value={latestEmotion} />
          <FollowupItem label="Dernière compréhension explicitement formulée" value={latestRecognition} />
          <FollowupItem label="Observation en cours" value={latestDraft?.rawText ?? "Aucune observation ouverte"} />
        </div>
      </Panel>
      <Panel title="Éléments encore attendus">
        <ul className="grid gap-2">
          {expectedItems(latestDraft).map((item) => (
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

function expectedItems(draft?: ObservationAnalysisDraft) {
  if (!draft) return ["Nouvelle observation à documenter."];
  const items = [
    draft.detectedManifestations.length ? "" : "Manifestation explicite.",
    draft.detectedEmotions.length ? "" : "Émotion exprimée ou absence d'émotion à confirmer.",
    draft.relationProposals.length ? "Relation proposée à valider, modifier ou ignorer." : "Relation temporelle encore non observable.",
    draft.methodologicalStatus === "Donnees insuffisantes" ? "Observation supplémentaire avant construction Delta." : ""
  ].filter(Boolean);
  return items.length ? items : ["Aucun élément attendu détecté pour le moment."];
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
