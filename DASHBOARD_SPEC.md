# ollo-dashboard 仕様書（Claude Code 引き継ぎ用）

このファイルをClaude Codeが最初に読む前提。ここに書かれた設計方針で実装を進めてよい（大きく変える場合は先に相談）。

## 目的

営業・マーケの月次MTGで使う報告用ダッシュボードを作る。現状Looker Studioで見ているGA4・Google広告のデータと、
スプレッドシートに集約しているHubSpot・展示会費用のデータを1つの画面にまとめ、**Claudeへの指示だけでグラフの追加・削除・変更ができる**ようにする。
Looker Studioは廃止し、これで完全に置き換える。

## 全体アーキテクチャ

```
[HubSpotデータ]──┐
(スプレッドシート、既存の集計方法を維持)
                  ├─→ data/build_data.py が集約 → data/dashboard_data.json
[展示会費用等]────┘     （手入力スプレッドシート、既存のまま）
[GA4]─────────────→ Google Analytics Data API から直接取得（スプレッドシート経由にしない）
[Google広告]──────→ Google Ads API から直接取得（スプレッドシート経由にしない）
                  ↓
     dashboard_data.json（軽量な集計済みJSON。生ログは持たない）
                  ↓
     index.html（静的1ページ、Chart.jsでグラフ描画。JSONを読むだけ）
```

理由：
- HubSpot・展示会費用は既存のスプレッドシート運用を崩さない（変更コストが高い割にメリットが薄い）
- GA4・Google広告は件数が多くスプレッドシートに書くと重くなるため、APIから直接取得して**集計済みの数値だけ**をJSONに落とす（生イベントは保存しない）
- ダッシュボードはサーバー不要の静的HTML。社内利用のみなのでホスティングは不要、ローカルでファイルを開く運用でよい
- 更新は「更新ボタン」＝ `build_data.py` を実行してJSONを作り直す（初期は手動実行、後で週次自動化）
- Looker Studioにはダッシュボード編集の汎用APIが無い（レポート一覧取得・権限管理・テンプレートからの新規作成のみ）ため、Claudeが指示でグラフを増減できる要件を満たせない。よってこの自前構成に置き換える

## ディレクトリ構成（提案）

```
ollo-dashboard/
├── CLAUDE.md              ← Claude Code用のコンテキスト（本ファイルの要点＋認証情報の置き場所ルール）
├── data/
│   ├── build_data.py      ← HubSpotスプレッドシート＋GA4 API＋Google Ads APIを集約 → dashboard_data.json
│   ├── connectors/
│   │   ├── sheets.py      ← Google Sheets APIでHubSpot集計シート・費用シートを読む
│   │   ├── ga4.py         ← Google Analytics Data APIラッパー
│   │   └── google_ads.py  ← Google Ads APIラッパー
│   └── dashboard_data.json ← 生成物（gitには入れるが手で編集しない）
├── site/
│   ├── index.html         ← ダッシュボード本体（Chart.js、日本語UI）
│   └── charts/             ← グラフ定義（1グラフ=1つの小さな設定オブジェクト。追加・削除しやすい構造にする）
├── update.command          ← ダブルクリックで build_data.py 実行→index.htmlをブラウザで開く（Mac用）
└── README.md
```

## グラフ定義の設計方針（ここが「Claudeが指示で編集できる」の要）

`site/charts/` 配下に、1グラフ1ファイル（またはJS配列内の1オブジェクト）で以下を定義する形にする：

```js
{
  id: "monthly_leads_by_source",
  title: "月次リード数（流入元別）",
  type: "bar",           // bar / line / pie / table など
  dataKey: "leads_by_source_monthly",  // dashboard_data.json内のキー
  groupBy: "lead_channel",
  section: "展示会・リード"  // ダッシュボード内のセクション見出し
}
```

これにより「グラフを追加して」＝新しいオブジェクトを1つ足す、「削除して」＝1つ消す、「集計軸を変えて」＝`groupBy`を変える、で対応できる。ハードコードした個別チャートを増やしていく作りにしない。

## 載せるべき指標（たたき台。初回セッションで確定させる）

- 展示会：出展ごとのリード数（A/B/C/D別）、リードからの商談化率、費用対リード単価
- HP：GA4のセッション数・PV数（月次推移）、流入元別（自然検索/広告/直接等）
- Google広告：キャンペーン別費用・クリック・CV数・CPA（月次）
- CRM：パイプラインステージ別の件数・金額（現在のスナップショット）、月次の新規商談数、成約率
- 統合：チャネル別（展示会/HP/広告/紹介）の商談化率・成約率の比較

## 認証・秘匿情報

- Google Sheets API、GA4 Data API、Google Ads API の認証情報（サービスアカウントJSON、OAuthトークン、Developer Token等）は**すべて `.env` または `secrets/` に置き、gitignoreする**
- 展示会自動化（expo系スクリプト）と同じサービスアカウントを使い回せるか確認してから、新規発行するか判断する

## 初回セッションでClaude Codeにやってほしいこと

1. 上記ディレクトリ構成でリポジトリを初期化（git init、.gitignore、README）
2. `data/connectors/sheets.py`：既存のHubSpot集計スプレッドシートを読めるようにする（シートIDとタブ名はKengoさんに確認）
3. `data/connectors/ga4.py`：GA4 Data APIでセッション数・流入元別数値を取得できるか疎通確認（GA4プロパティID・認証方法の確認が先に必要）
4. `data/connectors/google_ads.py`：同様にGoogle Ads APIの疎通確認（Developer Token・顧客IDが必要）
5. 上記が揃うまでは、ダミーデータで `site/index.html` の見た目とグラフ構成の枠を先に作ってしまい、実データ接続と並行で進める
6. `update.command` の作成（Macでダブルクリック→データ更新→ブラウザ表示）

## 未確定事項（Claude Codeのセッション内でKengoさんに確認すること）

- HubSpot集計スプレッドシートのURL・シート名・列構成
- 展示会費用スプレッドシートのURL
- GA4のプロパティID、Google Cloudプロジェクトでのアクセス権設定状況
- Google広告のCID（顧客ID）、Developer Token、MCC構成の有無
- 週次自動更新にするタイミング（Claude Codeのクラウドスケジュールタスク or ローカルcronを使うか）
