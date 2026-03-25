import { Syne, Zen_Kaku_Gothic_New } from "next/font/google";

const syne = Syne({ subsets: ["latin"], weight: ["400", "700", "800"] });
const zen = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["300", "400"] });

export default function Home() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; color: #1a1a1a; }

        .btn-orange {
          background: #ff6b35;
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 12px 28px;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-block;
        }
        .btn-orange:hover { background: #e85a24; }

        .nav-btn {
          background: #ff6b35;
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 10px 22px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .nav-btn:hover { background: #e85a24; }

        .role-card-speaker {
          background: #ff6b35;
          color: #fff;
          border-radius: 20px;
          padding: 48px 40px;
          flex: 1;
          transition: transform 0.2s;
        }
        .role-card-speaker:hover { transform: translateY(-4px); }

        .role-card-listener {
          background: #1a1a1a;
          color: #fff;
          border-radius: 20px;
          padding: 48px 40px;
          flex: 1;
          transition: transform 0.2s;
        }
        .role-card-listener:hover { transform: translateY(-4px); }

        .how-card {
          border-radius: 16px;
          padding: 36px 28px;
          flex: 1;
          min-width: 0;
        }

        @media (max-width: 768px) {
          .concept-grid { grid-template-columns: 1fr !important; }
          .how-grid { flex-direction: column !important; }
          .role-grid { flex-direction: column !important; }
          .hero-title { font-size: 56px !important; }
          .logo-text { font-size: 28px !important; }
        }
      `}</style>

      {/* Navbar */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#fff",
          borderBottom: "1px solid #f0ede8",
          padding: "0 40px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className={`logo-text ${syne.className}`} style={{ fontSize: 22, fontWeight: 800 }}>
          fumumu<span style={{ color: "#ff6b35" }}>.</span>
        </span>
        <a href="/speaker" className={`nav-btn ${syne.className}`}>
          始める
        </a>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 40px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ maxWidth: 640 }}>
          <div>
            <h1
              className={`hero-title ${syne.className}`}
              style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, marginBottom: 24 }}
            >
              fumumu<span style={{ color: "#ff6b35" }}>.</span>
            </h1>

            <p className={zen.className} style={{ fontSize: 18, lineHeight: 1.9, color: "#aaa", marginBottom: 40 }}>
              ふむむ、わかった。
              <br />
              専門用語を、その場で、
              <br />
              あなたの言葉に。
            </p>

            <a href="/speaker" className={`btn-orange ${syne.className}`}>
              始める →
            </a>
          </div>

        </div>
      </section>

      {/* Concept */}
      <section style={{ background: "#fafaf8", padding: "100px 40px" }}>
        <div
          className="concept-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            maxWidth: 1200,
            margin: "0 auto",
            alignItems: "center",
          }}
        >
          <div>
            <h2 className={syne.className} style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.2 }}>
              「ふむむ」から
              <br />
              <span style={{ color: "#ff6b35" }}>「わかった！」</span>へ。
            </h2>
          </div>
          <div>
            <p className={zen.className} style={{ fontSize: 16, lineHeight: 2, color: "#aaa" }}>
              学会・勉強会・社内発表。
              <br />
              専門知識の差が、理解の壁になる。
              <br />
              <br />
              fumumu は発表をリアルタイムで文字起こしし、
              <br />
              聴講者ひとりひとりの知識レベルに合わせて
              <br />
              自動的に言い換えて届けます。
              <br />
              <br />
              発表者はいつもどおり話すだけ。
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "#1a1a1a", padding: "100px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="how-grid" style={{ display: "flex", gap: 20 }}>
            {/* Card 1 */}
            <div className="how-card" style={{ background: "#ff6b35" }}>
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                aria-hidden="true"
                style={{ marginBottom: 24 }}
              >
                <rect x="18" y="10" width="44" height="60" rx="8" fill="rgba(0,0,0,0.15)" />
                <rect x="22" y="16" width="36" height="36" rx="4" fill="#fff" fillOpacity="0.9" />
                {/* QR pattern */}
                <rect x="26" y="20" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="34" y="20" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="42" y="20" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="26" y="28" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="42" y="28" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="26" y="36" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="34" y="28" width="6" height="6" rx="1" fill="#ff6b35" />
                <rect x="34" y="36" width="14" height="6" rx="1" fill="#ff6b35" />
                {/* List items */}
                <rect x="24" y="58" width="32" height="4" rx="2" fill="rgba(0,0,0,0.2)" />
                <rect x="24" y="65" width="22" height="4" rx="2" fill="rgba(0,0,0,0.15)" />
              </svg>
              <h3 className={syne.className} style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>QRを生成</h3>
              <p className={zen.className} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.8 }}>
                発表者がセッションを作成。QRコードを投影するだけで準備完了。
              </p>
            </div>

            {/* Card 2 */}
            <div className="how-card" style={{ background: "#fff" }}>
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                aria-hidden="true"
                style={{ marginBottom: 24 }}
              >
                <rect x="18" y="10" width="44" height="60" rx="8" fill="#f0ede8" />
                <rect x="22" y="16" width="36" height="36" rx="4" fill="#fff" stroke="#e0ddd8" strokeWidth="1" />
                {/* QR pattern small */}
                <rect x="27" y="21" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="34" y="21" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="41" y="21" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="27" y="28" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="34" y="28" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="41" y="28" width="5" height="5" rx="1" fill="#1a1a1a" />
                <rect x="27" y="35" width="19" height="5" rx="1" fill="#1a1a1a" />
                {/* Scan line */}
                <line x1="22" y1="34" x2="58" y2="34" stroke="#ff6b35" strokeWidth="2" strokeDasharray="4 2">
                  <animate attributeName="y1" values="16;52;16" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="y2" values="16;52;16" dur="2s" repeatCount="indefinite" />
                </line>
                <rect x="24" y="58" width="32" height="4" rx="2" fill="#e0ddd8" />
                <rect x="24" y="65" width="22" height="4" rx="2" fill="#eeecea" />
              </svg>
              <h3 className={syne.className} style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>QRを読む</h3>
              <p className={zen.className} style={{ fontSize: 14, color: "#888", lineHeight: 1.8 }}>
                聴講者はスマホでQRをスキャン。アプリ不要、ブラウザで即アクセス。
              </p>
            </div>

            {/* Card 3 */}
            <div className="how-card" style={{ background: "#fff3ee" }}>
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                aria-hidden="true"
                style={{ marginBottom: 24 }}
              >
                {/* Original bubble */}
                <rect x="8" y="12" width="36" height="24" rx="8" fill="#e0ddd8" />
                <rect x="12" y="18" width="28" height="5" rx="2.5" fill="#bbb" />
                <rect x="12" y="26" width="20" height="4" rx="2" fill="#ccc" />
                <polygon points="16,36 24,36 20,42" fill="#e0ddd8" />
                {/* Arrow */}
                <circle cx="40" cy="50" r="10" fill="#ff6b35" />
                <path
                  d="M35 50 L43 50 M40 45 L45 50 L40 55"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Simplified bubble */}
                <rect x="38" y="28" width="36" height="28" rx="8" fill="#fff0eb" stroke="#ffd4c2" strokeWidth="1.5" />
                <rect x="43" y="34" width="26" height="5" rx="2.5" fill="#ffb39a" />
                <rect x="43" y="42" width="20" height="4" rx="2" fill="#ffd4c2" />
                <rect x="43" y="50" width="16" height="4" rx="2" fill="#ffd4c2" />
                <polygon points="46,56 54,56 50,62" fill="#fff0eb" />
              </svg>
              <h3 className={syne.className} style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>わかる言葉で届く</h3>
              <p className={zen.className} style={{ fontSize: 14, color: "#888", lineHeight: 1.8 }}>
                AIが専門用語を自動で言い換え。理解度に合わせてリアルタイムに翻訳。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role selection */}
      <section style={{ background: "#fff", padding: "100px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="role-grid" style={{ display: "flex", gap: 20, marginBottom: 48 }}>
            <div className={`role-card-speaker ${syne.className}`}>
              <h3 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>発表する</h3>
              <p className={zen.className} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.8 }}>
                セッションを作成してQRコードを投影。
                <br />
                あとはいつもどおり話すだけ。
              </p>
            </div>

            <div className={`role-card-listener ${syne.className}`}>
              <h3 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>参加する</h3>
              <p className={zen.className} style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                QRをスキャンするだけ。
                <br />
                あなたのペルソナに合わせた言葉で届く。
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <a
              href="/speaker"
              className={`btn-orange ${syne.className}`}
              style={{ fontSize: 16, padding: "14px 36px" }}
            >
              始める →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: "#111",
          padding: "32px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className={syne.className} style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.3)" }}>
          fumumu<span style={{ color: "rgba(255,107,53,0.5)" }}>.</span>
        </span>
      </footer>
    </>
  );
}
