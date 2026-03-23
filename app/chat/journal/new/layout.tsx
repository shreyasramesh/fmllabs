import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal entry · FigureMyLife Labs",
  description: "Write a freeform journal entry saved to your library.",
};

export default function JournalNewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
