import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: `The mission of ${PRODUCT_NAME} — ${PRODUCT_NAME}`,
  description: `${PRODUCT_TAGLINE} — The mission and purpose of ${PRODUCT_NAME}`,
};

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] dark:bg-[#141413] dark:text-[#faf9f5]">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/chat/new"
          aria-label="Home"
          title="Home"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-sm font-medium text-[#4d4c48] shadow-[#e8e6dc_0px_0px_0px_0px,#d1cfc5_0px_0px_0px_1px] transition-colors hover:bg-[#e8e6dc] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
          Home
        </Link>

        <h1 className="font-serif text-3xl font-medium leading-tight text-[#141413] dark:text-[#faf9f5] md:text-4xl mb-4">
          The mission of {PRODUCT_NAME}
        </h1>
        <p className="text-[#5e5d59] dark:text-[#87867f] leading-[1.6] text-base font-medium mb-10">
          {PRODUCT_TAGLINE}
        </p>

        <div className="space-y-6 text-base leading-[1.6] text-[#4d4c48] dark:text-[#b0aea5]">
          <p className="text-[#141413] dark:text-[#faf9f5] leading-[1.6] font-medium">
            In a world of cognitive surrender, start taking back control.
          </p>
          <p>
            Design inspired by the penco calendar and claude.
          </p>
          <p>
            {PRODUCT_NAME} is built so you can <strong className="text-[#141413] dark:text-[#faf9f5]">capture your story one day at a time</strong>
            — journaling, chat, reflection, and small daily wins in one calm workspace — and still go deep when you need{" "}
            <strong className="text-[#141413] dark:text-[#faf9f5]">first-principles thinking</strong>,{" "}
            <strong className="text-[#141413] dark:text-[#faf9f5]">mental models</strong>, and{" "}
            <strong className="text-[#141413] dark:text-[#faf9f5]">long-term memory</strong> to support better decisions.
          </p>
          <p>
            The product lives at the intersection of <strong className="text-[#141413] dark:text-[#faf9f5]">daily life and depth</strong>{" "}
            — nutrition, habits, perspective cards, and conversation — so what you capture today is easier to learn from tomorrow.
          </p>
          <p>
            It is a personal, evolving project focused on building useful AI systems that are calm, practical, and grounded in everyday life.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[#e8e6dc] dark:border-[#30302e] flex flex-wrap gap-4">
          <Link href="/faq" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            FAQ
          </Link>
          <Link href="/leaderboard" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Leaderboard
          </Link>
          <Link href="/about" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            About the Creator
          </Link>
          <Link href="/terms-of-service" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/chat/new" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
