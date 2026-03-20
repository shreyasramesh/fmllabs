import { LeaderboardSection } from "@/components/LeaderboardSection";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "Leaderboard — FigureMyLife Labs",
  description: `${PRODUCT_TAGLINE} — Top learners by XP. Climb the leaderboard.`,
};

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LeaderboardSection showBackLink showFooterLinks />
    </div>
  );
}
