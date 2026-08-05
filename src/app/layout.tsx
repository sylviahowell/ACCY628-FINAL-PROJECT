import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { AppearanceBoot } from "@/components/AppearanceBoot";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RowanLane | Freight Brokerage & Logistics",
  description:
    "Contract-to-cash management for freight brokerage and logistics",
};

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
        <AppearanceBoot />
        {children}
      </body>
    </html>
  );
}
