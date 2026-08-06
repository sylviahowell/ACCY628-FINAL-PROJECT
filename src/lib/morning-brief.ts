export type BriefLine = { label: string; value: string; href?: string };

export function morningBriefGreeting(fullName: string): string {
  const first = fullName.split(" ")[0] || "there";
  return `Good morning, ${first}.`;
}
