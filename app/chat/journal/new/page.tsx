"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/components/LanguageProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getLandingTranslations } from "@/lib/landing-translations";

function getTodayDateInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function JournalNewPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const { language } = useLanguage();
  const t = getLandingTranslations(language);

  const [entryDate, setEntryDate] = useState(() => getTodayDateInputValue());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body,
          ...(entryDate.trim() ? { entryDate: entryDate.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "save failed");
      }
      router.push("/chat/new?journalSaved=1");
    } catch {
      setError(t.journalEntrySaveError);
    } finally {
      setSaving(false);
    }
  }, [text, entryDate, router, t.journalEntrySaveError]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/chat/new"
            className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors shrink-0"
          >
            ← {t.journalEntryBack}
          </Link>
          <h1 className="text-lg font-semibold truncate">{t.journalEntryModalTitle}</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 min-h-0 flex flex-col max-w-2xl w-full mx-auto px-4 py-6">
        {!isLoaded ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !userId ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.journalEntrySignInPrompt}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent("/chat/journal/new")}`}
                className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90"
              >
                Sign in
              </Link>
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent("/chat/journal/new")}`}
                className="inline-flex px-4 py-2 rounded-xl text-sm font-medium border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Create account
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t.journalEntryModalSubtitle}</p>
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  {t.journalEntryDateHint}
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  disabled={saving}
                  className="w-full max-w-xs px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-background text-sm"
                />
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.journalEntryBodyPlaceholder}
                disabled={saving}
                rows={14}
                className="w-full flex-1 min-h-[200px] px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-background text-sm resize-y"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Link
                  href="/chat/new"
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t.journalEntryCancel}
                </Link>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !text.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {t.journalEntrySave}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
