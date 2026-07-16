import { Search } from "lucide-react";

export function ObservationInput({
  value,
  onChange,
  onAnalyze
}: {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void | Promise<void>;
}) {
  return (
    <section className="glass rounded-lg p-4">
      <div className="grid gap-3">
        <label className="grid gap-2">
          <span className="text-lg font-semibold text-white">Nouvelle observation</span>
          <textarea
            className="min-h-[240px] rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-base leading-7 text-white placeholder:text-stone-500"
            placeholder="Décrivez librement ce que vous venez d'observer."
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <p className="whitespace-pre-line rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-400">
          Hier j&apos;ai présenté une nouvelle idée.
          {"\n"}Aujourd&apos;hui une personne m&apos;a dit qu&apos;elle était perdue.
          {"\n"}Je ne sais pas pourquoi.
        </p>
        <div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onAnalyze}
            disabled={!value.trim()}
          >
            <Search className="h-4 w-4" aria-hidden />
            Analyser l&apos;observation
          </button>
        </div>
      </div>
    </section>
  );
}
