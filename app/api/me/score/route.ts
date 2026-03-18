import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserScore } from "@/lib/score";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const score = await getUserScore(userId);
    return NextResponse.json(score);
  } catch (err) {
    console.error("Failed to fetch score:", err);
    return NextResponse.json({ error: "Failed to fetch score" }, { status: 500 });
  }
}
