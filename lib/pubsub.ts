type SessionStatus = "BEFORE" | "DURING" | "AFTER";

export type Segment = {
  id: number;
  sessionId: string;
  rawText: string;
  polishedText: string;
  createdAt: Date;
};

export type Session = {
  id: string;
  status: SessionStatus;
  createdAt: Date;
  segments: Segment[];
  nextSegmentId: number;
};

export type SSEEvent =
  | { type: "session"; status: SessionStatus }
  | { type: "segment"; id: number; sessionId: string; rawText: string; polishedText: string; createdAt: Date };

type Subscriber = (event: SSEEvent) => void;

const sessions = new Map<string, Session>();
const subscribers = new Map<string, Set<Subscriber>>();

export function createSession(id: string): Session {
  const session: Session = {
    id,
    status: "BEFORE",
    createdAt: new Date(),
    segments: [],
    nextSegmentId: 1,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function updateSessionStatus(id: string, status: SessionStatus): Session | null {
  const session = sessions.get(id);
  if (!session) return null;
  session.status = status;
  publish(id, { type: "session", status });
  return session;
}

export function addSegment(sessionId: string, rawText: string, polishedText: string): Segment | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const segment: Segment = {
    id: session.nextSegmentId++,
    sessionId,
    rawText,
    polishedText,
    createdAt: new Date(),
  };
  session.segments.push(segment);
  publish(sessionId, { type: "segment", ...segment });
  return segment;
}

/** Subscribe to events for a session. Returns an unsubscribe function. */
export function subscribe(sessionId: string, callback: Subscriber): () => void {
  if (!subscribers.has(sessionId)) {
    subscribers.set(sessionId, new Set());
  }
  // biome-ignore lint/style/noNonNullAssertion: just set above
  subscribers.get(sessionId)!.add(callback);
  return () => {
    subscribers.get(sessionId)?.delete(callback);
  };
}

function publish(sessionId: string, event: SSEEvent): void {
  subscribers.get(sessionId)?.forEach((cb) => {
    cb(event);
  });
}
