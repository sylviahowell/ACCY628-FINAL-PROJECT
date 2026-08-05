"use client";

import { useServerInsertedHTML } from "next/navigation";
import {
  APPEARANCE_OPTIONS,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
} from "@/components/ThemeSelector";

const ALLOWED_JSON = JSON.stringify(APPEARANCE_OPTIONS.map((o) => o.id));

/**
 * Injects the theme boot script via the SSR HTML stream (outside the React
 * client tree) so React 19 does not warn about rendering a <script> in a component.
 */
export function AppearanceBoot() {
  useServerInsertedHTML(() => {
    const script = `
(function () {
  try {
    var key = ${JSON.stringify(APPEARANCE_STORAGE_KEY)};
    var allowed = ${ALLOWED_JSON};
    var fallback = ${JSON.stringify(DEFAULT_APPEARANCE)};
    var saved = localStorage.getItem(key);
    var theme = allowed.indexOf(saved) >= 0 ? saved : fallback;
    document.documentElement.setAttribute("data-theme", theme);
    if (saved !== theme) localStorage.setItem(key, theme);
  } catch (e) {}
})();`;

    return (
      <script
        id="rowanlane-appearance-boot"
        dangerouslySetInnerHTML={{ __html: script }}
      />
    );
  });

  return null;
}
