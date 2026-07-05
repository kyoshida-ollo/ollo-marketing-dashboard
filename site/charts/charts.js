// グラフ定義一覧。1グラフ=1オブジェクト。
//
// 「グラフを追加して」→ 配列に1オブジェクト追加
// 「グラフを削除して」→ 該当オブジェクトを削除
// 「集計軸を変えて」→ categoryField / seriesField / metric を変更
//
// shape の意味（dashboard_data.json 内の値の形に対応）:
//   "categorical_fields"        { <categoryField>: [...], <field1>: [...], <field2>: [...] }
//   "categorical_series"        { <categoryField>: [...], <seriesField>: { seriesName: [...] } }
//   "categorical_nested_series" { <categoryField>: [...], <seriesField>: { seriesName: { <metric>: [...] } } }
//   "flat_map"                  { key: value, ... }
//   "stat"                      単一の数値
window.CHART_DEFS = [
  // --- 展示会・リード ---
  {
    id: "leads_by_expo_monthly",
    title: "月次リード数（展示会別）",
    type: "bar",
    shape: "categorical_series",
    dataKey: "leads_by_expo_monthly",
    categoryField: "months",
    seriesField: "series",
    section: "展示会・リード",
  },
  {
    id: "expo_conversion_rate",
    title: "展示会別 商談化率",
    type: "bar",
    shape: "flat_map",
    dataKey: "expo_conversion_rate",
    valueFormat: "percent",
    section: "展示会・リード",
  },
  {
    id: "expo_cost_per_lead",
    title: "展示会別 リード単価",
    type: "bar",
    shape: "flat_map",
    dataKey: "expo_cost_per_lead",
    valueFormat: "currency",
    section: "展示会・リード",
  },

  // --- HP ---
  {
    id: "hp_sessions_pv_monthly",
    title: "セッション数・PV数（月次推移）",
    type: "line",
    shape: "categorical_fields",
    dataKey: "hp_sessions_pv_monthly",
    categoryField: "months",
    fields: ["sessions", "pageviews"],
    fieldLabels: { sessions: "セッション数", pageviews: "PV数" },
    section: "HP",
  },
  {
    id: "hp_traffic_by_channel",
    title: "流入元別セッション数",
    type: "pie",
    shape: "flat_map",
    dataKey: "hp_traffic_by_channel",
    section: "HP",
  },

  // --- Google広告 ---
  {
    id: "ads_campaign_cost_monthly",
    title: "キャンペーン別費用（月次）",
    type: "bar",
    shape: "categorical_nested_series",
    dataKey: "ads_campaign_monthly",
    categoryField: "months",
    seriesField: "campaigns",
    metric: "cost",
    valueFormat: "currency",
    section: "Google広告",
  },
  {
    id: "ads_campaign_cpa_monthly",
    title: "キャンペーン別CPA（月次）",
    type: "line",
    shape: "categorical_nested_series",
    dataKey: "ads_campaign_monthly",
    categoryField: "months",
    seriesField: "campaigns",
    metric: "cpa",
    valueFormat: "currency",
    section: "Google広告",
  },

  // --- CRM ---
  {
    id: "crm_pipeline_counts",
    title: "パイプラインステージ別 件数",
    type: "bar",
    shape: "categorical_fields",
    dataKey: "crm_pipeline_snapshot",
    categoryField: "stages",
    fields: ["counts"],
    fieldLabels: { counts: "件数" },
    section: "CRM",
  },
  {
    id: "crm_pipeline_amounts",
    title: "パイプラインステージ別 金額",
    type: "bar",
    shape: "categorical_fields",
    dataKey: "crm_pipeline_snapshot",
    categoryField: "stages",
    fields: ["amounts"],
    fieldLabels: { amounts: "金額" },
    valueFormat: "currency",
    section: "CRM",
  },
  {
    id: "crm_new_deals_monthly",
    title: "月次新規商談数",
    type: "line",
    shape: "categorical_fields",
    dataKey: "crm_new_deals_monthly",
    categoryField: "months",
    fields: ["counts"],
    fieldLabels: { counts: "新規商談数" },
    section: "CRM",
  },
  {
    id: "crm_win_rate",
    title: "成約率",
    type: "stat",
    shape: "stat",
    dataKey: "crm_win_rate",
    valueFormat: "percent",
    section: "CRM",
  },

  // --- 統合 ---
  {
    id: "channel_comparison",
    title: "チャネル別 商談化率・成約率比較",
    type: "bar",
    shape: "categorical_fields",
    dataKey: "channel_comparison",
    categoryField: "channels",
    fields: ["conversion_rate", "win_rate"],
    fieldLabels: { conversion_rate: "商談化率", win_rate: "成約率" },
    valueFormat: "percent",
    section: "統合",
  },
];
