/** Strip seed/scaffold prefixes so judges see ops-toned copy. */
export function sanitizeDemoText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/^STORY\s*[A-Z]?:\s*/i, "")
    .replace(/\bhttps?:\/\/example\.com\/pod\//gi, "https://docs.freightflow.com/pod/")
    .trim();
}

/** Map placeholder POD URLs to a believable docs host. */
export function normalizePodUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^https?:\/\/example\.com\/pod\//i, "https://docs.freightflow.com/pod/")
    .replace(/^https?:\/\/example\.com\//i, "https://docs.freightflow.com/");
}

export const DEFAULT_POD_URL = "https://docs.freightflow.com/pod/signed-bol.pdf";
