import { NextResponse } from "next/server";
import * as v from "valibot";

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseBody<T>(request: Request, schema: v.GenericSchema<unknown, T>): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
  const result = v.safeParse(schema, json);
  if (!result.success) {
    const message = result.issues[0]?.message ?? "Invalid request body";
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { ok: true, data: result.output };
}
