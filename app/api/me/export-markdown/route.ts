import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getDb,
  type ConceptGroup,
  type CustomConcept,
  type Habit,
  type LongTermMemory,
  type Message,
  type SavedPerspectiveCard,
  type SavedConcept,
  type SavedTranscript,
  type Session,
  type UserMentalModel,
  type UserSettings,
} from "@/lib/db";
import {
  decryptConceptGroupFields,
  decryptCustomConceptFields,
  decryptHabitFields,
  decryptLongTermMemoryFields,
  decryptMessageFields,
  decryptSavedPerspectiveCardFields,
  decryptSavedConceptFields,
  decryptSessionFields,
  decryptTranscriptFields,
  decryptUserMentalModelFields,
  decryptUserSettingsFields,
} from "@/lib/crypto-fields";
import { getOneLiner, loadMentalModelContent } from "@/lib/mental-models";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

type ExportSection =
  | "settings"
  | "sessions"
  | "messages"
  | "long_term_memory"
  | "custom_concepts"
  | "concept_groups"
  | "habits"
  | "transcripts"
  | "saved_perspective_cards"
  | "saved_mental_models";

const ALL_SECTIONS: ExportSection[] = [
  "settings",
  "sessions",
  "messages",
  "long_term_memory",
  "custom_concepts",
  "concept_groups",
  "habits",
  "transcripts",
  "saved_perspective_cards",
  "saved_mental_models",
];

function toMarkdownTable(
  headers: string[],
  rows: Array<Array<string | number | undefined | null>>
): string {
  if (rows.length === 0) return "_No data._";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${r.map((v) => String(v ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body?.sections) ? body.sections : ALL_SECTIONS;
    const sections = requested.filter((s: unknown): s is ExportSection =>
      typeof s === "string" && ALL_SECTIONS.includes(s as ExportSection)
    );

    const db = await getDb();
    const now = new Date();
    const lines: string[] = [];
    lines.push("# FixMyLife Labs Data Export");
    lines.push("");
    lines.push(`- **Generated:** ${now.toISOString()}`);
    lines.push(`- **User ID:** ${userId}`);
    lines.push("");

    const sessionsRaw =
      sections.includes("sessions") || sections.includes("messages")
        ? await db.collection("sessions").find({ userId }).sort({ updatedAt: -1 }).toArray()
        : [];
    const sessions = sessionsRaw.map((s) =>
      decryptSessionFields<Session & { _id: string }>({
        ...s,
        _id: s._id?.toString() ?? "",
      })
    );

    if (sections.includes("settings")) {
      const settingsDoc = await db.collection("user_settings").findOne({ userId });
      const settings = settingsDoc
        ? decryptUserSettingsFields<UserSettings>(settingsDoc)
        : null;
      lines.push("## Settings");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(settings ?? {}, null, 2));
      lines.push("```");
      lines.push("");
    }

    if (sections.includes("sessions")) {
      lines.push("## Sessions");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["Session ID", "Title", "Created", "Updated", "Tags", "Mode", "Figure", "Second-order", "Converted to deep"],
          sessions.map((s) => [
            s._id?.toString(),
            s.title,
            s.createdAt ? new Date(s.createdAt).toISOString() : "",
            s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
            Array.isArray(s.mentalModelTags) ? s.mentalModelTags.join(", ") : "",
            s.perspectiveCardPrompt
              ? "perspective_card"
              : s.oneOnOneMentorFigureId
                ? "mentor_1_on_1"
                : s.secondOrderThinking
                  ? "second_order"
                  : "standard",
            s.oneOnOneMentorFigureName || s.perspectiveCardFigureName || "",
            s.secondOrderThinking
              ? s.secondOrderPlain === false
                ? "on (with citations)"
                : "on (plain)"
              : "off",
            s.convertedToDeepConversation ? "yes" : "no",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("messages")) {
      const sessionIds = sessions.map((s) => s._id?.toString()).filter(Boolean);
      const messagesRaw =
        sessionIds.length > 0
          ? await db
              .collection("messages")
              .find({ sessionId: { $in: sessionIds } })
              .sort({ createdAt: 1 })
              .toArray()
          : [];
      const messages = messagesRaw.map((m) =>
        decryptMessageFields<Message & { _id?: string }>({ ...m, _id: m._id?.toString() })
      );
      lines.push("## Messages");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["Session ID", "Role", "Created", "Content"],
          messages.map((m) => [
            m.sessionId,
            m.role,
            m.createdAt ? new Date(m.createdAt).toISOString() : "",
            typeof m.content === "string" ? m.content.replace(/\n/g, " ") : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("long_term_memory")) {
      const memoriesRaw = await db
        .collection("long_term_memory")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const memories = memoriesRaw.map((m) =>
        decryptLongTermMemoryFields<LongTermMemory & { _id: string }>({ ...m, _id: m._id?.toString() })
      );
      lines.push("## Memory");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Title", "Summary", "Enrichment Prompt", "Updated"],
          memories.map((m) => [
            m._id?.toString(),
            m.title,
            m.summary,
            m.enrichmentPrompt,
            m.updatedAt ? new Date(m.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("custom_concepts")) {
      const conceptsRaw = await db
        .collection("custom_concepts")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const concepts = conceptsRaw.map((c) =>
        decryptCustomConceptFields<CustomConcept & { _id: string }>({ ...c, _id: c._id?.toString() })
      );
      lines.push("## Custom Concepts");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Title", "Summary", "Enrichment Prompt", "Updated"],
          concepts.map((c) => [
            c._id?.toString(),
            c.title,
            c.summary,
            c.enrichmentPrompt,
            c.updatedAt ? new Date(c.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("concept_groups")) {
      const groupsRaw = await db
        .collection("concept_groups")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const groups = groupsRaw.map((g) =>
        decryptConceptGroupFields<ConceptGroup & { _id: string }>({ ...g, _id: g._id?.toString() })
      );
      lines.push("## Concept Frameworks");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Title", "Concept IDs", "Custom Group", "Updated"],
          groups.map((g) => [
            g._id?.toString(),
            g.title,
            Array.isArray(g.conceptIds) ? g.conceptIds.join(", ") : "",
            g.isCustomGroup ? "Yes" : "No",
            g.updatedAt ? new Date(g.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("habits")) {
      const habitsRaw = await db.collection("habits").find({ userId }).sort({ updatedAt: -1 }).toArray();
      const habits = habitsRaw.map((h) =>
        decryptHabitFields<Habit & { _id: string }>({ ...h, _id: h._id?.toString() })
      );
      lines.push("## Habits");
      lines.push("");
      lines.push(
        toMarkdownTable(
          [
            "ID",
            "Name",
            "Description",
            "Source type",
            "Source ID",
            "Bucket",
            "Planned start",
            "How to follow through",
            "Tips",
            "Updated",
          ],
          habits.map((h) => [
            h._id?.toString(),
            h.name,
            h.description,
            h.sourceType,
            h.sourceId,
            h.bucket ?? "",
            h.intendedMonth && h.intendedYear ? `${h.intendedYear}-${String(h.intendedMonth).padStart(2, "0")}` : "",
            h.howToFollowThrough,
            h.tips,
            h.updatedAt ? new Date(h.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("transcripts")) {
      const transcriptsRaw = await db
        .collection("transcripts")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const transcripts = transcriptsRaw.map((t) =>
        decryptTranscriptFields<SavedTranscript & { _id: string }>({ ...t, _id: t._id?.toString() })
      );
      lines.push("## Saved Transcripts");
      lines.push("");
      lines.push(
        toMarkdownTable(
          [
            "ID",
            "Source type",
            "Journal category",
            "Date",
            "Time",
            "Batch ID",
            "Video ID",
            "Video Title",
            "Channel",
            "Mentor reflections status",
            "Transcript",
            "Updated",
          ],
          transcripts.map((t) => [
            t._id?.toString(),
            t.sourceType ?? "youtube",
            t.journalCategory ?? "",
            t.journalEntryYear && t.journalEntryMonth && t.journalEntryDay
              ? `${t.journalEntryYear}-${String(t.journalEntryMonth).padStart(2, "0")}-${String(t.journalEntryDay).padStart(2, "0")}`
              : "",
            typeof t.journalEntryHour === "number" && typeof t.journalEntryMinute === "number"
              ? `${String(t.journalEntryHour).padStart(2, "0")}:${String(t.journalEntryMinute).padStart(2, "0")}`
              : "",
            t.journalBatchId ?? "",
            t.videoId,
            t.videoTitle,
            t.channel,
            t.journalMentorReflectionsStatus ?? "",
            typeof t.transcriptText === "string" ? t.transcriptText.replace(/\n/g, " ") : "",
            t.updatedAt ? new Date(t.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("saved_perspective_cards")) {
      const cardsRaw = await db
        .collection("saved_perspective_cards")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const cards = cardsRaw.map((c) =>
        decryptSavedPerspectiveCardFields<SavedPerspectiveCard & { _id: string }>({
          ...c,
          _id: c._id?.toString(),
        })
      );
      lines.push("## Saved Perspective Cards");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Name", "Prompt", "Follow-ups", "Source deck", "Updated"],
          cards.map((c) => [
            c._id?.toString(),
            c.name,
            c.prompt,
            Array.isArray(c.follow_ups) ? c.follow_ups.join(" | ") : "",
            c.sourceDeckName || c.sourceDeckId || "",
            c.updatedAt ? new Date(c.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("saved_mental_models")) {
      const savedRaw = await db
        .collection("user_saved_concepts")
        .find({ userId })
        .sort({ savedAt: -1 })
        .toArray();
      const saved = savedRaw.map((s) => decryptSavedConceptFields<SavedConcept>(s));
      const userModelsRaw = await db
        .collection("user_mental_models")
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      const userModels = userModelsRaw.map((m) =>
        decryptUserMentalModelFields<UserMentalModel & { _id: string }>({ ...m, _id: m._id?.toString() })
      );
      const fromSessions = sessions
        .flatMap((s) => (Array.isArray(s.mentalModelTags) ? s.mentalModelTags : []))
        .map((id) => ({ modelId: id, source: "session_tag" }));
      const savedRefs = saved.map((s) => ({ modelId: s.modelId as string, source: "saved_concept" }));
      const allRefs = [...savedRefs, ...fromSessions];
      const uniqueIds = [...new Set(allRefs.map((r) => r.modelId).filter(Boolean))];
      const userModelIds = new Set(userModels.map((m) => m.id));
      const allIds = [...new Set([...uniqueIds, ...userModelIds])];
      const modelRows = allIds.map((id) => {
        const userModel = userModels.find((m) => m.id === id);
        if (userModel) {
          const intro = userModel.quick_introduction ?? "";
          const first = intro.split(/[.!?]/)[0]?.trim();
          const oneLiner =
            userModel.one_liner?.trim() ||
            (first ? `${first}.` : intro.slice(0, 80));
          return {
            id,
            name: userModel.name,
            quickIntroduction: userModel.quick_introduction,
            oneLiner,
            sources: "user_created",
          };
        }
        const model = loadMentalModelContent(id, "en");
        return {
          id,
          name: model?.name ?? id,
          quickIntroduction: model?.quick_introduction ?? "",
          oneLiner: model ? getOneLiner(model) : "",
          sources: [...new Set(allRefs.filter((r) => r.modelId === id).map((r) => r.source))].join(", "),
        };
      });

      lines.push("## Saved Mental Models (Limited Fields)");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["Model ID", "Name", "Quick Introduction", "One Liner", "Source"],
          modelRows.map((m) => [m.id, m.name, m.quickIntroduction, m.oneLiner, m.sources])
        )
      );
      lines.push("");
      lines.push("> Only `name`, `quick_introduction`, and `one_liner` are exported for mental models.");
      lines.push("");
    }

    const markdown = lines.join("\n");
    const datePart = now.toISOString().slice(0, 10);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"fml-export-${datePart}.md\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export markdown failed:", err);
    return NextResponse.json({ error: "Failed to export markdown" }, { status: 500 });
  }
}

