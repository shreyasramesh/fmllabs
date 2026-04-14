"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Skeleton } from "boneyard-js/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommonplaceEntry {
  _id: string;
  transcriptText: string;
  quoteSource?: string;
  quoteAuthor?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildAttribution(entry: CommonplaceEntry): string {
  const parts: string[] = [];
  if (entry.quoteAuthor) parts.push(entry.quoteAuthor);
  if (entry.quoteSource) parts.push(entry.quoteSource);
  return parts.length ? `— ${parts.join(", ")}` : "";
}

// ─── Fixture: shown to boneyard CLI to snapshot real list layout ───────────────

function CommonplaceFixture() {
  return (
    <div>
      {[{ w1: "w-3/4", w2: "w-1/2" }, { w1: "w-5/6", w2: "w-2/5" }, { w1: "w-2/3", w2: "w-1/3" }].map((row, i) => (
        <div key={i} className="border-b border-[#e8e6dc] py-4 dark:border-white/[.08]">
          <div className={`mb-2 h-5 ${row.w1} rounded bg-[#e8e6dc] dark:bg-[#3d3d3a]`} />
          <div className={`mb-1 h-4 ${row.w2} rounded bg-[#e8e6dc] dark:bg-[#3d3d3a]`} />
          <div className="h-3 w-1/4 rounded bg-[#f0eee6] dark:bg-[#30302e]" />
        </div>
      ))}
    </div>
  );
}

// ─── Single quote row ─────────────────────────────────────────────────────────

interface QuoteRowProps {
  entry: CommonplaceEntry;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, text: string, source: string, author: string) => Promise<void>;
}

function QuoteRow({ entry, onDelete, onSaveEdit }: QuoteRowProps) {
  // Swipe-to-delete state (latch-open pattern)
  const touchStartXRef = useRef<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [latchOpen, setLatchOpen] = useState(false);
  const SWIPE_THRESHOLD = 80;
  const LATCH_X = -SWIPE_THRESHOLD;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const dx = (e.touches[0]?.clientX ?? 0) - touchStartXRef.current;
    if (latchOpen) {
      const next = LATCH_X + dx;
      if (next <= 0) setSwipeX(Math.max(next, LATCH_X - 20));
    } else {
      if (dx < 0) setSwipeX(Math.max(dx, LATCH_X - 20));
    }
  };
  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    if (latchOpen) {
      if (swipeX > LATCH_X / 2) {
        setSwipeX(0);
        setLatchOpen(false);
      } else {
        setSwipeX(LATCH_X);
      }
    } else {
      if (swipeX <= -SWIPE_THRESHOLD) {
        setSwipeX(LATCH_X);
        setLatchOpen(true);
      } else {
        setSwipeX(0);
      }
    }
  };
  const handleSwipeDelete = () => {
    setSwipeX(0);
    setLatchOpen(false);
    onDelete(entry._id);
  };

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.transcriptText);
  const [editSource, setEditSource] = useState(entry.quoteSource ?? "");
  const [editAuthor, setEditAuthor] = useState(entry.quoteAuthor ?? "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditText(entry.transcriptText);
    setEditSource(entry.quoteSource ?? "");
    setEditAuthor(entry.quoteAuthor ?? "");
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = async () => {
    const t = editText.trim();
    const s = editSource.trim();
    if (!t || !s) return;
    setSaving(true);
    try {
      await onSaveEdit(entry._id, t, s, editAuthor.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const attribution = buildAttribution(entry);
  const swipeProgress = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);

  if (editing) {
    return (
      <div className="border-b border-neutral-200 py-3 dark:border-white/[.10]">
        <textarea
          className="mb-2 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-snug text-neutral-900 outline-none focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          rows={4}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          autoFocus
        />
        <input
          className="mb-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          placeholder="Source (book, film, podcast…)"
          value={editSource}
          onChange={(e) => setEditSource(e.target.value)}
        />
        <input
          className="mb-2.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          placeholder="Author (optional)"
          value={editAuthor}
          onChange={(e) => setEditAuthor(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || !editText.trim() || !editSource.trim()}
            onClick={() => void saveEdit()}
            className="rounded-lg border border-[#c96442] px-4 py-1.5 text-xs font-medium text-[#c96442] transition-colors hover:bg-[#f5f4ed] disabled:opacity-40 dark:text-[#d97757] dark:hover:bg-[#30302e]"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete affordance (revealed by swipe) */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        style={{ opacity: latchOpen ? 1 : swipeProgress }}
        aria-hidden
      >
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-transform ${latchOpen ? "pointer-events-auto scale-100" : "scale-90"}`}
          tabIndex={latchOpen ? 0 : -1}
          onClick={latchOpen ? handleSwipeDelete : undefined}
          aria-label="Delete entry"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Row content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex items-start gap-2 border-b border-neutral-200 py-3.5 dark:border-white/[.10]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: (swipeX === 0 || latchOpen) ? "transform 0.2s ease" : "none",
        }}
      >
        {/* Quote body */}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-[#141413] dark:text-[#faf9f5]">
            {entry.transcriptText}
          </p>
          {attribution ? (
            <p className="mt-1 text-xs text-[#87867f] dark:text-[#5e5d59]">{attribution}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-[#87867f] dark:text-[#5e5d59]">
            {formatDate(entry.createdAt)}
          </p>
        </div>

        {/* Actions (desktop-visible always; hidden on mobile unless you tap) */}
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {/* Edit */}
          <button
            type="button"
            onClick={startEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-[#e8e6dc] hover:text-[#141413] dark:hover:bg-[#3d3d3a] dark:hover:text-[#faf9f5]"
            aria-label="Edit entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
            </svg>
          </button>
          {/* Delete (desktop only — mobile uses swipe) */}
          <button
            type="button"
            onClick={() => onDelete(entry._id)}
            className="hidden h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:flex dark:hover:bg-[#3d3d3a] dark:hover:text-red-400"
            aria-label="Delete entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add-entry form ───────────────────────────────────────────────────────────

interface AddEntryFormProps {
  onAdd: (text: string, source: string, author: string) => Promise<void>;
}

function AddEntryForm({ onAdd }: AddEntryFormProps) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const t = text.trim();
    const s = source.trim();
    if (!t || !s) return;
    setSaving(true);
    try {
      await onAdd(t, s, author.trim());
      setText("");
      setSource("");
      setAuthor("");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSave();
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#87867f] dark:text-[#5e5d59]">
        Add a quote
      </p>
      <textarea
        className="mb-2 w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-snug text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        rows={3}
        placeholder="Enter a quote or passage…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        className="mb-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        placeholder="Source — book, film, podcast, article…"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <input
        className="mb-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#c96442] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        placeholder="Author (optional)"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <button
        type="button"
        disabled={saving || !text.trim() || !source.trim()}
        onClick={() => void handleSave()}
        className="rounded-lg border border-[#c96442] px-5 py-1.5 text-sm font-medium text-[#c96442] transition-colors hover:bg-[#f5f4ed] disabled:opacity-40 dark:text-[#d97757] dark:hover:bg-[#30302e]"
      >
        {saving ? "Saving…" : "Save entry"}
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <p className="text-sm font-medium text-[#87867f] dark:text-[#5e5d59]">Your commonplace book is empty</p>
      <p className="mt-1 max-w-[220px] text-xs text-[#87867f] dark:text-[#5e5d59]">
        Start adding quotes and passages from books, films, or anywhere wisdom finds you.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingMobileCommonplaceTab() {
  const [entries, setEntries] = useState<CommonplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/me/commonplace");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as CommonplaceEntry[];
      setEntries(data);
    } catch {
      setError("Could not load your commonplace book. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchEntries();
  }, [fetchEntries]);

  const handleAdd = useCallback(async (text: string, source: string, author: string) => {
    const res = await fetch("/api/me/commonplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, author: author || undefined }),
    });
    if (!res.ok) throw new Error("Failed to save");
    const created = (await res.json()) as CommonplaceEntry;
    setEntries((prev) => [created, ...prev]);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic removal
    setEntries((prev) => prev.filter((e) => e._id !== id));
    const res = await fetch("/api/me/commonplace", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      // Revert on failure
      void fetchEntries();
    }
  }, [fetchEntries]);

  const handleSaveEdit = useCallback(async (id: string, text: string, source: string, author: string) => {
    const res = await fetch("/api/me/commonplace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text, source, author: author || "" }),
    });
    if (!res.ok) throw new Error("Failed to update");
    setEntries((prev) =>
      prev.map((e) =>
        e._id === id
          ? { ...e, transcriptText: text, quoteSource: source, quoteAuthor: author || undefined }
          : e
      )
    );
  }, []);

  return (
    <div className="flex min-h-0 w-full flex-col px-3 sm:px-4">
      {/* Header */}
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#141413] dark:text-[#faf9f5]">
          Commonplace Book
        </h2>
        {!loading && entries.length > 0 && (
          <span className="text-xs text-[#87867f] dark:text-[#5e5d59]">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <AddEntryForm onAdd={handleAdd} />

      {error ? (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <Skeleton name="commonplace-list" loading={loading} fixture={<CommonplaceFixture />}>
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {entries.map((entry) => (
              <QuoteRow
                key={entry._id}
                entry={entry}
                onDelete={(id) => void handleDelete(id)}
                onSaveEdit={handleSaveEdit}
              />
            ))}
          </div>
        )}
      </Skeleton>
    </div>
  );
}
