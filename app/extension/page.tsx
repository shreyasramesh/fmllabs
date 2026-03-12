import Link from "next/link";
import { ChromeIcon } from "@/components/ChromeIcon";

export default function ExtensionComingSoonPage() {
  return (
    <main className="min-h-[100dvh] bg-[#fff7ee] text-[#2b1b12]">
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-3xl border border-[#f1dcc5] bg-gradient-to-b from-[#fffaf4] to-[#fff2e6] px-6 py-10 sm:px-10 sm:py-14 text-center shadow-[0_12px_40px_rgba(194,108,45,0.12)]">
          <span className="inline-flex items-center rounded-full border border-[#f2c89d] bg-[#fff1df] px-3 py-1 text-xs font-semibold tracking-wide uppercase text-[#9b5a26]">
            Coming Soon
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#3b2315]">
            FML Labs Extension
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#6f4630] max-w-2xl mx-auto leading-relaxed">
            Save nuggets from any page, extract concepts from YouTube, and keep
            your thinking synced with the FML app.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#e7a86c] bg-[#ef8f38] px-7 py-3 text-base font-semibold text-[#fff8ef] shadow-sm"
            >
              <ChromeIcon className="w-5 h-5" />
              Install Extension
            </button>
            <Link
              href="/chat/new"
              className="inline-flex items-center rounded-full border border-[#e9d4bc] bg-white/70 px-6 py-3 text-sm font-medium text-[#734429] hover:bg-white transition-colors"
            >
              Back to app
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-3xl border border-[#f1dcc5] bg-white/70 p-6 sm:p-8">
          <h2 className="text-3xl font-semibold text-center text-[#3b2315]">
            How It Works
          </h2>
          <p className="mt-2 text-center text-sm text-[#7a4d34]">
            A simple flow designed to fit directly into your research workflow.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#f0decb] bg-[#fff9f3] p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f59e42] text-[#fff8ef]">
                <ChromeIcon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#3b2315]">Install</h3>
              <p className="mt-2 text-sm text-[#744a31]">
                Add it to Chrome and sign in once with your existing FML account.
              </p>
            </article>

            <article className="rounded-2xl border border-[#f0decb] bg-[#fff9f3] p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f59e42] text-[#fff8ef]">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 12 4 4L19 6" />
                  <path d="M6 19h12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#3b2315]">Capture</h3>
              <p className="mt-2 text-sm text-[#744a31]">
                Highlight text to save nuggets, create concepts, or start focused
                chats.
              </p>
            </article>

            <article className="rounded-2xl border border-[#f0decb] bg-[#fff9f3] p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f59e42] text-[#fff8ef]">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#3b2315]">Apply</h3>
              <p className="mt-2 text-sm text-[#744a31]">
                Everything stays synced with your web app so your ideas are always
                in one place.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

