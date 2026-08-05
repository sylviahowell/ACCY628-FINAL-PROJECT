/** Demo seed copy polish — strips STORY prefixes and rewrites placeholder POD hosts.
 * This is NOT HTML/XSS sanitization. React text rendering still provides XSS safety.
 */
export function polishDemoCopy(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/^STORY\s*[A-Z]?:\s*/i, "")
    .replace(/\bhttps?:\/\/example\.com\/pod\//gi, "https://docs.rowanlane.com/pod/")
    .trim();
}

/** @deprecated Prefer polishDemoCopy — kept for existing imports. */
export const sanitizeDemoText = polishDemoCopy;

/** Map placeholder POD URLs to a believable docs host. */
export function normalizePodUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^https?:\/\/example\.com\/pod\//i, "https://docs.rowanlane.com/pod/")
    .replace(/^https?:\/\/example\.com\//i, "https://docs.rowanlane.com/");
}

export const DEFAULT_POD_URL = "https://docs.rowanlane.com/pod/signed-bol.pdf";
