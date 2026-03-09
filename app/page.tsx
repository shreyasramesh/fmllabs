import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function HomePage() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
          <div className="max-w-xl text-center space-y-6">
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground">
              fml labs
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              Improve your decisions through deeper thinking. Our AI coach helps
              you explore consequences, surface mental models and cognitive biases,
              and make better choices.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/chat/new"
                className="px-6 py-3 rounded-xl bg-foreground text-background font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] min-h-[44px] flex items-center justify-center"
              >
                Try it
              </Link>
              <Link
                href="/sign-in"
                className="px-6 py-3 rounded-xl border border-foreground/20 font-medium transition-all duration-200 hover:bg-foreground/5 active:scale-[0.98] min-h-[44px] flex items-center justify-center"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="px-6 py-3 rounded-xl border border-foreground/20 font-medium transition-all duration-200 hover:bg-foreground/5 active:scale-[0.98] min-h-[44px] flex items-center justify-center"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <SignedInRedirect />
      </SignedIn>
    </>
  );
}

function SignedInRedirect() {
  redirect("/chat/new");
  return null;
}
