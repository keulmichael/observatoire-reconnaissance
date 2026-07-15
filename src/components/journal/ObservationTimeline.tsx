import { Badge } from "@/components/ui";
import type { ObservationChronologyEntry } from "@/lib/types";

export function ObservationTimeline({ entries }: { entries: ObservationChronologyEntry[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">Chronologie détectée</h3>
      {entries.length ? (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{entry.phase}</p>
                <Badge>{entry.precision}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-200">{entry.label}</p>
              <p className="mt-1 text-xs text-stone-500">{entry.temporalMarker}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400">Aucun repère temporel détecté.</p>
      )}
    </div>
  );
}
