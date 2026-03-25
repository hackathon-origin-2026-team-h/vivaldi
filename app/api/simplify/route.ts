import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { simplify } from "@/lib/simplify";

const BodySchema = v.object({ text: v.pipe(v.string(), v.nonEmpty("text is required")) });

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  try {
    return NextResponse.json(await simplify(result.data.text));
  } catch (err) {
    console.error("simplify error:", err);
    return NextResponse.json({ error: "Failed to simplify text" }, { status: 500 });
  }
}
