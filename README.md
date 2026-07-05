# ollo-dashboard

営業・マーケの月次MTG用の報告ダッシュボード。Looker Studioの置き換え。GA4・Google広告・HubSpot・展示会費用のデータを1画面に統合し、Claude Codeへの指示でグラフの追加・削除・変更ができる構成にしている。

設計方針・背景の詳細は [DASHBOARD_SPEC.md](./DASHBOARD_SPEC.md)、Claude Code向けの作業ルールは [CLAUDE.md](./CLAUDE.md) を参照。

## 使い方

現状はダミーデータでの画面確認段階。

```bash
python3 data/build_data.py   # data/dashboard_data.json と .js を生成
open site/index.html         # ブラウザで確認
```

実データ接続後は `update.command` をダブルクリックすれば同じ流れが自動実行される（未実装）。

## ディレクトリ構成

```
ollo-dashboard/
├── CLAUDE.md
├── data/
│   ├── build_data.py
│   ├── connectors/        # sheets.py / ga4.py / google_ads.py
│   ├── dashboard_data.json
│   └── dashboard_data.js
├── site/
│   ├── index.html
│   └── charts/charts.js
├── update.command
└── README.md
```

## セットアップ（実データ接続時に必要）

Google Sheets API / GA4 Data API / Google Ads API の認証情報は `.env` または `secrets/` に置く（gitignore済み）。詳細は `CLAUDE.md` の「認証・秘匿情報」を参照。
