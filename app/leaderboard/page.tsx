import { LeaderboardSection } from "@/components/LeaderboardSection";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "Leaderboard — FixMyLife Labs",
  description: `${PRODUCT_TAGLINE} — Top learners by XP. Climb the leaderboard.`,
};

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] dark:bg-[#141413] dark:text-[#faf9f5]">
      <LeaderboardSection showBackLink showFooterLinks />
    </div>
  );
}
