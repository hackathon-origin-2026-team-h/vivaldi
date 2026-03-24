# vivaldi
聞こえた言葉が、あなたの言葉になる。

## QuickStart
### Needs
- Node.js 22
- pnpm

### Install and Start

```sh
pnpm install
pnpm run dev
```

See at http://localhost:3000/

## Development

### スキーマの変更

1. prisma/schema.prismaにモデルを追加する
2. pnpm db:migrate --name <名前> でマイグレーション実行
3. import { prisma } from "@/lib/prisma" で使用
