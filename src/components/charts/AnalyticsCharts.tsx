"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsSummary } from "@/lib/analytics";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 12,
};

export function AttemptTrendChart({ data }: { data: AnalyticsSummary["dailyTrend"] }) {
  if (data.length === 0) {
    return <Empty label="No attempt activity in this range." />;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={(value: string) => value.slice(5)} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => String(value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="attempts" name="Started" stroke="#1d48b6" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="completed" name="Completed" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreBandChart({ data }: { data: AnalyticsSummary["scoreBands"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Candidates" fill="#1d48b6" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectionPerformanceChart({ data }: { data: AnalyticsSummary["sectionAverages"] }) {
  const chartData = data.map((item) => ({
    name: `${item.code} · ${item.name}`,
    average: item.average ?? 0,
    count: item.count,
  }));
  if (chartData.length === 0) return <Empty label="No section results in this range." />;
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#475569" }} />
          <YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 10, fill: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Math.round(Number(value))}%`, "Average"]} />
          <Bar dataKey="average" fill="#2f63d8" radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DifficultyPerformanceChart({ data }: { data: AnalyticsSummary["difficultyAverages"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#475569" }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Math.round(Number(value))}%`, "Average"]} />
          <Bar dataKey="average" fill="#f4c400" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex h-56 items-center justify-center text-sm text-slate-500">{label}</div>;
}
