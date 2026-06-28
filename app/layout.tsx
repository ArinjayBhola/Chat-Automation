import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

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
      <body className={`${lora.className} min-h-screen antialiased text-[16px] font-medium tracking-tight`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
