import type { Metadata } from "next";
import { Suspense } from 'react';
import { ExperimentActivityTracker } from '@/components/ExperimentActivityTracker';
import "./globals.css";

export const metadata: Metadata = {
  title: "ReSearch - Fast Search Engine",
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
        <Suspense fallback={null}>
          <ExperimentActivityTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
