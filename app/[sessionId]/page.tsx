import AttendeePageShell from "./attendee-page-shell";

type AttendeePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function AttendeePage({ params }: AttendeePageProps) {
  const { sessionId } = await params;

  return <AttendeePageShell sessionId={sessionId} />;
}
