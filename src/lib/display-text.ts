/** Demo seed copy polish — strips STORY prefixes and rewrites placeholder POD hosts.
 * This is NOT HTML/XSS sanitization. React text rendering still provides XSS safety.
 */
export function polishDemoCopy(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/^STORY\s*[A-Z]?:\s*/i, "")
    .replace(/\bhttps?:\/\/[^/\s]+\/pod\//gi, "/pod-samples/")
    .trim();
}

/** @deprecated Prefer polishDemoCopy — kept for existing imports. */
export const sanitizeDemoText = polishDemoCopy;

/**
 * Map placeholder / legacy POD URLs to local sample PDFs under /pod-samples.
 * Keeps real local uploads and Supabase Storage URLs.
 */
export function normalizePodUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/pod-uploads/") || trimmed.startsWith("/pod-samples/")) {
    return trimmed;
  }
  if (trimmed.startsWith("/insurance-uploads/")) {
    return trimmed;
  }
  if (trimmed.includes("/storage/v1/object/")) return trimmed;

  // https://docs.freightflow.com/pod/ld-1002.pdf → /pod-samples/ld-1002.pdf
  const podPath = trimmed.match(/^https?:\/\/[^/]+\/pod\/([^/?#]+)$/i);
  if (podPath?.[1]) {
    return `/pod-samples/${podPath[1]}`;
  }

  // https://example.com/pod-smoke.pdf → /pod-samples/signed-bol.pdf
  if (/^https?:\/\/example\.com\//i.test(trimmed)) {
    return DEFAULT_POD_URL;
  }

  // Legacy hosts rewritten mid-string
  const rewritten = trimmed
    .replace(/^https?:\/\/docs\.freightflow\.com\/pod\//i, "/pod-samples/")
    .replace(/^https?:\/\/docs\.rowanlane\.com\/pod\//i, "/pod-samples/")
    .replace(/^https?:\/\/example\.com\/pod\//i, "/pod-samples/");
  if (rewritten.startsWith("/pod-samples/")) return rewritten;

  return trimmed;
}

export const DEFAULT_POD_URL = "/pod-samples/signed-bol.pdf";
export const SAMPLE_SIGNED_BOL_PATH = "/pod-samples/signed-bol.pdf";
