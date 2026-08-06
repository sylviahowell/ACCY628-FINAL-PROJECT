"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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

function ChartFrame({
  children,
  className = "h-64 w-full",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ready = useChartReady();
  if (!ready) {
    return <div className={className} aria-hidden />;
  }
  return <div className={className}>{children}</div>;
}

function tooltipStyle() {
  return {
    background: "var(--color-base-100)",
    borderColor: "var(--color-base-300)",
    color: "var(--color-base-content)",
  };
}

function stackPalette(colors: ChartColors): string[] {
  return [
    colors.primary,
    colors.accent,
    colors.secondary,
    colors.success,
    colors.warning,
    colors.error,
    colors.muted,
  ];
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
            contentStyle={tooltipStyle()}
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
  labelMode = "money",
}: {
  data: { name: string; value: number }[];
  /** Slice labels: money (default), share %, or none (legend + tooltip only). */
  labelMode?: "money" | "percent" | "none";
}) {
  const colors = useChartColors();
  const palette = stackPalette(colors);
  const total = data.reduce((s, d) => s + Math.max(0, Number(d.value) || 0), 0);
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={
              labelMode === "none"
                ? false
                : ({ value }) => {
                    const n = Number(value ?? 0);
                    if (labelMode === "percent") {
                      if (total <= 0) return "0%";
                      return `${Math.round((n / total) * 100)}%`;
                    }
                    return money(n);
                  }
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const n = Number(value ?? 0);
              if (labelMode === "percent" && total > 0) {
                return `${money(n)} (${Math.round((n / total) * 100)}%)`;
              }
              return money(n);
            }}
            contentStyle={tooltipStyle()}
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
            contentStyle={tooltipStyle()}
          />
          <Bar dataKey="value" name={name} fill={colors.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Stacked monthly margin by customer + total profit line. */
export function ProfitContributionChart({
  data,
  seriesKeys,
}: {
  data: Array<Record<string, string | number> & { month: string; total: number }>;
  seriesKeys: string[];
}) {
  const colors = useChartColors();
  const palette = stackPalette(colors);

  return (
    <ChartFrame className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.25} />
          <XAxis
            dataKey="month"
            stroke={colors.content}
            tick={{ fill: colors.content, fontSize: 12 }}
          />
          <YAxis
            stroke={colors.content}
            width={84}
            tick={{ fill: colors.content, fontSize: 11 }}
            tickFormatter={(v) => money(Number(v))}
          />
          <Tooltip
            formatter={(value, name) => [money(Number(value ?? 0)), String(name)]}
            contentStyle={tooltipStyle()}
          />
          <Legend />
          {seriesKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="margin"
              fill={palette[i % palette.length]}
              radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
          <Line
            type="monotone"
            dataKey="total"
            name="Total profit"
            stroke={colors.secondary}
            strokeWidth={2.5}
            dot={{ r: 3, fill: colors.secondary }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Monthly revenue & COGS bars with margin % on a secondary axis. */
export function MonthlyEconomicsChart({
  data,
}: {
  data: {
    month: string;
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number;
  }[];
}) {
  const colors = useChartColors();

  return (
    <ChartFrame className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.25} />
          <XAxis
            dataKey="month"
            stroke={colors.content}
            tick={{ fill: colors.content, fontSize: 12 }}
          />
          <YAxis
            yAxisId="money"
            stroke={colors.content}
            width={84}
            tick={{ fill: colors.content, fontSize: 11 }}
            tickFormatter={(v) => money(Number(v))}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            stroke={colors.content}
            width={48}
            tick={{ fill: colors.content, fontSize: 11 }}
            tickFormatter={(v) => `${Number(v)}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              const label = String(name);
              if (label === "Margin %") {
                return [`${Number(value ?? 0).toFixed(1)}%`, label];
              }
              return [money(Number(value ?? 0)), label];
            }}
            contentStyle={tooltipStyle()}
          />
          <Legend />
          <Bar
            yAxisId="money"
            dataKey="revenue"
            name="Revenue"
            fill={colors.primary}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="money"
            dataKey="cogs"
            name="COGS"
            fill={colors.warning}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="marginPct"
            name="Margin %"
            stroke={colors.success}
            strokeWidth={2.5}
            dot={{ r: 3, fill: colors.success }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
