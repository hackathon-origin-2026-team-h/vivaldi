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

        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-sm font-semibold text-amber-950">デバッグ用テキスト送信</p>
          <p className="mt-1 text-xs leading-5 text-amber-900/75">入力エリアを読み込んでいます…</p>
        </div>
      </div>
    </main>
  );
}
