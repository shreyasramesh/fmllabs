import { NextResponse } from "next/server";
import { loadFamousFigures } from "@/lib/famous-figures";

export async function GET(request: Request) {
  try {
    const { categories, figures } = loadFamousFigures();
    return NextResponse.json({ categories, figures });
  } catch (err) {
    console.error("Failed to load famous figures:", err);
    return NextResponse.json(
      { error: "Failed to load famous figures" },
      { status: 500 }
    );
  }
}
