import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product-tagline";

export const metadata: Metadata = {
  title: `Journal entry · ${PRODUCT_NAME}`,
  description: "Write a freeform journal entry saved to your library.",
};

export default function JournalNewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
