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

export const textField = v.pipe(v.string(), v.nonEmpty("text is required"));

export const TextBodySchema = v.object({ text: textField });

export const TextWithPersonaBodySchema = v.object({
  text: textField,
  userPersona: v.optional(v.unknown()),
});

export function handleApiError(label: string, err: unknown): NextResponse {
  console.error(`${label} error:`, err);
  return NextResponse.json({ error: `Failed to ${label}` }, { status: 500 });
}
