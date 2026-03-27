import { NextResponse } from "next/server";
import {
  claimWeeklyReflectionSend,
  getSavedTranscripts,
  getUserSettings,
  listKnownUserIds,
  markWeeklyReflectionSendStatus,
} from "@/lib/db";
import { generateWeeklyJournalReflection } from "@/lib/gemini";
import { sendEmail } from "@/lib/mail";
import {
  buildWeeklyReflectionAggregate,
  getCurrentWeekWindow,
  isSundayTenAmInTimeZone,
  WEEKLY_REFLECTION_TIMEZONE,
} from "@/lib/weekly-reflection";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authHeader === `Bearer ${expected}`) return true;
  const cronHeader = request.headers.get("x-cron-secret")?.trim() ?? "";
  return cronHeader === expected;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getClerkPrimaryEmail(userId: string): Promise<string | null> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    primary_email_address_id?: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
  };
  if (!Array.isArray(payload.email_addresses) || payload.email_addresses.length === 0) return null;
  const primary =
    payload.email_addresses.find((item) => item.id === payload.primary_email_address_id) ??
    payload.email_addresses[0];
  const email = primary?.email_address?.trim();
  return email || null;
}

function buildWeeklyReflectionEmailHtml(args: {
  preferredName?: string;
  weekLabel: string;
  summary: string;
  emotionPatterns: string[];
  behaviorPatterns: string[];
  mentorInsights: string[];
  nextWeekActions: string[];
  journalCount: number;
}): string {
  const greetingName = args.preferredName?.trim() || "there";
  const bulletList = (items: string[]) =>
    items.length > 0
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p>None captured this week.</p>`;
  return `
    <div style="font-family: Inter, system-ui, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Weekly Reflection</h2>
      <p style="margin-top: 0;">Hi ${escapeHtml(greetingName)}, here is your reflection for <strong>${escapeHtml(
    args.weekLabel
  )}</strong>.</p>
      <p><strong>Journal entries this week:</strong> ${args.journalCount}</p>
      <h3>Summary</h3>
      <p>${escapeHtml(args.summary)}</p>
      <h3>Emotion Patterns</h3>
      ${bulletList(args.emotionPatterns)}
      <h3>Behavior Patterns</h3>
      ${bulletList(args.behaviorPatterns)}
      <h3>Followed Mentor Insights</h3>
      ${bulletList(args.mentorInsights)}
      <h3>Next Week Actions</h3>
      ${bulletList(args.nextWeekActions)}
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">Sent by FigureMyLife Labs weekly reflections.</p>
    </div>
  `;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  const weekWindow = getCurrentWeekWindow(now, WEEKLY_REFLECTION_TIMEZONE);
  if (!force && !isSundayTenAmInTimeZone(now, WEEKLY_REFLECTION_TIMEZONE)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Outside scheduled run window",
      timeZone: WEEKLY_REFLECTION_TIMEZONE,
      now: now.toISOString(),
    });
  }

  const userIds = await listKnownUserIds();
  const metrics = {
    usersScanned: 0,
    sent: 0,
    skippedDuplicate: 0,
    skippedNoEmail: 0,
    failed: 0,
  };

  for (const userId of userIds) {
    metrics.usersScanned += 1;
    try {
      const claimed = await claimWeeklyReflectionSend(userId, weekWindow.weekKey);
      if (!claimed) {
        metrics.skippedDuplicate += 1;
        continue;
      }

      const email = await getClerkPrimaryEmail(userId);
      if (!email) {
        metrics.skippedNoEmail += 1;
        await markWeeklyReflectionSendStatus(userId, weekWindow.weekKey, "failed", {
          error: "No email found",
        });
        continue;
      }

      const [settings, transcripts] = await Promise.all([
        getUserSettings(userId),
        getSavedTranscripts(userId),
      ]);
      const aggregate = buildWeeklyReflectionAggregate({
        transcripts,
        followedFigureIds: settings?.followedFigureIds ?? [],
        now,
        timeZone: WEEKLY_REFLECTION_TIMEZONE,
      });
      const weekLabel = `${aggregate.weekStartLabel} - ${aggregate.weekEndLabel}`;
      const reflection = await generateWeeklyJournalReflection(
        {
          weekLabel,
          journalEntries: aggregate.journalEntries.map((entry) => ({
            dayKey: entry.dayKey,
            text: entry.text,
          })),
          emotionSignals: aggregate.emotionSignals,
          behaviorSignals: aggregate.behaviorSignals,
          followedMentorReflections: aggregate.followedMentorReflections.map((item) => ({
            figureName: item.figureName,
            reflection: item.reflection,
            dayKey: item.dayKey,
          })),
        },
        { userId, eventType: "weekly_reflection_email" }
      );

      const html = buildWeeklyReflectionEmailHtml({
        preferredName: settings?.preferredName,
        weekLabel,
        summary: reflection.summary,
        emotionPatterns: reflection.emotionPatterns,
        behaviorPatterns: reflection.behaviorPatterns,
        mentorInsights: reflection.mentorInsights,
        nextWeekActions: reflection.nextWeekActions,
        journalCount: aggregate.journalEntries.length,
      });
      const mail = await sendEmail({
        to: [email],
        subject: `Your weekly reflection (${weekLabel})`,
        html,
      });

      await markWeeklyReflectionSendStatus(userId, weekWindow.weekKey, "sent", {
        emailId: mail.id,
      });
      metrics.sent += 1;
    } catch (err) {
      metrics.failed += 1;
      await markWeeklyReflectionSendStatus(userId, weekWindow.weekKey, "failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      console.error("Weekly reflection send failed:", { userId, err });
    }
  }

  return NextResponse.json({
    ok: true,
    weekKey: weekWindow.weekKey,
    weekStart: weekWindow.weekStartDayKey,
    weekEnd: weekWindow.weekEndDayKey,
    timeZone: WEEKLY_REFLECTION_TIMEZONE,
    metrics,
  });
}
