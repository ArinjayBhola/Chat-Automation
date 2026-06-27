import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Relay - AI assistant for Gmail, Drive, Docs, Calendar & Notion",
  description:
    "Issue plain-English commands and let Relay orchestrate your tools, with approval gates for anything that matters.",
  applicationName: "Relay",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
