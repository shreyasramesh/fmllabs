/**
 * Resolves how the assistant should address the user: saved preference, then Clerk profile.
 */
export function resolveUserDisplayNameForPrompt(args: {
  preferredName?: string | null;
  clerkFirstName?: string | null;
  clerkFullName?: string | null;
}): string | null {
  const pref = args.preferredName?.trim();
  if (pref) return pref.slice(0, 80);
  const first = args.clerkFirstName?.trim();
  if (first) return first.slice(0, 80);
  const full = args.clerkFullName?.trim();
  if (full) {
    const token = full.split(/\s+/)[0];
    if (token) return token.slice(0, 80);
  }
  return null;
}

/** Appended to system prompts so replies can use the user's name naturally. */
export function buildUserPreferredNamePromptSuffix(displayName: string | null): string {
  if (!displayName?.trim()) return "";
  const safe = displayName.replace(/[\r\n]/g, " ").trim().slice(0, 80);
  if (!safe) return "";
  return `\n\nUSER NAME: The person you're talking to goes by "${safe}". **Do not** use their name in every reply—most turns should not include it. Use it only when it genuinely fits: e.g. a warm emphasis, reassurance, a clear direct address, or a natural beat—not as a habit or filler. When in doubt, skip the name and keep the tone human.`;
}
