"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user, isLoaded } = useUser();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const showEmailField = !userEmail;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          type: "feedback",
          ...(showEmailField && { email: email.trim() }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }

      setStatus("success");
      setMessage("");
      setEmail("");
    } catch {
      setErrorMsg("Failed to send message");
      setStatus("error");
    }
  }

  if (!isLoaded) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
        aria-hidden
      >
        <div
          className="pointer-events-auto w-full max-w-md overflow-hidden flex flex-col bg-background rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 animate-fade-in-up"
          role="dialog"
          aria-modal
          aria-labelledby="feedback-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 shrink-0">
            <h2 id="feedback-title" className="text-lg font-semibold text-foreground">
              Send feedback
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 text-neutral-600 dark:text-neutral-400"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            {status === "success" ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Thanks! Your feedback has been sent. We appreciate it.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {showEmailField && (
                  <div>
                    <label htmlFor="feedback-email" className="block text-sm font-medium text-foreground mb-1">
                      Your email
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                    />
                  </div>
                )}
                {!showEmailField && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Sending from {userEmail}
                  </p>
                )}
                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-foreground mb-1">
                    Your feedback
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's on your mind? Suggestions, bugs, or general feedback..."
                    required
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 resize-y"
                  />
                </div>
                {errorMsg && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === "loading" ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
