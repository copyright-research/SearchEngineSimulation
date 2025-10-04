import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copyright Search - 快速搜索引擎",
  description: "基于 Google Custom Search API 的现代化搜索引擎",
  keywords: ["搜索", "search", "google", "搜索引擎"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}