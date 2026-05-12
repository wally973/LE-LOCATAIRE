"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const dataDefault = [
  { name: "Ouverts", v: 12 },
  { name: "Blocage entretien", v: 4 },
  { name: "En cours", v: 7 },
  { name: "Résolus", v: 54 },
];

export function TicketStatsChart({
  data = dataDefault,
}: {
  data?: { name: string; v: number }[];
}) {
  return (
    <div className="h-[280px] w-full rounded-lg border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" fontSize={12} />
          <YAxis />
          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
