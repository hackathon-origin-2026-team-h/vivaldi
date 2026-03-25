import AttendeePageClient from "./attendee-page-client";

type AttendeePageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AttendeePage({ params }: AttendeePageProps) {
  const { sessionId } = await params;

  return <AttendeePageClient sessionId={sessionId} />;
}
