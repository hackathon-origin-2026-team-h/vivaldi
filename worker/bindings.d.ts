/// <reference types="@cloudflare/workers-types" />
import type { SessionDO } from "./session-do";

declare global {
  interface CloudflareEnv {
    SESSION_DO: DurableObjectNamespace<SessionDO>;
  }
}
