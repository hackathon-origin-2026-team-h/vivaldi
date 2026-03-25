import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-2xl w-full mx-auto flex flex-col items-center gap-12">
        {/* Hero */}
        <div className="text-center flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <title>マイク</title>
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
              <path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 10Z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">fumumu</h1>
          <p className="text-lg text-slate-500 max-w-md leading-relaxed">
            音声をリアルタイムで文字に起こし、専門用語を即座に分かりやすく翻訳します。
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-2 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <title>リアルタイム</title>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">リアルタイム配信</p>
            <p className="text-xs text-slate-500 leading-relaxed">話した言葉が即座に参加者の画面へ届きます。</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-2 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <title>分かりやすく翻訳</title>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">分かりやすく翻訳</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              専門用語を含む文章を、分かりやすく参加者に伝えます。
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-2 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <title>QRコード</title>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">QRコードで共有</p>
            <p className="text-xs text-slate-500 leading-relaxed">QRコードをスキャンするだけで参加できます。</p>
          </div>
        </div>

        {/* Notice */}
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <title>注意</title>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-amber-800 leading-relaxed">
            <span className="font-semibold">ご注意：</span>
            録音中に書き起こされた文章は、QRコードを通じて参加者に公開されます。
            発言内容が参加者のデバイスにリアルタイムで表示されますので、あらかじめご了承ください。
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/speaker"
          className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-base font-semibold rounded-2xl shadow-md transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <title>QRコード作成</title>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          QRコードを作成する
        </Link>
      </div>
    </main>
  );
}
