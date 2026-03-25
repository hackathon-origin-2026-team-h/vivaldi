import * as v from "valibot";

export const UserPersonaSchema = v.object({
  knownDomains: v.fallback(v.array(v.string()), []),
  unknownDomains: v.fallback(v.array(v.string()), []),
  feedbackHistory: v.fallback(
    v.array(
      v.object({
        inference: v.fallback(v.string(), ""),
        timestamp: v.fallback(v.number(), 0),
      }),
    ),
    [],
  ),
});

export type UserPersona = v.InferOutput<typeof UserPersonaSchema>;

export const defaultPersona: UserPersona = {
  knownDomains: [],
  unknownDomains: [],
  feedbackHistory: [],
};

export function parsePersona(value: unknown): UserPersona {
  return v.parse(UserPersonaSchema, value ?? {});
}
