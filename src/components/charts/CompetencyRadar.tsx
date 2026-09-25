"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Datum {
  name: string;
  score: number;
}

export default function CompetencyRadar({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-500">
        No competency scores recorded.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Radar
            dataKey="score"
            name="Score"
            stroke="#1d48b6"
            fill="#1d48b6"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
