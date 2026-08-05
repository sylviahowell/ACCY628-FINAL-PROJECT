import type { TimelineStep } from "@/lib/c2c-timeline";

function stateClass(state: TimelineStep["state"]) {
  if (state === "complete") return "bg-success";
  if (state === "current") return "bg-primary";
  if (state === "blocked") return "bg-error";
  return "bg-base-300";
}

function stateLabel(state: TimelineStep["state"]) {
  if (state === "complete") return "Complete";
  if (state === "current") return "Current";
  if (state === "blocked") return "Blocked";
  return "Not started";
}

export function C2CTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">Contract-to-cash timeline</h2>
        <p className="text-sm opacity-70">
          Operational and billing milestones. A step is complete only when supporting records exist.
        </p>
        <ul className="mt-2 space-y-3">
          {steps.map((step) => (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full ${stateClass(step.state)}`} />
                <span className="w-px flex-1 bg-base-300" />
              </div>
              <div className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{step.label}</p>
                  <span className="badge badge-ghost badge-xs">{stateLabel(step.state)}</span>
                </div>
                <p className="text-xs opacity-60">
                  {step.role}
                  {step.at ? ` · ${new Date(step.at).toLocaleString()}` : ""}
                </p>
                {step.detail ? <p className="text-sm opacity-80">{step.detail}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
