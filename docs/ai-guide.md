# vivaldi — AI エージェント向けガイド

このドキュメントはコードを読んだだけでは導き出せない設計意図・実装方針をまとめたものです。
作業を開始する前に必ずこのドキュメントを読んでください。

---

## 1. システム概要

学会・勉強会などのスピーチをリアルタイム文字起こしし、各聴講者の理解度に合わせて自動意訳するWebアプリ。

**2つのロール:**

| ロール | 画面 | URL |
|--------|------|-----|
| 発表者 (Speaker) | 発表者ビュー | `/speaker` |
| 聴講者 (Attendee) | 聴講者ビュー | `/<sessionId>` |

---

## 2. 現在の実装状態

### 実装済み

- `app/speaker/page.tsx` — Deepgramによるリアルタイム音声書き起こしUI
- `app/api/transcribe/token/route.ts` — Deepgram一時トークン発行
- `app/api/polish/route.ts` → `lib/gemini.ts` — Geminiによる書き起こしの整形（言い淀み除去）
- トークセッションの作成・管理（DB）
- 聴講者ビュー（`/[sessionId]/page.tsx`）
- リアルタイム更新（SSE）

### 未実装（要実装）

- 個人向け意訳機能（パーソナライズ）
- フィードバック → ユーザーペルソナ更新ループ
- QRコード生成・表示

---

## 3. データモデル（Prismaスキーマ）

`prisma/schema.prisma` に以下のモデルを追加する。

```prisma
model TalkSession {
  id        String             @id          // Snowflake ID（後述）
  status    SessionStatus      @default(BEFORE)
  createdAt DateTime           @default(now())
  segments  TranscriptSegment[]
}

enum SessionStatus {
  BEFORE   // 発表前
  DURING   // 発表中
  AFTER    // 発表後
}

model TranscriptSegment {
  id          Int         @id @default(autoincrement())
  sessionId   String
  session     TalkSession @relation(fields: [sessionId], references: [id])
  rawText     String      // Deepgramの生テキスト
  polishedText String     // Geminiで整形済みテキスト（言い淀み除去後）
  createdAt   DateTime    @default(now())
}
```

**Snowflake ID の生成:**
セッションIDはURLに使われるため推測困難かつ短い文字列が望ましい。
`Date.now().toString(36) + Math.random().toString(36).slice(2, 8)` のような実装でよい。
専用ライブラリは不要。

---

## 4. APIルート設計

### 既存

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/transcribe/token` | Deepgram一時トークン発行 |
| POST | `/api/polish` | 書き起こし整形（言い淀み除去） |

### 追加が必要

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/sessions` | トークセッション作成。`{ id }` を返す |
| PATCH | `/api/sessions/[id]` | セッションステータス更新。`{ status: "DURING" \| "AFTER" }` を受け取る |
| POST | `/api/sessions/[id]/segments` | セグメント追加。`{ rawText, polishedText }` を受け取る |
| GET | `/api/sessions/[id]/stream` | SSEエンドポイント。聴講者が購読する |
| POST | `/api/personalize` | 個人向け意訳。`{ text, userPersona }` を受け取り `{ personalized }` を返す |
| POST | `/api/feedback` | 意訳フィードバック処理。`{ text, userPersona }` を受け取り `{ updatedPersona, inference }` を返す |

---

## 5. リアルタイム更新アーキテクチャ（SSE）

WebSocketではなく**SSE (Server-Sent Events)** を採用する。
理由：聴講者は受信専用であり、Next.js Route Handler で容易に実装できる。

### SSEエンドポイント実装パターン

```ts
// app/api/sessions/[id]/stream/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // polling or in-memory pub/sub
      const interval = setInterval(async () => {
        const segments = await getNewSegmentsSince(params.id, lastSegmentId);
        for (const seg of segments) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(seg)}\n\n`));
          lastSegmentId = seg.id;
        }
      }, 500);
      req.signal.addEventListener("abort", () => clearInterval(interval));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**発表者側のデータフロー:**
```
音声 → Deepgram(WebSocket) → rawText
    → POST /api/polish → polishedText
    → POST /api/sessions/[id]/segments → DB保存
    → SSEで全聴講者に配信
```

**聴講者側のデータフロー:**
```
GET /api/sessions/[id]/stream (SSE購読)
    → セグメント受信
    → POST /api/personalize（userPersonaをbodyに含む）
    → 意訳済みテキストを表示
```

---

## 6. 個人向け意訳機能（パーソナライズ）

### ユーザーペルソナ（localStorageスキーマ）

聴講者のブラウザのlocalStorageに保存。キーは `vivaldi:userPersona`。

```ts
type UserPersona = {
  knownDomains: string[];    // 例: ["機械学習", "統計学"]
  unknownDomains: string[];  // 例: ["量子コンピュータ"]
  feedbackHistory: Array<{
    inference: string;       // 例: "量子力学の専門用語に不慣れな可能性"
    timestamp: number;
  }>;
};
```

初期値は `{ knownDomains: [], unknownDomains: [], feedbackHistory: [] }`。

### 意訳プロンプト（`/api/personalize`）

```
以下の発表テキストを、聴講者が理解しやすい表現に意訳してください。

【聴講者の特性】
${userPersona の内容を自然言語で要約}

【元のテキスト】
${polishedText}

ルール:
- 内容を変えず、表現だけを平易にする
- 専門用語は聴講者が知らない可能性がある場合、括弧で簡潔な説明を補足する
- 意訳後のテキストのみ返す
```

### フィードバックループ（`/api/feedback`）

聴講者が「わかりにくい」ボタンを押したとき:

1. POST /api/feedback に `{ text, userPersona }` を送る
2. Geminiに「なぜわかりにくかったかを推測してください」というプロンプトで推論させる
3. 推論結果を `userPersona.feedbackHistory` に追記してlocalStorageを更新する
4. 更新された `userPersona` を以降の `/api/personalize` 呼び出しに使う

**フィードバック推論プロンプト:**
```
以下のテキストを読んだ聴講者が「わかりにくい」と感じました。

【テキスト】
${text}

【現在の聴講者ペルソナ】
${JSON.stringify(userPersona)}

このテキストの何がわかりにくかったか、1〜2文で推測してください。
例: "量子もつれなど量子力学固有の概念への不慣れが原因と考えられる"
推測のみ返してください。
```

---

## 7. 発表者ビュー（`/speaker`）の拡張

現在の `/speaker` ページを以下のように拡張する。

**セッション作成フロー:**
1. ページ読み込み時に `POST /api/sessions` を叩き、セッションIDを取得
2. 聴講者URL（`https://<host>/<sessionId>`）をQRコードで大きく表示
3. 開始/停止ボタンで `PATCH /api/sessions/[id]` を叩きステータス更新
4. 書き起こし完了後 `POST /api/sessions/[id]/segments` でDBに保存しSSE配信

**QRコード生成:**
外部ライブラリを使う。`qrcode` (npm) の `toDataURL` でBase64 PNG生成が最も簡単。

---

## 8. 聴講者ビュー（`/[sessionId]/page.tsx`）

```
app/
  [sessionId]/
    page.tsx    ← "use client" のクライアントコンポーネント
```

**表示すべき情報:**
- セッションステータス（発表前/発表中/発表後）
- テキスト一覧：各セグメントに対して
  - 意訳済みテキスト（メイン表示）
  - 「わかりにくい」ボタン → フィードバックAPIを叩く
- 発表前は「発表開始をお待ちください」のメッセージ

---

## 9. 環境変数

`.env.example` を参照。必要な変数:

| 変数名 | 説明 |
|--------|------|
| `DEEPGRAM_API_KEY` | Deepgram APIキー |
| `GEMINI_API_KEY` | Google Gemini APIキー |
| `DATABASE_URL` | SQLite or LibSQL接続URL（例: `file:./dev.db`） |

---

## 10. 技術スタック早見表

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16.2.1（**独自の破壊的変更あり。必ず `node_modules/next/dist/docs/` を参照**） |
| UI | React 19 + Tailwind CSS 4 |
| 音声認識 | Deepgram SDK v5（`nova-3` モデル、日本語） |
| LLM | Google Gemini 2.0 Flash（`@google/genai` v1） |
| DB ORM | Prisma 7 + LibSQL（SQLite互換） |
| リント/フォーマット | Biome 2（ESLintではない） |
| テスト | Vitest（単体）/ Playwright（ビジュアル回帰） |
| パッケージマネージャ | pnpm |

---

## 11. 実装上の注意点

- **Next.js バージョン:** 16.2.1 は通常の Next.js 14/15 と互換性がない場合がある。`node_modules/next/dist/docs/` のドキュメントを必ず読むこと
- **Biome:** ESLintの代わりにBiomeを使用。`biome check --fix` でフォーマット+lint自動修正可能
- **Prisma 7:** `prisma generate` の出力先が `app/generated/prisma`（`@prisma/client` ではなく直接インポート）
- **SSEとサーバーレス:** Vercelなどサーバーレス環境ではSSEの長時間接続に注意。開発環境（`next dev`）では問題なし
- **localStorageはクライアント専用:** SSR時には `typeof window !== "undefined"` でガードする
