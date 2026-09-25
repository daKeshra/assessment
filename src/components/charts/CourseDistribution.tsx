"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Datum {
  name: string;
  count: number;
}

export default function CourseDistribution({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No completed assessments yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#475569" }}
            angle={-35}
            textAnchor="end"
            height={70}
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f3f6ff" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Bar dataKey="count" name="Candidates" fill="#1d48b6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
