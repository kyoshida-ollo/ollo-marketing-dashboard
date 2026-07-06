# ollo-dashboard

営業・マーケの月次MTG用の報告ダッシュボード。Looker Studioの置き換え。GA4・Google広告・HubSpot・展示会費用のデータを1画面に統合し、Claude Codeへの指示でグラフの追加・削除・変更ができる構成にしている。

設計方針・背景の詳細は [DASHBOARD_SPEC.md](./DASHBOARD_SPEC.md)、Claude Code向けの作業ルールは [CLAUDE.md](./CLAUDE.md) を参照。

## 使い方

`update.command` をダブルクリック（または以下を実行）。

```bash
python3 data/build_data.py   # data/dashboard_data.json と .js を生成
open site/index.html         # ブラウザで確認
```

施策実績（リード・商談化・受注・費用）はスプレッドシート実データ。GA4・広告キーワード・HubSpot明細は
未接続のためダミー（画面に「ダミー」チップ表示）。

シートをAPIから直接取得するには `.env.example` を `.env` にコピーし、サービスアカウント鍵を設定する
（`pip install -r requirements.txt` が必要）。未設定でも `data/cache/` のキャッシュで動作する。

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
