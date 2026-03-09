import Link from "next/link";

export const metadata = {
  title: "The Mission of fml labs — fml labs",
  description: "The mission and purpose of fml labs",
};

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-8 inline-block"
        >
          ← Back to fml labs
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-2">The Mission of fml labs</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base">
            This site is a <strong>personal research project</strong> and <strong>technical demonstration</strong>. It serves as a playground for Shreyas to combine cutting-edge AI research with robust cloud infrastructure expertise to explore complex, real-world reasoning challenges.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-base">
            <strong>fml labs</strong> is entirely non-commercial and is maintained solely for the purpose of showcasing experimental AI engineering techniques and personal skill development.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About the Creator
          </Link>
          <Link href="/terms-of-service" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            ← Back to fml labs
          </Link>
        </div>
      </div>
    </div>
  );
}
