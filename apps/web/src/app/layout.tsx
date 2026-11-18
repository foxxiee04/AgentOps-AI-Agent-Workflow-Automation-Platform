import type { Metadata } from "next";
import type { ReactNode } from "react";
import { resolvePublicApiUrl, runtimeConfigScript } from "../lib/runtime-config";
// Self-hosted fonts (all subsets incl. Vietnamese, served from the build): next/font/google downloads from Google
// Fonts at build time and Turbopack failed builds on CI runners when that download did not succeed.
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AgentOps",
  description: "AI Agent workflow automation platform"
};

// The public API URL is a runtime setting, so the layout must be rendered per request.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript({ apiUrl: resolvePublicApiUrl() }) }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
