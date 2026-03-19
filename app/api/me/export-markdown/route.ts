import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { getOneLiner, loadMentalModelContent } from "@/lib/mental-models";

type ExportSection =
  | "settings"
  | "sessions"
  | "messages"
  | "long_term_memory"
  | "custom_concepts"
  | "concept_groups"
  | "nuggets"
  | "transcripts"
  | "saved_mental_models";

const ALL_SECTIONS: ExportSection[] = [
  "settings",
  "sessions",
  "messages",
  "long_term_memory",
  "custom_concepts",
  "concept_groups",
  "nuggets",
  "transcripts",
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

  try {
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body?.sections) ? body.sections : ALL_SECTIONS;
    const sections = requested.filter((s: unknown): s is ExportSection =>
      typeof s === "string" && ALL_SECTIONS.includes(s as ExportSection)
    );

    const db = await getDb();
    const now = new Date();
    const lines: string[] = [];
    lines.push("# FML Labs Data Export");
    lines.push("");
    lines.push(`- **Generated:** ${now.toISOString()}`);
    lines.push(`- **User ID:** ${userId}`);
    lines.push("");

    const sessions = sections.includes("sessions") || sections.includes("messages")
      ? await db.collection("sessions").find({ userId }).sort({ updatedAt: -1 }).toArray()
      : [];

    if (sections.includes("settings")) {
      const settings = await db.collection("user_settings").findOne({ userId });
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
          ["Session ID", "Title", "Created", "Updated", "Tags"],
          sessions.map((s) => [
            s._id?.toString(),
            s.title,
            s.createdAt ? new Date(s.createdAt).toISOString() : "",
            s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
            Array.isArray(s.mentalModelTags) ? s.mentalModelTags.join(", ") : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("messages")) {
      const sessionIds = sessions.map((s) => s._id?.toString()).filter(Boolean);
      const messages = sessionIds.length > 0
        ? await db
            .collection("messages")
            .find({ sessionId: { $in: sessionIds } })
            .sort({ createdAt: 1 })
            .toArray()
        : [];
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
      const memories = await db.collection("long_term_memory").find({ userId }).sort({ updatedAt: -1 }).toArray();
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
      const concepts = await db.collection("custom_concepts").find({ userId }).sort({ updatedAt: -1 }).toArray();
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
      const groups = await db.collection("concept_groups").find({ userId }).sort({ updatedAt: -1 }).toArray();
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

    if (sections.includes("nuggets")) {
      const nuggets = await db.collection("nuggets").find({ userId }).sort({ updatedAt: -1 }).toArray();
      lines.push("## Nuggets");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Content", "Source", "Updated"],
          nuggets.map((n) => [
            n._id?.toString(),
            n.content,
            n.source,
            n.updatedAt ? new Date(n.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("transcripts")) {
      const transcripts = await db.collection("transcripts").find({ userId }).sort({ updatedAt: -1 }).toArray();
      lines.push("## Saved Transcripts");
      lines.push("");
      lines.push(
        toMarkdownTable(
          ["ID", "Video ID", "Video Title", "Channel", "Transcript", "Updated"],
          transcripts.map((t) => [
            t._id?.toString(),
            t.videoId,
            t.videoTitle,
            t.channel,
            typeof t.transcriptText === "string" ? t.transcriptText.replace(/\n/g, " ") : "",
            t.updatedAt ? new Date(t.updatedAt).toISOString() : "",
          ])
        )
      );
      lines.push("");
    }

    if (sections.includes("saved_mental_models")) {
      const saved = await db.collection("user_saved_concepts").find({ userId }).sort({ savedAt: -1 }).toArray();
      const userModels = await db.collection("user_mental_models").find({ userId }).sort({ updatedAt: -1 }).toArray();
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
          const first = userModel.quick_introduction.split(/[.!?]/)[0]?.trim();
          const oneLiner =
            userModel.one_liner?.trim() ||
            (first ? `${first}.` : userModel.quick_introduction.slice(0, 80));
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

