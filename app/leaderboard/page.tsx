import { LeaderboardSection } from "@/components/LeaderboardSection";

export const metadata = {
  title: "Leaderboard — FigureMyLife Labs",
  description: "Top learners by XP. Compete with others and climb the leaderboard.",
};

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LeaderboardSection showBackLink showFooterLinks />
    </div>
  );
}
