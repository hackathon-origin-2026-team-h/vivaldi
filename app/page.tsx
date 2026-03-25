import { Kosugi_Maru } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const kosugiMaru = Kosugi_Maru({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function Home() {
  return (
    <main
      className={`${kosugiMaru.className} min-h-screen flex flex-col items-center px-5 py-12`}
      style={{ backgroundColor: "#FFF4E5" }}
    >
      <div className="max-w-lg w-full mx-auto flex flex-col items-center gap-10">
        {/* ── App Icon ── */}
        <div className="relative mt-4">
          <div className="absolute -inset-3 rounded-full opacity-20 blur-xl" style={{ backgroundColor: "#E98527" }} />
          <Image
            src="/fumumu-icon.png"
            alt="fumumu アプリアイコン"
            width={140}
            height={140}
            className="relative rounded-full"
            priority
          />
        </div>

        {/* ── Title ── */}
        <div className="text-center flex flex-col items-center gap-3">
          <h1 className="text-5xl font-bold" style={{ color: "#E98527", letterSpacing: "0.25em" }}>
            fumumu
          </h1>
          <p className="text-sm mt-1 tracking-wide" style={{ color: "#C06A10" }}>
            ふむふむ...から「わかった！」へ
          </p>
          <p className="text-base text-stone-600 max-w-sm leading-relaxed mt-2">
            話している言葉をリアルタイムで文字にして、 むずかしい専門用語もやさしく伝えます。
          </p>
        </div>

        {/* ── How it works (vertical steps) ── */}
        <div className="w-full flex flex-col gap-0">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{ backgroundColor: "#E98527" }}
              >
                1
              </div>
              <div className="w-0.5 h-10" style={{ backgroundColor: "#E9852766" }} />
            </div>
            <div className="pt-1.5">
              <p className="font-bold text-stone-800 text-sm">押す</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                ボタンひとつで参加者用のQRコードが生成されます。
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{ backgroundColor: "#E98527" }}
              >
                2
              </div>
              <div className="w-0.5 h-10" style={{ backgroundColor: "#E9852766" }} />
            </div>
            <div className="pt-1.5">
              <p className="font-bold text-stone-800 text-sm">話す</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                発表を開始すると、あなたの発表の文字起こしがリアルタイムで聴講者に伝わります。
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{ backgroundColor: "#E98527" }}
              >
                3
              </div>
            </div>
            <div className="pt-1.5">
              <p className="font-bold text-stone-800 text-sm">わかる！</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                難しい文章がわかりやすくなって参加者に届きます。
              </p>
            </div>
          </div>
        </div>

        {/* ── Notice ── */}
        <div
          className="w-full rounded-2xl px-5 py-4 flex gap-3 items-start"
          style={{ backgroundColor: "#FFECD2", borderColor: "#E9852733" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#E98527"
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
          <p className="text-xs leading-relaxed" style={{ color: "#8B5A1B" }}>
            <span className="font-bold">おしらせ：</span>
            音声から書き起こされた文章は、QRコードを読み取った参加者に公開されます。
            発言内容がリアルタイムで表示されますので、あらかじめご了承ください。
          </p>
        </div>

        {/* ── CTA Button ── */}
        <Link
          href="/speaker"
          className="w-full flex items-center justify-center gap-3 px-8 py-4 text-white text-base font-bold rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: "#E98527" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <title>QRコード作成</title>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3z" />
            <path d="M21 14v7h-7" />
          </svg>
          QRコードを作成する
        </Link>

        {/* ── Footer ── */}
        <p className="text-xs text-stone-400 text-center pb-4">fumumu — ふむふむから、わかったへ。</p>
      </div>
    </main>
  );
}
