# ollo-dashboard — Claude Code コンテキスト

このリポジトリは営業・マーケの月次MTG用の報告ダッシュボード。詳細な背景・設計方針は `DASHBOARD_SPEC.md` を参照（本ファイルはその要点と作業ルール）。

## 目的

- Looker Studioで見ていたGA4・Google広告データと、スプレッドシート集約のHubSpot・展示会費用データを1画面に統合する。
- **グラフの追加・削除・変更をClaudeへの指示だけで行える**構造にする。Looker Studioは廃止しこれで完全に置き換える。

## アーキテクチャ

```
[HubSpotスプレッドシート]──┐
[展示会費用スプレッドシート]┼─→ data/build_data.py が集約 → data/dashboard_data.json
[GA4 Data API]─────────────┤     (dashboard_data.js もブラウザ読み込み用に同時生成)
[Google Ads API]───────────┘
                             ↓
                  site/index.html（静的1ページ、Chart.js、日本語UI）
```

- HubSpot・展示会費用は既存のスプレッドシート運用を維持（`data/connectors/sheets.py`経由）。
- GA4・Google広告は件数が多いためスプレッドシートを経由せず、APIから直接取得し**集計済みの数値のみ**をJSONに落とす（生イベントは保存しない）。
- ダッシュボードはサーバー不要の静的HTML。社内利用のみでホスティングは不要、ローカルでファイルを開く運用。
- 更新は「更新ボタン」＝ `update.command`（`build_data.py`実行→ブラウザ表示）。初期は手動実行、後で週次自動化を検討。

## ディレクトリ構成

```
ollo-dashboard/
├── CLAUDE.md
├── data/
│   ├── build_data.py       ← 各コネクタを呼び出して集約 → dashboard_data.json / .js
│   ├── connectors/
│   │   ├── sheets.py       ← Google Sheets API（HubSpot集計・展示会費用シート）
│   │   ├── ga4.py          ← Google Analytics Data API
│   │   └── google_ads.py   ← Google Ads API
│   ├── dashboard_data.json ← 生成物。gitには入れるが手で編集しない
│   └── dashboard_data.js   ← 生成物。file://で開いた際のCORS回避用（jsonと同内容をwindow変数に代入）
├── site/
│   ├── index.html          ← ダッシュボード本体
│   └── charts/
│       └── charts.js       ← グラフ定義一覧（1グラフ=1オブジェクト）
├── update.command          ← ダブルクリックでデータ更新→ブラウザ表示（Mac用）
└── README.md
```

## グラフ定義の設計方針（ここが「Claudeが指示で編集できる」の要）

`site/charts/charts.js` に配列でグラフ定義を並べる。1グラフ=1オブジェクト：

```js
{
  id: "monthly_leads_by_source",
  title: "月次リード数（流入元別）",
  type: "bar",              // bar / line / pie / table など
  dataKey: "leads_by_source_monthly",  // dashboard_data.json内のキー
  groupBy: "lead_channel",
  section: "展示会・リード",  // ダッシュボード内のセクション見出し
}
```

- **グラフを追加して** → 配列に1オブジェクト追加
- **グラフを削除して** → 該当オブジェクトを削除
- **集計軸を変えて** → `groupBy` を変更

個別チャートをハードコードして増やしていく作りにしない。新しい種類の集計が必要な場合は `dashboard_data.json` 側にキーを追加し、`build_data.py` 側の集約ロジックを拡張する。

## 現在のステータス

- [x] 1. リポジトリ初期化（ディレクトリ構成、.gitignore、README）
- [ ] 2. `data/connectors/sheets.py` — HubSpot集計シート接続（シートID・タブ名要確認）
- [ ] 3. `data/connectors/ga4.py` — GA4 Data API疎通確認（プロパティID・認証方法要確認）
- [ ] 4. `data/connectors/google_ads.py` — Google Ads API疎通確認（Developer Token・顧客ID要確認）
- [x] 5. ダミーデータで `site/index.html` の画面・グラフ構成の枠を作成（実データ接続と並行で進行中）
- [ ] 6. `update.command` の作成

現在、`data/connectors/*.py` はダミーデータを返すスタブ。実APIに接続する際はこのファイルの中身だけを差し替え、`build_data.py`側のインターフェースは変えない。

## 載せるべき指標（たたき台。要確定）

- 展示会：出展ごとのリード数（A/B/C/D別）、リードからの商談化率、費用対リード単価
- HP：GA4のセッション数・PV数（月次推移）、流入元別（自然検索/広告/直接等）
- Google広告：キャンペーン別費用・クリック・CV数・CPA（月次）
- CRM：パイプラインステージ別の件数・金額（現在のスナップショット）、月次の新規商談数、成約率
- 統合：チャネル別（展示会/HP/広告/紹介）の商談化率・成約率の比較

## 認証・秘匿情報

- Google Sheets API、GA4 Data API、Google Ads APIの認証情報（サービスアカウントJSON、OAuthトークン、Developer Token等）は**すべて `.env` または `secrets/` に置き、gitignoreする**。コード中にハードコードしない。
- 展示会自動化（expo系スクリプト）と同じサービスアカウントを使い回せるか確認してから、新規発行するか判断する。

## 未確定事項（作業前にKengoさんに確認）

- HubSpot集計スプレッドシートのURL・シート名・列構成
- 展示会費用スプレッドシートのURL
- GA4のプロパティID、Google Cloudプロジェクトでのアクセス権設定状況
- Google広告のCID（顧客ID）、Developer Token、MCC構成の有無
- 週次自動更新にするタイミング（クラウドスケジュールタスク or ローカルcron）
