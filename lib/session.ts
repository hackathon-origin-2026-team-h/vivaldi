export type { Segment, SessionState, SessionStatus } from "@/worker/session-do";

export function getSessionStub(env: CloudflareEnv, sessionId: string) {
  return env.SESSION_DO.get(env.SESSION_DO.idFromName(sessionId));
}
