"use client";

import dynamic from "next/dynamic";

const AttendeePageClient = dynamic(() => import("./attendee-page-client"), {
  ssr: false,
  loading: () => <AttendeeLoadingShell />,
});

type AttendeePageShellProps = {
  sessionId: string;
};

export default function AttendeePageShell({ sessionId }: AttendeePageShellProps) {
  return <AttendeePageClient sessionId={sessionId} />;
}

function AttendeeLoadingShell() {
  return (
    <main
      className="relative h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,248,237,0.95),rgba(255,248,237,0.58)_22%,transparent_48%),linear-gradient(180deg,#f7efe5_0%,#ecdcc8_45%,#e3cfbb_100%)] text-[#1f1510]"
      style={{
        fontFamily:
          '"Hiragino Maru Gothic ProN", "Hiragino Maru Gothic Pro", "YuKyokasho Yoko", "Arial Rounded MT Bold", sans-serif',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-10%] top-[-18%] h-[38vh] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85),rgba(255,255,255,0.12)_58%,transparent_72%)] blur-3xl"
      />
      <section className="relative z-10 flex h-[100svh] items-center justify-center px-6 py-8">
        <p className="text-center text-[clamp(1.65rem,7vw,2.4rem)] font-black tracking-[-0.05em] text-[#6b584c]">
          発表開始までお待ちください
        </p>
      </section>
    </main>
  );
}
