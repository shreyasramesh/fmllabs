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
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] dark:bg-[#141413] dark:text-[#faf9f5]">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] mb-8 inline-block transition-colors"
        >
          ← Back to fml labs
        </Link>

        <h1 className="font-serif text-3xl font-medium leading-tight text-[#141413] dark:text-[#faf9f5] md:text-4xl mb-3">Frequently asked questions</h1>
        <p className="text-base text-[#5e5d59] dark:text-[#87867f] mb-8 leading-relaxed">
          Quick answers about security, privacy, and how fml labs works.
        </p>

        <nav
          aria-label="On this page"
          className="mb-10 p-5 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] shadow-[rgba(0,0,0,0.05)_0px_4px_24px] dark:border-[#3d3d3a] dark:bg-[#30302e]"
        >
          <p className="text-[10px] font-medium text-[#87867f] uppercase tracking-[0.5px] mb-3">
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

        <div className="max-w-none space-y-10 text-base leading-[1.6] text-[#4d4c48] dark:text-[#b0aea5]">
          <section id="encryption" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-4 text-[#141413] dark:text-[#faf9f5]">Encryption & stored data</h2>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">How is my data protected at rest?</h3>
            <p>
              When the service is configured with a server-side encryption key, sensitive fields you save (such as
              chat messages, session titles, custom concepts, long-term memories, transcripts, and similar content)
              are encrypted using <strong>AES-256-GCM</strong> before being written to the database. GCM provides
              authenticated encryption (confidentiality and integrity), so the data is not stored in plain text on
              the database server.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">What is encrypted, and what isn&apos;t?</h3>
            <p>
              We encrypt content that reflects your thinking and writing—messages, summaries, prompts, and related
              user-generated text and structured fields. Basic identifiers needed for the app to work (such as
              account IDs, session IDs, timestamps, and feature flags) are treated as operational metadata and
              typically remain unencrypted so queries and routing remain reliable.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Who can decrypt my data?</h3>
            <p>
              Decryption happens only when the application reads your data on the server to serve your session or
              export your data. Your encryption key is not exposed to the browser for storage encryption. Anyone
              with access to the production database and the deployment secrets could, in principle, decrypt
              ciphertext—so we still rely on <strong>infrastructure security</strong>
              (hosting, access controls, and secrets management) as part of defense in depth.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">What about local development?</h3>
            <p>
              In development or test environments where no encryption key is set, the app may store content in
              plaintext so the project is easy to run. Production deployments should configure encryption keys
              according to the deployment guide.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Will older data be encrypted automatically?</h3>
            <p>
              There is no bulk migration job that rewrites every old document at once. Older rows may remain in
              legacy plaintext until they are updated or re-saved; new reads are written to handle both formats
              safely. If you need a guarantee that all historical data is ciphertext, contact the operator and
              plan a re-save or migration strategy.
            </p>
          </section>

          <section id="privacy" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-4 text-[#141413] dark:text-[#faf9f5]">Privacy & third parties</h2>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Is my data sold or used for ads?</h3>
            <p>
              fml labs is a personal, non-commercial project. See the{" "}
              <Link href="/privacy-policy" className="text-[#c96442] underline underline-offset-2 hover:no-underline dark:text-[#d97757]">
                Privacy Policy
              </Link>{" "}
              for details: data is not sold for advertising or profiling for financial gain.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Which services see my content?</h3>
            <p>
              To run the product, typical integrations include: <strong>Clerk</strong> for sign-in,{" "}
              <strong>Google Gemini</strong> (or similar) for AI responses when you use chat, and{" "}
              <strong>cloud hosting</strong> / <strong>a database</strong> for persistence. Your prompts and
              messages are sent to the AI provider when you use model features so they can generate replies. We
              use providers to operate the service, not to train public models on your data unless their terms say
              otherwise—check their policies for the latest.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Does encryption mean the AI never sees my text?</h3>
            <p>
              No. Encryption protects data <strong>at rest in our database</strong>. When you chat, the
              application still needs to send your message to the model to get a response. Those requests are
              governed by the AI provider&apos;s terms and privacy practices.
            </p>
          </section>

          <section id="account-data" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-4 text-[#141413] dark:text-[#faf9f5]">Your account & data</h2>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">How do I sign in?</h3>
            <p>
              Accounts are handled through Clerk. You can use the email and password or social sign-in options
              configured in the app.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Can I export or delete my data?</h3>
            <p>
              Where the product exposes export, you can download a copy of your data (for example in Markdown
              format). Account deletion or full data wipe may be available from settings or by contacting the
              operator—see the Privacy Policy and in-app options for what&apos;s available today.
            </p>
          </section>

          <section id="features" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-4 text-[#141413] dark:text-[#faf9f5]">Mental models, concepts & chat</h2>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">What is fml labs for?</h3>
            <p className="text-[#4d4c48] dark:text-[#b0aea5]">
              {PRODUCT_TAGLINE} — The app combines a conversational chat with mental models, custom concepts,
              long-term memory, perspective cards, and related tools to help you think more clearly over time.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">What are mental models and frameworks?</h3>
            <p>
              <strong>Mental models</strong> are cognitive tools (e.g. biases, frameworks) drawn from the built-in
              library. You can also create <strong>custom concepts</strong> and organize them into{" "}
              <strong>concept frameworks</strong> (groups) to match how you think about a topic.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">What gets saved in a chat session?</h3>
            <p>
              Messages and session metadata you see in the UI are persisted so you can return to them and so
              features like long-term memory and summaries can work. Treat the chat as private to your account, not
              as anonymous.
            </p>
          </section>

          <section id="other" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-4 text-[#141413] dark:text-[#faf9f5]">Voice, leaderboard & more</h2>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Text-to-speech and voice</h3>
            <p>
              Optional voice features may use third-party TTS (e.g. ElevenLabs). Only voice identifiers and
              settings needed to play audio are stored—your voice clone settings are treated as sensitive where
              applicable.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">Leaderboard</h3>
            <p>
              If you opt in in settings, you may appear on a leaderboard with your display name and XP. You can opt
              out at any time.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">PWA install</h3>
            <p>
              You can install the app on supported browsers for a more app-like experience. The same privacy and
              security terms apply.
            </p>

            <h3 className="text-base font-medium mt-6 mb-2 text-[#141413] dark:text-[#faf9f5]">More questions?</h3>
            <p>
              For legal terms, see the{" "}
              <Link href="/terms-of-service" className="text-[#c96442] underline underline-offset-2 hover:no-underline dark:text-[#d97757]">
                Terms of Service
              </Link>
              . For the mission behind the project, see{" "}
              <Link href="/mission" className="text-[#c96442] underline underline-offset-2 hover:no-underline dark:text-[#d97757]">
                The Mission of fml labs
              </Link>
              . For policy questions, contact{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="text-[#c96442] underline underline-offset-2 hover:no-underline dark:text-[#d97757]">
                shreyas.ramesh@gmail.com
              </a>{" "}
              (also listed in the Privacy Policy).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#e8e6dc] dark:border-[#30302e] flex flex-wrap gap-4">
          <Link href="/about" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            About the Creator
          </Link>
          <Link href="/mission" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Mission
          </Link>
          <Link href="/terms-of-service" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            ← Back to fml labs
          </Link>
        </div>
      </div>
    </div>
  );
}
