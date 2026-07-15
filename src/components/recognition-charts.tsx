"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Study } from "@/lib/types";

const colors = ["#d6b25e", "#7dd3fc", "#a7f3d0", "#f9a8d4", "#c4b5fd", "#fb7185"];

export function RecognitionCharts({ study, mode }: { study: Study; mode: "emotions" | "recognitions" }) {
  const emotionTimeline = study.emotionObservations.map((emotion) => ({
    date: emotion.date.slice(5),
    emotion: emotion.emotion,
    intensité: emotion.intensity
  }));

  const emotionDistribution = Array.from(
    study.emotionObservations.reduce((map, item) => {
      map.set(item.emotion, (map.get(item.emotion) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).map(([name, value]) => ({ name, value }));

  const recognitions = study.recognitions.map((recognition) => ({
    name: recognition.title,
    confirmation: recognition.confirmationLevel,
    stable: recognition.stableOverTime ? 1 : 0
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-72 rounded-md border border-white/10 bg-white/[0.035] p-3">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "emotions" ? (
            <LineChart data={emotionTimeline}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" stroke="#a8a29e" />
              <YAxis domain={[0, 10]} stroke="#a8a29e" />
              <Tooltip contentStyle={{ background: "#0b1728", border: "1px solid rgba(214,178,94,.3)" }} />
              <Legend />
              <Line type="monotone" dataKey="intensité" stroke="#d6b25e" strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={recognitions}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#a8a29e" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 3]} stroke="#a8a29e" />
              <Tooltip contentStyle={{ background: "#0b1728", border: "1px solid rgba(214,178,94,.3)" }} />
              <Bar dataKey="confirmation" fill="#d6b25e" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="h-72 rounded-md border border-white/10 bg-white/[0.035] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={emotionDistribution} dataKey="value" nameKey="name" outerRadius={92} label>
              {emotionDistribution.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#0b1728", border: "1px solid rgba(214,178,94,.3)" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
