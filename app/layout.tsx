import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copyright Search - Fast Search Engine",
  description: "Modern search engine powered by Google Custom Search API",
  keywords: ["search", "google", "search engine", "web search"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}