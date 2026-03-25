"use client";

import { useEffect, useState } from "react";
import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

const PERSONA_KEY = "vivaldi:userPersona";

function loadPersona(): UserPersona {
  if (typeof window === "undefined") return defaultPersona;
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) return defaultPersona;
    return parsePersona(JSON.parse(raw));
  } catch {
    return defaultPersona;
  }
}

export default function ProfilePage() {
  const [persona, setPersona] = useState<UserPersona | null>(null);

  useEffect(() => {
    setPersona(loadPersona());
  }, []);

  function handleReset() {
    localStorage.removeItem(PERSONA_KEY);
    setPersona(defaultPersona);
  }

  if (persona === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中…</p>
      </main>
    );
  }

  const isEmpty =
    persona.knownDomains.length === 0 && persona.unknownDomains.length === 0 && persona.feedbackHistory.length === 0;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">ユーザーペルソナ（デバッグ）</h1>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            リセット
          </button>
        </div>

        {isEmpty && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            ペルソナ情報はまだありません
          </div>
        )}

        {/* knownDomains */}
        <Section title="知っている領域" count={persona.knownDomains.length}>
          {persona.knownDomains.length === 0 ? <Empty /> : <TagList tags={persona.knownDomains} color="green" />}
        </Section>

        {/* unknownDomains */}
        <Section title="知らない領域" count={persona.unknownDomains.length}>
          {persona.unknownDomains.length === 0 ? <Empty /> : <TagList tags={persona.unknownDomains} color="orange" />}
        </Section>

        {/* feedbackHistory */}
        <Section title="フィードバック履歴" count={persona.feedbackHistory.length}>
          {persona.feedbackHistory.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {persona.feedbackHistory.map((item) => (
                <li key={item.timestamp} className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-700 leading-relaxed">{item.inference}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.timestamp).toLocaleString("ja-JP")}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Raw JSON */}
        <Section title="Raw JSON" count={null}>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">
            {JSON.stringify(persona, null, 2)}
          </pre>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, count, children }: { title: string; count: number | null; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {count !== null && <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function TagList({ tags, color }: { tags: string[]; color: "green" | "orange" }) {
  const cls =
    color === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-orange-50 text-orange-700 border-orange-200";
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className={`text-xs px-2.5 py-1 rounded-full border ${cls}`}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-gray-400">なし</p>;
}
