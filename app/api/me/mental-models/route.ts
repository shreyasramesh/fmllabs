import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getUserMentalModels,
  createUserMentalModel,
} from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getUserMentalModels(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch user mental models:", err);
    return NextResponse.json(
      { error: "Failed to fetch mental models" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const model = body.model as Record<string, unknown> | undefined;
    if (!model || typeof model !== "object") {
      return NextResponse.json(
        { error: "model object is required" },
        { status: 400 }
      );
    }
    const id = `custom_${new ObjectId().toString().slice(-8)}`;
    const ensureString = (v: unknown): string =>
      typeof v === "string" ? v : "";
    const ensureArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x ?? "")).filter(Boolean) : [];
    const ensureRecord = (v: unknown): Record<string, string> => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return Object.fromEntries(
          Object.entries(v).map(([k, val]) => [
            k,
            typeof val === "string" ? val : String(val ?? ""),
          ])
        );
      }
      return {};
    };
    const whenToUse = ensureArray(model.when_to_use);
    if (!whenToUse.includes("custom")) whenToUse.unshift("custom");
    const created = await createUserMentalModel(userId, {
      id,
      name: ensureString(model.name) || "Custom mental model",
      quick_introduction: ensureString(model.quick_introduction),
      in_more_detail: ensureString(model.in_more_detail),
      why_this_is_important: ensureString(model.why_this_is_important),
      when_to_use: whenToUse,
      how_can_you_spot_it: ensureRecord(model.how_can_you_spot_it),
      examples: ensureRecord(model.examples),
      real_world_implications:
        typeof model.real_world_implications === "string"
          ? model.real_world_implications
          : ensureRecord(model.real_world_implications),
      professional_application: ensureRecord(model.professional_application),
      how_can_this_be_misapplied: ensureRecord(
        model.how_can_this_be_misapplied
      ),
      related_content: ensureArray(model.related_content),
      one_liner:
        typeof model.one_liner === "string" ? model.one_liner : undefined,
      try_this: Array.isArray(model.try_this)
        ? model.try_this.map(String)
        : undefined,
      ask_yourself: Array.isArray(model.ask_yourself)
        ? model.ask_yourself.map(String)
        : undefined,
    });
    return NextResponse.json(created);
  } catch (err) {
    console.error("Failed to create mental model:", err);
    return NextResponse.json(
      { error: "Failed to create mental model" },
      { status: 500 }
    );
  }
}
