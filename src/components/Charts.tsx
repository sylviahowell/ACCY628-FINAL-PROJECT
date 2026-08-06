"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/types";

type ChartColors = {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  content: string;
  muted: string;
};

const FALLBACK: ChartColors = {
  primary: "#0866d9",
  secondary: "#0a1f3d",
  accent: "#0f766e",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  content: "#334155",
  muted: "#94a3b8",
};

function readThemeColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    primary: pick("--color-primary", FALLBACK.primary),
    secondary: pick("--color-secondary", FALLBACK.secondary),
    accent: pick("--color-accent", FALLBACK.accent),
    success: pick("--color-success", FALLBACK.success),
    warning: pick("--color-warning", FALLBACK.warning),
    error: pick("--color-error", FALLBACK.error),
    content: pick("--color-base-content", FALLBACK.content),
    muted: pick("--color-base-content", FALLBACK.muted),
  };
}

function useChartColors() {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    const sync = () => setColors(readThemeColors());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

/** Recharts measures the DOM; render only after client mount to avoid hydration mismatches. */
function useChartReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  const ready = useChartReady();
  if (!ready) {
    return <div className="h-64 w-full" aria-hidden />;
  }
  return <div className="h-64 w-full">{children}</div>;
}

export function MonthlyBars({
  data,
  dataKey,
  name,
}: {
  data: { month: string; value: number }[];
  dataKey?: string;
  name: string;
}) {
  const colors = useChartColors();
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.25} />
          <XAxis dataKey="month" stroke={colors.content} tick={{ fill: colors.content, fontSize: 12 }} />
          <YAxis
            stroke={colors.content}
            width={84}
            tick={{ fill: colors.content, fontSize: 11 }}
            tickFormatter={(v) => money(Number(v))}
          />
          <Tooltip
            formatter={(value) => money(Number(value ?? 0))}
            contentStyle={{
              background: "var(--color-base-100)",
              borderColor: "var(--color-base-300)",
              color: "var(--color-base-content)",
            }}
          />
          <Bar
            dataKey={dataKey ?? "value"}
            name={name}
            fill={colors.primary}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function StatusPie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const colors = useChartColors();
  const palette = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.success,
    colors.warning,
    colors.error,
  ];
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={({ value }) => money(Number(value ?? 0))}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => money(Number(value ?? 0))}
            contentStyle={{
              background: "var(--color-base-100)",
              borderColor: "var(--color-base-300)",
              color: "var(--color-base-content)",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function HorizontalBars({
  data,
  name,
}: {
  data: { name: string; value: number }[];
  name: string;
}) {
  const colors = useChartColors();
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.25} />
          <XAxis
            type="number"
            stroke={colors.content}
            tick={{ fill: colors.content, fontSize: 11 }}
            tickFormatter={(v) => money(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            stroke={colors.content}
            tick={{ fill: colors.content, fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => money(Number(value ?? 0))}
            contentStyle={{
              background: "var(--color-base-100)",
              borderColor: "var(--color-base-300)",
              color: "var(--color-base-content)",
            }}
          />
          <Bar dataKey="value" name={name} fill={colors.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
