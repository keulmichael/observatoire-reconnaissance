import { Panel } from "@/components/ui";

export function ObservationQuestions({ questions }: { questions: string[] }) {
  return (
    <Panel title="Questions proposées">
      {questions.length ? (
        <ul className="grid gap-2">
          {questions.map((question) => (
            <li key={question} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-200">
              {question}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">Aucune question proposée.</p>
      )}
    </Panel>
  );
}
