import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/score";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLeaderboard();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
