/** Shared heuristics for control-relevant status notes (credit, discount, contract window). */
export function isControlOverrideNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const n = note.toLowerCase();
  return (
    n.includes("override") ||
    n.includes("credit override") ||
    n.includes("discount") ||
    n.includes("outside the contract")
  );
}

export type ControlActivityKindFilter =
  | "override"
  | "approval"
  | "collection"
  | "all";

export function parseControlKindParam(
  raw: string | undefined,
): ControlActivityKindFilter {
  if (raw === "approval" || raw === "collection" || raw === "all") return raw;
  return "override";
}
