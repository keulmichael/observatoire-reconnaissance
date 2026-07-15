import { Panel } from "@/components/ui";

export function ObservationSummary({ rawText }: { rawText: string }) {
  return (
    <Panel title="Ce que vous avez observé">
      <p className="whitespace-pre-wrap text-sm leading-7 text-stone-100">{rawText}</p>
    </Panel>
  );
}
