import Link from "next/link";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "The Mission of fml labs — fml labs",
  description: `${PRODUCT_TAGLINE} — The mission and purpose of fml labs`,
};

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/chat/new"
          aria-label="Home"
          title="Home"
          className="mb-8 inline-flex items-center justify-center rounded-xl border border-neutral-200/90 dark:border-neutral-700 px-3 py-2 text-neutral-600 dark:text-neutral-300 hover:text-foreground hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-2">The Mission of fml labs</h1>
        <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base font-medium mb-6">
          {PRODUCT_TAGLINE}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base font-medium">
            In a world of cognitive surrender, start taking back control.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base">
            fml labs is built to support one practical goal: help people make better decisions day-to-day by combining
            <strong> deep thinking </strong> with <strong>daily execution</strong>.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base">
            The product intentionally lives at the intersection of <strong>productivity and wellness</strong> - journaling, reflection, nutrition tracking, and mental models in one workflow - so insight is easier to turn into consistent action.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base">
            It is a personal, evolving project focused on building useful AI systems that are calm, practical, and grounded in everyday life.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/faq" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            FAQ
          </Link>
          <Link href="/leaderboard" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About the Creator
          </Link>
          <Link href="/terms-of-service" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/chat/new" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
