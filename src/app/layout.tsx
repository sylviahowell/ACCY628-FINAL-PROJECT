import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FreightFlow | Freight Brokerage & Logistics",
  description:
    "Contract-to-cash management for freight brokerage and logistics",
};

/** Apply saved appearance before paint to avoid a corporate→saved flash. */
const appearanceBootScript = `
(function () {
  try {
    var key = "freightflow-theme";
    var allowed = ["corporate", "business", "nord", "dim", "silk"];
    var saved = localStorage.getItem(key);
    var theme = allowed.indexOf(saved) >= 0 ? saved : "corporate";
    document.documentElement.setAttribute("data-theme", theme);
    if (saved !== theme) localStorage.setItem(key, theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="corporate"
      className={`${sans.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-base-200 text-base-content antialiased">
        <Script id="freightflow-appearance-boot" strategy="beforeInteractive">
          {appearanceBootScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
