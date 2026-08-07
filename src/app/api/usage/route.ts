import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/ai/usage-summary";

export async function GET() {
  await requireUser();
  try {
    return NextResponse.json(await getUsageSummary());
  } catch (error) {
    console.error("GET /api/usage", error);
    return NextResponse.json({ error: "Could not load usage." }, { status: 500 });
  }
}
