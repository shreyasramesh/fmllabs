"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

export function ContactForm() {
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
    <section className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
      <h2 className="text-lg font-medium mb-4">Contact Me</h2>
      {status === "success" ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Thanks! Your message has been sent. I&apos;ll get back to you soon.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {showEmailField && (
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1">
                Your email
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                <Link href="/sign-in" className="underline hover:no-underline">
                  Sign in
                </Link>{" "}
                to use your account email instead.
              </p>
            </div>
          )}
          {!showEmailField && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Sending from {userEmail}
            </p>
          )}
          <div>
            <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1">
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              required
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 resize-y"
            />
          </div>
          {errorMsg && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </section>
  );
}
