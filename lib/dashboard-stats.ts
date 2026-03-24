import { getDb } from "./db";
import { decryptMessageFields } from "./crypto-fields";
import type { Message } from "./db";

export interface DashboardStats {
  streakDays: number;
  userWordCount: number;
  sessionCount: number;
  /** Concepts saved from the index into the user's library */
  savedConceptsCount: number;
  /** User-authored custom concepts */
  customConceptsCount: number;
  /** Concept groups / frameworks */
  conceptGroupsCount: number;
  habitsCount: number;
  /** Journal entries (transcripts with source journal) */
  journalEntriesCount: number;
}

/** UTC date key YYYY-MM-DD for streak boundaries (consistent server-side). */
function dateKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseUtcDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function maxDateKey(keys: Iterable<string>): string | null {
  let best: string | null = null;
  for (const k of keys) {
    if (!best || k > best) best = k;
  }
  return best;
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Streak = consecutive calendar days (UTC) ending at the user's most recent active day,
 * where "active" means at least one user message that day.
 */
function streakFromActiveDays(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const startKey = maxDateKey(activeDays);
  if (!startKey) return 0;
  let streak = 0;
  let d = parseUtcDateKey(startKey);
  while (activeDays.has(dateKeyUtc(d))) {
    streak += 1;
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

/**
 * Aggregates dashboard metrics from sessions + user messages.
 * Decrypts message content for word count (matches stored encryption).
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const database = await getDb();

  const [
    sessionCount,
    savedConceptsCount,
    customConceptsCount,
    conceptGroupsCount,
    habitsCount,
    journalEntriesCount,
  ] = await Promise.all([
    database.collection("sessions").countDocuments({ userId }),
    database.collection("user_saved_concepts").countDocuments({ userId }),
    database.collection("custom_concepts").countDocuments({ userId }),
    database.collection("concept_groups").countDocuments({ userId }),
    database.collection("habits").countDocuments({ userId }),
    database.collection("transcripts").countDocuments({ userId, sourceType: "journal" }),
  ]);

  const sessionDocs = await database
    .collection("sessions")
    .find({ userId })
    .project({ _id: 1 })
    .toArray();

  const sessionIds = sessionDocs.map((s) => s._id.toString());
  if (sessionIds.length === 0) {
    return {
      streakDays: 0,
      userWordCount: 0,
      sessionCount,
      savedConceptsCount,
      customConceptsCount,
      conceptGroupsCount,
      habitsCount,
      journalEntriesCount,
    };
  }

  const rawMessages = await database
    .collection<Message>("messages")
    .find({ sessionId: { $in: sessionIds }, role: "user" })
    .project({ content: 1, createdAt: 1, sessionId: 1, role: 1, journalCheckpoint: 1 })
    .toArray();

  const activeDays = new Set<string>();
  let userWordCount = 0;

  for (const raw of rawMessages) {
    const m = decryptMessageFields<Message>({
      ...raw,
      _id: raw._id?.toString(),
    });
    if (typeof m.content === "string") {
      userWordCount += countWords(m.content);
    }
    if (m.createdAt instanceof Date) {
      activeDays.add(dateKeyUtc(m.createdAt));
    }
  }

  const streakDays = streakFromActiveDays(activeDays);

  return {
    streakDays,
    userWordCount,
    sessionCount,
    savedConceptsCount,
    customConceptsCount,
    conceptGroupsCount,
    habitsCount,
    journalEntriesCount,
  };
}
