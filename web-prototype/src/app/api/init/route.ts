import { ensureDb } from "@/lib/server/init";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await ensureDb();
    return NextResponse.json({ initialized: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { initialized: false, error: String(error) },
      { status: 500 }
    );
  }
}
