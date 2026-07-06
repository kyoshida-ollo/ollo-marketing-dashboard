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
│   ├── index.html          ← ダッシュボード本体（タブナビ・期間フィルタのガワとCSS）
│   ├── dashboard.js        ← 描画エンジン（タブ・期間フィルタ・KPIカード・表・Chart.js描画）
│   └── charts/
│       └── charts.js       ← ページ・グラフ・表・KPIの定義一覧（1要素=1オブジェクト）
├── update.command          ← ダブルクリックでデータ更新→ブラウザ表示（Mac用）
└── README.md
```

## ダッシュボードの構成（4ページのタブ切り替え）

1. **サマリー** — 主要KPIカード（前期間比デルタ＋スパークライン付き。指標: リード/会社/商談化/商談化率/受注/受注額/平均受注単価/広告費/CPL/ROI）、自動ハイライト、マーケティングファネル＋リード構成比ドーナツ、施策別サマリー表（いずれも対象期間フィルタ連動）、FY26月次推移（全体複合グラフ＋リード目標破線、施策別積み上げ）、生データ表（受注案件・商談化・施策一覧。列見出しクリックでソート可）
2. **展示会** — KPIカード、月次推移（複合）、展示会ごとの比較（ランク積み上げ＋商談化率右軸、受注数＋受注率右軸、リード単価）
3. **HP問い合わせ** — KPIカード、月次推移（複合）、CV数・CV率、問い合わせ内容の内訳（きっかけ・都道府県）、HPアクセス分析（流入元別・参照リンク元別の月次推移、急上昇参照元、人気ページ、デバイス・新規/リピーター、Search Console検索キーワード）
4. **Google広告** — KPIカード、月次推移（費用＋CV複合・CPA）、キーワード分析、CV内容の内訳

複合グラフは `fieldTypes: {field: "line"}` で系列単位に折れ線化し、率など単位が違う系列は `fieldAxes: {field: "y2"}` ＋ `y2Format` で右軸に載せる。

年度はFY26 = 2025-07〜2026-06。対象期間フィルタはサマリーページのKPIカードと施策別サマリー表にのみ効く。

## グラフ定義の設計方針（ここが「Claudeが指示で編集できる」の要）

`site/charts/charts.js` に配列で定義を並べる。1要素=1オブジェクトで、`page`（タブ名）と `section`（ページ内見出し）で配置が決まる：

```js
{
  id: "expo_conv_rate",
  page: "展示会",
  section: "展示会ごとの比較",
  type: "bar",              // bar / line / pie / kpi_row / table / summary_kpis / summary_table / monthly_stacked
  shape: "categorical_fields",  // データ形状（charts.js冒頭のコメント参照）
  title: "商談化率",
  dataKey: "expo_by_expo",  // dashboard_data.json内のキー
  categoryField: "expos",
  fields: ["conv_rate"],
  valueFormat: "percent",   // percent / currency / number
}
```

- **グラフを追加して** → 配列に1オブジェクト追加
- **グラフを削除して** → 該当オブジェクトを削除
- **集計軸を変えて** → `categoryField` / `seriesField` / `fields` を変更

個別チャートをハードコードして増やしていく作りにしない。新しい種類の集計が必要な場合は `build_data.py`（＋コネクタ）側でJSONにキーを追加してから定義を足す。描画の仕組み自体を変えるときだけ `site/dashboard.js` を触る。

サマリー系（`summary_kpis` / `summary_table` / `monthly_stacked`）は `summary_monthly` キー
（`{months, channels, metrics: {leads/companies/deals/wins/revenue/cost: {施策名: [月次値×12]}}}`）から計算される。
商談化率・受注率・ROIなどの率はJS側で導出するので、JSONには実数だけを入れる。

## 現在のステータス

- [x] 1. リポジトリ初期化（ディレクトリ構成、.gitignore、README）
- [x] 2. `data/connectors/sheets.py` — 施策集計シート接続済み（実データ）
- [ ] 3. `data/connectors/ga4.py` — GA4 Data API疎通確認（プロパティID・認証方法要確認）→ ダミーのまま
- [ ] 4. `data/connectors/google_ads.py` — キーワード分析のみ担当（Developer Token・顧客ID要確認）→ ダミーのまま
- [x] 5. ダミーデータで `site/index.html` の画面・グラフ構成の枠を作成（4ページ構成にリニューアル済み）
- [x] 6. `update.command` の作成

### データソースの実態（2026-07時点）

- **実データ**: 施策実績（リード・商談化・受注・費用・予想リード=目標）。ソースはスプレッドシート
  「LookerStudio_data」（ID: `1kaNNLhxanVi8LwvlWvMYKArBlV3H19dMHAsS8xPhuUk`）の `expense_lead` タブ。
  カテゴリは 展示会/ウェビナー/HP/Google広告 の4種。展示会リードランクはA/B/Cの3段階。
  **「新規会社数」はデータソースに存在しない**ので画面からも外してある。
- **取得経路**（`sheets.py`が上から順に試す）: ①サービスアカウント（`.env`の`GOOGLE_SERVICE_ACCOUNT_JSON`、
  シートをSAメールに共有要）→ ②公開CSV → ③ローカルキャッシュ `data/cache/expense_lead.csv`（gitignore済み）。
  ①②成功時にキャッシュ自動更新。現状は認証未設定のためキャッシュで動いている。
- **ダミーのまま**（`build_data.py`が`_dummy_keys`に列挙し、画面に「ダミー」チップが付く）:
  GA4系全部・Search Consoleキーワード・広告キーワード分析・HubSpot取引明細（受注/商談一覧）・
  HP問い合わせ内訳（きっかけ/都道府県）。ダミー関数は `connectors/pending_dummy.py`・`ga4.py`・`google_ads.py`。

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
