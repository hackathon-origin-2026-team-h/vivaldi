"use client";

import dynamic from "next/dynamic";

const SpeakerPageClient = dynamic(() => import("./speaker-page-client"), {
  ssr: false,
  loading: () => <SpeakerLoadingShell />,
});

export default function SpeakerPageShell() {
  return <SpeakerPageClient />;
}

function SpeakerLoadingShell() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">音声書き起こし</h1>
        <p className="mb-8 text-sm text-gray-500">マイクからの音声をリアルタイムで文字起こしします</p>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-400">発表者ビューを準備しています…</p>
        </div>
      </div>
    </main>
  );
}
