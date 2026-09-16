import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "今天穿什么 · WearWhat",
  description:
    "别问，问就是它。四季衣物管理、AI 搭配推荐、穿搭日历，解决每天『今天穿什么』的难题。",
  keywords: ["穿搭", "衣橱管理", "AI 搭配", "今天穿什么", "WearWhat"],
  applicationName: "今天穿什么",
  openGraph: {
    title: "今天穿什么 · WearWhat",
    description: "你负责出门，它负责搭。",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
