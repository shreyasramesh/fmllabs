import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeaderboardSection } from "@/components/LeaderboardSection";

export const metadata = {
  title: "FigureMyLife Labs",
  description:
    "Improve your decisions through deeper thinking. Surface mental models and cognitive biases.",
};

async function LandingContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              FigureMyLife Labs
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Improve your decisions through deeper thinking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border-2 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
            >
              Sign up
            </Link>
            <Link
              href="/chat/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
            >
              Continue to chat →
            </Link>
          </div>
        </div>

        <LeaderboardSection compact />

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/leaderboard" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Full leaderboard
          </Link>
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About
          </Link>
          <Link href="/mission" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Mission
          </Link>
        </div>
      </div>
    </div>
  );
}

function SignedInRedirect() {
  redirect("/chat/new");
  return null;
}

export default function HomePage() {
  return (
    <>
      <SignedOut>
        <LandingContent />
      </SignedOut>
      <SignedIn>
        <SignedInRedirect />
      </SignedIn>
    </>
  );
}
