import Link from "next/link";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "FAQ — fml labs",
  description: `${PRODUCT_TAGLINE} — Frequently asked questions about privacy, encryption, and features`,
};

const sections = [
  { id: "encryption", title: "Encryption & stored data" },
  { id: "privacy", title: "Privacy & third parties" },
  { id: "account-data", title: "Your account & data" },
  { id: "features", title: "Mental models, concepts & chat" },
  { id: "other", title: "Voice, leaderboard & more" },
] as const;

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-8 inline-block"
        >
          ← Back to fml labs
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Frequently asked questions</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Quick answers about security, privacy, and how fml labs works.
        </p>

        <nav
          aria-label="On this page"
          className="mb-10 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-900/40"
        >
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
            On this page
          </p>
          <ul className="space-y-2 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-foreground underline underline-offset-2 hover:no-underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-sm leading-relaxed">
          <section id="encryption" className="scroll-mt-24">
            <h2 className="text-lg font-medium mb-3">Encryption & stored data</h2>

            <h3 className="text-base font-medium mt-6 mb-2">How is my data protected at rest?</h3>
            <p>
              When the service is configured with a server-side encryption key, sensitive fields you save (such as
              chat messages, session titles, custom concepts, long-term memories, transcripts, and similar content)
              are encrypted using <strong>AES-256-GCM</strong> before being written to the database. GCM provides
              authenticated encryption (confidentiality and integrity), so the data is not stored in plain text on
              the database server.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">What is encrypted, and what isn&apos;t?</h3>
            <p>
              We encrypt content that reflects your thinking and writing—messages, summaries, prompts, and related
              user-generated text and structured fields. Basic identifiers needed for the app to work (such as
              account IDs, session IDs, timestamps, and feature flags) are treated as operational metadata and
              typically remain unencrypted so queries and routing remain reliable.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Who can decrypt my data?</h3>
            <p>
              Decryption happens only when the application reads your data on the server to serve your session or
              export your data. Your encryption key is not exposed to the browser for storage encryption. Anyone
              with access to the production database and the deployment secrets could, in principle, decrypt
              ciphertext—so we still rely on <strong>infrastructure security</strong>
              (hosting, access controls, and secrets management) as part of defense in depth.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">What about local development?</h3>
            <p>
              In development or test environments where no encryption key is set, the app may store content in
              plaintext so the project is easy to run. Production deployments should configure encryption keys
              according to the deployment guide.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Will older data be encrypted automatically?</h3>
            <p>
              There is no bulk migration job that rewrites every old document at once. Older rows may remain in
              legacy plaintext until they are updated or re-saved; new reads are written to handle both formats
              safely. If you need a guarantee that all historical data is ciphertext, contact the operator and
              plan a re-save or migration strategy.
            </p>
          </section>

          <section id="privacy" className="scroll-mt-24">
            <h2 className="text-lg font-medium mb-3">Privacy & third parties</h2>

            <h3 className="text-base font-medium mt-6 mb-2">Is my data sold or used for ads?</h3>
            <p>
              fml labs is a personal, non-commercial project. See the{" "}
              <Link href="/privacy-policy" className="underline underline-offset-2 hover:no-underline">
                Privacy Policy
              </Link>{" "}
              for details: data is not sold for advertising or profiling for financial gain.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Which services see my content?</h3>
            <p>
              To run the product, typical integrations include: <strong>Clerk</strong> for sign-in,{" "}
              <strong>Google Gemini</strong> (or similar) for AI responses when you use chat, and{" "}
              <strong>cloud hosting</strong> / <strong>a database</strong> for persistence. Your prompts and
              messages are sent to the AI provider when you use model features so they can generate replies. We
              use providers to operate the service, not to train public models on your data unless their terms say
              otherwise—check their policies for the latest.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Does encryption mean the AI never sees my text?</h3>
            <p>
              No. Encryption protects data <strong>at rest in our database</strong>. When you chat, the
              application still needs to send your message to the model to get a response. Those requests are
              governed by the AI provider&apos;s terms and privacy practices.
            </p>
          </section>

          <section id="account-data" className="scroll-mt-24">
            <h2 className="text-lg font-medium mb-3">Your account & data</h2>

            <h3 className="text-base font-medium mt-6 mb-2">How do I sign in?</h3>
            <p>
              Accounts are handled through Clerk. You can use the email and password or social sign-in options
              configured in the app.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Can I export or delete my data?</h3>
            <p>
              Where the product exposes export, you can download a copy of your data (for example in Markdown
              format). Account deletion or full data wipe may be available from settings or by contacting the
              operator—see the Privacy Policy and in-app options for what&apos;s available today.
            </p>
          </section>

          <section id="features" className="scroll-mt-24">
            <h2 className="text-lg font-medium mb-3">Mental models, concepts & chat</h2>

            <h3 className="text-base font-medium mt-6 mb-2">What is fml labs for?</h3>
            <p className="text-neutral-700 dark:text-neutral-300">
              {PRODUCT_TAGLINE} — The app combines a conversational chat with mental models, custom concepts,
              long-term memory, perspective cards, and related tools to help you think more clearly over time.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">What are mental models and frameworks?</h3>
            <p>
              <strong>Mental models</strong> are cognitive tools (e.g. biases, frameworks) drawn from the built-in
              library. You can also create <strong>custom concepts</strong> and organize them into{" "}
              <strong>concept frameworks</strong> (groups) to match how you think about a topic.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">What gets saved in a chat session?</h3>
            <p>
              Messages and session metadata you see in the UI are persisted so you can return to them and so
              features like long-term memory and summaries can work. Treat the chat as private to your account, not
              as anonymous.
            </p>
          </section>

          <section id="other" className="scroll-mt-24">
            <h2 className="text-lg font-medium mb-3">Voice, leaderboard & more</h2>

            <h3 className="text-base font-medium mt-6 mb-2">Text-to-speech and voice</h3>
            <p>
              Optional voice features may use third-party TTS (e.g. ElevenLabs). Only voice identifiers and
              settings needed to play audio are stored—your voice clone settings are treated as sensitive where
              applicable.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">Leaderboard</h3>
            <p>
              If you opt in in settings, you may appear on a leaderboard with your display name and XP. You can opt
              out at any time.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">PWA install</h3>
            <p>
              You can install the app on supported browsers for a more app-like experience. The same privacy and
              security terms apply.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2">More questions?</h3>
            <p>
              For legal terms, see the{" "}
              <Link href="/terms-of-service" className="underline underline-offset-2 hover:no-underline">
                Terms of Service
              </Link>
              . For the mission behind the project, see{" "}
              <Link href="/mission" className="underline underline-offset-2 hover:no-underline">
                The Mission of fml labs
              </Link>
              . For policy questions, contact{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="underline underline-offset-2 hover:no-underline">
                shreyas.ramesh@gmail.com
              </a>{" "}
              (also listed in the Privacy Policy).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About the Creator
          </Link>
          <Link href="/mission" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Mission
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
