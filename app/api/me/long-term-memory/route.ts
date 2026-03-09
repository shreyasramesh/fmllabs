import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLongTermMemories } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getLongTermMemories(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch long-term memory:", err);
    return NextResponse.json(
      { error: "Failed to fetch long-term memory" },
      { status: 500 }
    );
  }
}
