"use client";

import type React from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import type {
  DetectedCatalyst,
  DetectedConcept,
  DetectedEmotion,
  DetectedManifestation,
  DetectedPerson,
  ObservationAnalysisDraft,
  ObservationProposalBase,
  ObservationRelationProposal
} from "@/lib/types";

type ProposalKey =
  | "detectedPeople"
  | "detectedManifestations"
  | "detectedEmotions"
  | "detectedCatalysts"
  | "detectedConcepts"
  | "relationProposals";

export function ObservationValidation({
  draft,
  onChange
}: {
  draft: ObservationAnalysisDraft;
  onChange: (draft: ObservationAnalysisDraft) => void;
}) {
  function updateList<T extends ObservationProposalBase>(key: ProposalKey, updater: (items: T[]) => T[]) {
    const updatedItems = updater(draft[key] as unknown as T[]);
    onChange({
      ...draft,
      [key]: updatedItems,
      chronology: draft.chronology.map((entry) => {
        const matching = updatedItems.find((item) => item.sourceExcerpt === entry.sourceExcerpt);
        return matching ? { ...entry, label: matching.label, status: matching.status } : entry;
      }),
      status: "reviewed"
    });
  }

  function addPerson() {
    const value = window.prompt("Personne citée");
    if (!value?.trim()) return;
    const person: DetectedPerson = {
      id: `manual-person-${Date.now()}`,
      label: value.trim(),
      entityText: value.trim(),
      sourceExcerpt: "Ajout utilisateur",
      confidence: 1,
      status: "accepted",
      reason: "Entité textuelle ajoutée par l'utilisateur.",
      provenance: ["user"]
    };
    updateList<DetectedPerson>("detectedPeople", (items) => [person, ...items]);
  }

  return (
    <Panel title="Ce qui reste à confirmer">
      <div className="grid gap-4">
        <ProposalGroup title="Personnes détectées" onAdd={addPerson}>
          {draft.detectedPeople.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[item.reason]}
              onAccept={() => updateList<DetectedPerson>("detectedPeople", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<DetectedPerson>("detectedPeople", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<DetectedPerson>("detectedPeople", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>

        <ProposalGroup title="Manifestations détectées">
          {draft.detectedManifestations.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[item.kind, item.reason]}
              onAccept={() => updateList<DetectedManifestation>("detectedManifestations", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<DetectedManifestation>("detectedManifestations", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<DetectedManifestation>("detectedManifestations", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>

        <ProposalGroup title="Émotions détectées">
          {draft.detectedEmotions.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[item.expressionKind, item.sourceKind, item.reason]}
              onAccept={() => updateList<DetectedEmotion>("detectedEmotions", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<DetectedEmotion>("detectedEmotions", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<DetectedEmotion>("detectedEmotions", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>

        <ProposalGroup title="Catalyseurs proposés">
          {draft.detectedCatalysts.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[item.catalystType, item.reason]}
              onAccept={() => updateList<DetectedCatalyst>("detectedCatalysts", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<DetectedCatalyst>("detectedCatalysts", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<DetectedCatalyst>("detectedCatalysts", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>

        <ProposalGroup title="Concepts détectés">
          {draft.detectedConcepts.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[item.reason]}
              onAccept={() => updateList<DetectedConcept>("detectedConcepts", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<DetectedConcept>("detectedConcepts", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<DetectedConcept>("detectedConcepts", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>

        <ProposalGroup title="Relations possibles">
          {draft.relationProposals.map((item) => (
            <ProposalRow
              key={item.id}
              item={item}
              details={[
                `source A : ${item.sourceA}`,
                `source B : ${item.sourceB}`,
                item.reason,
                `confiance : ${Math.round(item.confidence * 100)} %`,
                `statut : ${item.initialStatus}`
              ]}
              onAccept={() => updateList<ObservationRelationProposal>("relationProposals", updateStatus(item.id, "accepted"))}
              onReject={() => updateList<ObservationRelationProposal>("relationProposals", updateStatus(item.id, "rejected"))}
              onEdit={(label) => updateList<ObservationRelationProposal>("relationProposals", updateLabel(item.id, label))}
            />
          ))}
        </ProposalGroup>
      </div>
    </Panel>
  );
}

function ProposalGroup({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {onAdd ? (
          <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-xs text-stone-200" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Ajouter
          </button>
        ) : null}
      </div>
      <div className="grid gap-2">{children || <p className="text-sm text-stone-500">Aucune proposition.</p>}</div>
    </div>
  );
}

function ProposalRow({
  item,
  details,
  onAccept,
  onReject,
  onEdit
}: {
  item: ObservationProposalBase;
  details: string[];
  onAccept: () => void;
  onReject: () => void;
  onEdit: (label: string) => void;
}) {
  return (
    <div className={`rounded-md border p-3 ${item.status === "rejected" ? "border-red-400/30 bg-red-400/10" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{item.label}</p>
            <Badge>{item.status}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-300">{item.sourceExcerpt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {details.map((detail) => (
              <span key={detail} className="rounded-full border border-white/10 px-2 py-1 text-xs text-stone-400">
                {detail}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Valider" onClick={onAccept}>
            <Check className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton
            label="Modifier"
            onClick={() => {
              const value = window.prompt("Modifier la proposition", item.label);
              if (value?.trim()) onEdit(value.trim());
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Ignorer" onClick={onReject}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="rounded-md border border-white/10 p-2 text-stone-200 transition hover:border-gold/35 hover:text-goldSoft" title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function updateStatus<T extends ObservationProposalBase>(id: string, status: T["status"]) {
  return (items: T[]) => items.map((item) => (item.id === id ? { ...item, status } : item));
}

function updateLabel<T extends ObservationProposalBase>(id: string, label: string) {
  return (items: T[]) => items.map((item) => (item.id === id ? { ...item, label, status: "edited" as const } : item));
}
