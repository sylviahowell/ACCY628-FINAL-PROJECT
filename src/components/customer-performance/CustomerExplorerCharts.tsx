"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyPoint } from "@/lib/customer-performance";
import { money } from "@/lib/types";

type ChartColors = {
  primary: string;
  accent: string;
  success: string;
  content: string;
  muted: string;
};

const FALLBACK: ChartColors = {
  primary: "#0866d9",
  accent: "#0f766e",
  success: "#22c55e",
  content: "#334155",
  muted: "#94a3b8",
};

function useChartColors() {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    const sync = () => {
      const s = getComputedStyle(document.documentElement);
      const pick = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
      setColors({
        primary: pick("--color-primary", FALLBACK.primary),
        accent: pick("--color-accent", FALLBACK.accent),
        success: pick("--color-success", FALLBACK.success),
        content: pick("--color-base-content", FALLBACK.content),
        muted: pick("--color-base-content", FALLBACK.muted),
      });
    };
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

function useReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function tipStyle() {
  return {
    background: "var(--color-base-100)",
    borderColor: "var(--color-base-300)",
    color: "var(--color-base-content)",
    borderRadius: 10,
  };
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cpe-panel flex min-h-0 flex-1 flex-col gap-2">
      <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
      <div className="h-48 w-full grow">{children}</div>
    </div>
  );
}

function Placeholder() {
  return <div className="cpe-panel h-56 animate-pulse bg-base-200/50" />;
}

export function CustomerCenterCharts({ series }: { series: MonthlyPoint[] }) {
  const colors = useChartColors();
  const ready = useReady();
  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <Placeholder />
        <Placeholder />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartCard title="Revenue trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.2} />
            <XAxis dataKey="month" tick={{ fill: colors.content, fontSize: 11 }} />
            <YAxis
              width={64}
              tick={{ fill: colors.content, fontSize: 10 }}
              tickFormatter={(v) => money(Number(v))}
            />
            <Tooltip formatter={(v) => money(Number(v ?? 0))} contentStyle={tipStyle()} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={colors.primary}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Profit trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.2} />
            <XAxis dataKey="month" tick={{ fill: colors.content, fontSize: 11 }} />
            <YAxis
              width={64}
              tick={{ fill: colors.content, fontSize: 10 }}
              tickFormatter={(v) => money(Number(v))}
            />
            <Tooltip formatter={(v) => money(Number(v ?? 0))} contentStyle={tipStyle()} />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke={colors.accent}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function CustomerRightCharts({ series }: { series: MonthlyPoint[] }) {
  const colors = useChartColors();
  const ready = useReady();
  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <Placeholder />
        <Placeholder />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartCard title="Margin %">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.2} />
            <XAxis dataKey="month" tick={{ fill: colors.content, fontSize: 11 }} />
            <YAxis
              width={40}
              tick={{ fill: colors.content, fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Margin"]}
              contentStyle={tipStyle()}
            />
            <Line
              type="monotone"
              dataKey="marginPct"
              name="Margin %"
              stroke={colors.success}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Shipment activity">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.2} />
            <XAxis dataKey="month" tick={{ fill: colors.content, fontSize: 11 }} />
            <YAxis width={28} allowDecimals={false} tick={{ fill: colors.content, fontSize: 10 }} />
            <Tooltip contentStyle={tipStyle()} />
            <Bar
              dataKey="shipments"
              name="Shipments"
              fill={colors.primary}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
