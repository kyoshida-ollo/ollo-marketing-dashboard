// タブ・期間フィルタ付きダッシュボード描画エンジン。
// ページ・グラフの構成は charts/charts.js を、データは ../data/dashboard_data.js を編集する。
// このファイルは描画の仕組みなので、グラフの追加・削除では通常触らない。

let activePage = null;
let periodRange = [0, 0]; // summary_monthly.months のインデックス範囲 [from, to]
const liveCharts = [];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// 施策カテゴリの色は固定割り当て（フィルタや並び順で色が変わらないように）
const CHANNEL_SLOT = { "展示会": 1, "HP": 2, "Google広告": 3, "紹介": 5 };

function seriesColor(name, index) {
  const slot = CHANNEL_SLOT[name] ?? (index % 8) + 1;
  return cssVar(`--series-${slot}`);
}

function paletteColor(index) {
  return cssVar(`--series-${(index % 8) + 1}`);
}

function fmt(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return "−";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "currency":
      return `¥${Math.round(value).toLocaleString("ja-JP")}`;
    case "number":
      return value.toLocaleString("ja-JP");
    default:
      return typeof value === "number" ? value.toLocaleString("ja-JP") : String(value);
  }
}

// KPIカード・軸目盛り用の短縮表記（金額は万・億単位に丸める。表とツールチップは全桁のfmtを使う）
function fmtCompact(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return "−";
  if (format === "currency") {
    const abs = Math.abs(value);
    if (abs >= 100000000) return `¥${(value / 100000000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}億`;
    if (abs >= 10000) return `¥${Math.round(value / 10000).toLocaleString("ja-JP")}万`;
  }
  return fmt(value, format);
}

// ---- サマリー指標の定義（summary_kpis / summary_table が参照） ----
// goodDir: 増加が良い指標は "up"、減少が良い指標（費用系）は "down"（前期比の色分けに使う）
const SUMMARY_METRICS = {
  leads:     { label: "新規リード数", format: "number",   goodDir: "up",   get: (t) => t.leads },
  companies: { label: "新規会社数",   format: "number",   goodDir: "up",   get: (t) => t.companies },
  deals:     { label: "商談化数",     format: "number",   goodDir: "up",   get: (t) => t.deals },
  deal_rate: { label: "商談化率",     format: "percent",  goodDir: "up",   get: (t) => (t.leads ? t.deals / t.leads : null) },
  wins:      { label: "受注数",       format: "number",   goodDir: "up",   get: (t) => t.wins },
  win_rate:  { label: "受注率",       format: "percent",  goodDir: "up",   get: (t) => (t.deals ? t.wins / t.deals : null) },
  revenue:   { label: "受注額",       format: "currency", goodDir: "up",   get: (t) => t.revenue },
  avg_deal:  { label: "平均受注単価", format: "currency", goodDir: "up",   get: (t) => (t.wins ? t.revenue / t.wins : null) },
  cost:      { label: "広告費",       format: "currency", goodDir: "down", get: (t) => t.cost },
  cpl:       { label: "リード単価(CPL)", format: "currency", goodDir: "down", get: (t) => (t.leads && t.cost ? t.cost / t.leads : null) },
  roi:       { label: "ROI",          format: "percent",  goodDir: "up",   get: (t) => (t.cost ? (t.revenue - t.cost) / t.cost : null) },
};

function summaryTotals(channels, range) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const list = channels || sm.channels;
  const [from, to] = range || periodRange;
  const totals = { leads: 0, companies: 0, deals: 0, wins: 0, revenue: 0, cost: 0 };
  for (const key of Object.keys(totals)) {
    for (const ch of list) {
      const arr = sm.metrics[key][ch] || [];
      for (let i = from; i <= to; i++) totals[key] += arr[i] || 0;
    }
  }
  return totals;
}

// 指標の月次系列（スパークライン用）。率系は月ごとに計算する
function monthlyMetricSeries(key) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const total = (k, i) => sm.channels.reduce((s, ch) => s + (sm.metrics[k][ch][i] || 0), 0);
  return sm.months.map((_, i) => {
    switch (key) {
      case "deal_rate": { const l = total("leads", i); return l ? total("deals", i) / l : null; }
      case "win_rate": { const d = total("deals", i); return d ? total("wins", i) / d : null; }
      case "roi": { const c = total("cost", i); return c ? (total("revenue", i) - c) / c : null; }
      case "avg_deal": { const w = total("wins", i); return w ? total("revenue", i) / w : null; }
      case "cpl": { const l = total("leads", i); const c = total("cost", i); return l && c ? c / l : null; }
      default: return total(key, i);
    }
  });
}

// ---- Chart.js 共通オプション ----
function baseOptions(def, seriesCount) {
  const muted = cssVar("--muted");
  const grid = cssVar("--gridline");
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: def.type === "pie" || seriesCount > 1,
        labels: { color: cssVar("--text-secondary"), boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = typeof ctx.raw === "object" && ctx.raw !== null ? ctx.raw.y : ctx.raw;
            const name = ctx.dataset.label || ctx.label;
            const format = ctx.dataset._format !== undefined ? ctx.dataset._format : def.valueFormat;
            return `${name}: ${fmt(v, format)}`;
          },
        },
      },
    },
  };
  if (def.type !== "pie") {
    opts.scales = {
      x: { stacked: !!def.stacked, grid: { display: false }, ticks: { color: muted } },
      y: {
        stacked: !!def.stacked,
        grid: { color: grid },
        ticks: { color: muted, callback: (v) => fmtCompact(v, def.valueFormat) },
      },
    };
    // 率など単位の違う系列を折れ線で重ねる場合は右軸（y2）に載せる
    if (def.y2Format !== undefined) {
      opts.scales.y2 = {
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { color: muted, callback: (v) => fmtCompact(v, def.y2Format) },
      };
    }
  }
  return opts;
}

function datasetStyle(type, color) {
  if (type === "line") {
    return {
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: color,
      tension: 0.15,
      fill: false,
    };
  }
  return { backgroundColor: color, borderRadius: 4, maxBarThickness: 36 };
}

// 複合グラフ用：fieldTypes で棒/線を、fieldAxes で右軸(y2)を、fieldFormats で値の書式をフィールド単位に指定できる
function fieldDataset(def, field, values, color) {
  const chartType = (def.fieldTypes && def.fieldTypes[field]) || def.type;
  const ds = {
    label: (def.fieldLabels && def.fieldLabels[field]) || field,
    data: values,
    ...datasetStyle(chartType, color),
  };
  if (chartType !== def.type) ds.type = chartType;
  if (chartType === "line") ds.order = 0; // 折れ線を棒の手前に描く
  else ds.order = 1;
  const axis = def.fieldAxes && def.fieldAxes[field];
  if (axis) ds.yAxisID = axis;
  const format = def.fieldFormats && def.fieldFormats[field];
  if (format !== undefined) ds._format = format;
  return ds;
}

function buildChartConfig(def, data) {
  const value = data[def.dataKey];

  if (def.shape === "categorical_fields") {
    const datasets = def.fields.map((field, i) =>
      fieldDataset(def, field, value[field], paletteColor(i))
    );
    return {
      type: def.type,
      data: { labels: value[def.categoryField], datasets },
      options: baseOptions(def, datasets.length),
    };
  }

  if (def.shape === "categorical_series") {
    const names = Object.keys(value[def.seriesField]);
    const datasets = names.map((name, i) => ({
      label: name,
      data: value[def.seriesField][name],
      order: 1,
      ...datasetStyle(def.type, seriesColor(name, i)),
    }));
    // 系列群の上に別フィールドを折れ線などで重ねる（例：ランク積み上げ＋商談化率）
    if (def.overlayFields) {
      def.overlayFields.forEach((field, i) => {
        const ds = fieldDataset(
          { ...def, type: "bar" },
          field,
          value[field],
          paletteColor(names.length + i)
        );
        datasets.push(ds);
      });
    }
    return {
      type: def.type,
      data: { labels: value[def.categoryField], datasets },
      options: baseOptions(def, datasets.length),
    };
  }

  if (def.shape === "flat_map") {
    const labels = Object.keys(value);
    const options = baseOptions(def, def.type === "pie" ? 2 : 1);
    if (def.type === "pie") {
      options.cutout = "58%";
      options.plugins.legend.position = "right";
    }
    return {
      type: def.type === "pie" ? "doughnut" : def.type,
      data: {
        labels,
        datasets: [{
          data: Object.values(value),
          backgroundColor: labels.map((_, i) => paletteColor(i)),
          borderRadius: def.type === "bar" ? 4 : 0,
          maxBarThickness: 36,
        }],
      },
      options,
    };
  }

  if (def.shape === "object_array") {
    const rows = value;
    const datasets = def.fields.map((field, i) =>
      fieldDataset(def, field, rows.map((r) => r[field]), paletteColor(i))
    );
    return {
      type: def.type,
      data: { labels: rows.map((r) => r[def.labelField]), datasets },
      options: baseOptions(def, datasets.length),
    };
  }

  return null;
}

// ---- 各要素タイプの描画 ----
function makeCard(title, wide) {
  const card = document.createElement("div");
  card.className = wide ? "card wide" : "card";
  if (title) {
    const h = document.createElement("h3");
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}

// KPIカード内の小さな月次推移グラフ
function sparkline(values) {
  const wrap = document.createElement("div");
  wrap.className = "sparkline";
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  liveCharts.push(new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: values.map((_, i) => i),
      datasets: [{
        data: values,
        borderColor: cssVar("--series-1"),
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  }));
  return wrap;
}

// 前期比チップ。率系はptの増減、その他は%の増減で表示
function deltaChip(cur, prev, format, goodDir, titleText) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null;
  const span = document.createElement("span");
  span.className = "delta";
  if (titleText) span.title = titleText;
  let diff;
  let text;
  if (format === "percent") {
    diff = cur - prev;
    text = `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt`;
  } else {
    if (!prev) return null;
    diff = (cur - prev) / prev;
    text = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff * 100).toFixed(1)}%`;
  }
  if (Math.abs(diff) < 1e-9) {
    span.classList.add("flat");
  } else {
    const isGood = diff > 0 ? goodDir !== "down" : goodDir === "down";
    span.classList.add(isGood ? "good" : "bad");
  }
  span.textContent = text;
  return span;
}

function kpiCell(label, value, format, { delta, trend } = {}) {
  const cell = document.createElement("div");
  cell.className = "kpi-cell";
  const labelEl = document.createElement("div");
  labelEl.className = "kpi-label";
  labelEl.textContent = label;
  const row = document.createElement("div");
  row.className = "kpi-value-row";
  const valueEl = document.createElement("span");
  valueEl.className = "kpi-value";
  valueEl.textContent = fmtCompact(value, format);
  valueEl.title = fmt(value, format);
  row.appendChild(valueEl);
  if (delta) row.appendChild(delta);
  cell.appendChild(labelEl);
  cell.appendChild(row);
  if (trend && trend.some((v) => v !== null && v !== undefined)) {
    cell.appendChild(sparkline(trend));
  }
  return cell;
}

function renderSummaryKpis(def) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const totals = summaryTotals(null);
  const [from, to] = periodRange;
  const len = to - from + 1;
  const prevRange = from - len >= 0 ? [from - len, from - 1] : null;
  const prevTotals = prevRange ? summaryTotals(null, prevRange) : null;
  const deltaTitle = prevRange
    ? `前期間（${sm.months[prevRange[0]]}〜${sm.months[prevRange[1]]}）比`
    : null;

  const card = makeCard(null, true);
  const grid = document.createElement("div");
  grid.className = "kpi-grid";
  for (const key of def.metrics) {
    const m = SUMMARY_METRICS[key];
    const cur = m.get(totals);
    const delta = prevTotals
      ? deltaChip(cur, m.get(prevTotals), m.format, m.goodDir, deltaTitle)
      : null;
    grid.appendChild(kpiCell(m.label, cur, m.format, { delta, trend: monthlyMetricSeries(key) }));
  }
  card.appendChild(grid);
  return card;
}

function renderKpiRow(def, data) {
  const card = makeCard(null, true);
  const grid = document.createElement("div");
  grid.className = "kpi-grid";
  for (const item of data[def.dataKey]) {
    grid.appendChild(kpiCell(item.label, item.value, item.format, { trend: item.trend }));
  }
  card.appendChild(grid);
  return card;
}

// ファネル（リード→会社→商談→受注）。バー幅は最大段に対する比率、前段階比の転換率を右に表示
function renderFunnel(def) {
  const t = summaryTotals(null);
  const stages = [
    { label: "リード", value: t.leads },
    { label: "新規会社", value: t.companies },
    { label: "商談化", value: t.deals },
    { label: "受注", value: t.wins },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  const card = makeCard(def.title, false);
  const funnel = document.createElement("div");
  funnel.className = "funnel";
  stages.forEach((stage, i) => {
    const row = document.createElement("div");
    row.className = "funnel-row";
    const conv = i > 0 && stages[i - 1].value
      ? `前段階比 ${fmt(stage.value / stages[i - 1].value, "percent")}`
      : "";
    row.innerHTML = `
      <div class="funnel-label">${stage.label}</div>
      <div class="funnel-track">
        <div class="funnel-bar funnel-bar-${i + 1}" style="width:${(stage.value / max) * 100}%">
          <span class="funnel-count">${fmt(stage.value, "number")}</span>
        </div>
      </div>
      <div class="funnel-conv">${conv}</div>
    `;
    funnel.appendChild(row);
  });
  card.appendChild(funnel);
  return card;
}

// リード構成比ドーナツ（指定期間・施策別）
function renderChannelMix(def) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const counts = sm.channels.map((ch) => summaryTotals([ch]).leads);
  const total = counts.reduce((a, b) => a + b, 0);
  const card = makeCard(def.title, false);
  const wrapEl = document.createElement("div");
  wrapEl.className = "chart-wrap";
  wrapEl.style.height = "240px";
  wrapEl.innerHTML = "<canvas></canvas>";
  card.appendChild(wrapEl);
  liveCharts.push(new Chart(wrapEl.querySelector("canvas").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: sm.channels,
      datasets: [{
        data: counts,
        backgroundColor: sm.channels.map((ch, i) => seriesColor(ch, i)),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "right", labels: { color: cssVar("--text-secondary"), boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const share = total ? ` (${fmt(ctx.raw / total, "percent")})` : "";
              return `${ctx.label}: ${fmt(ctx.raw, "number")}件${share}`;
            },
          },
        },
      },
    },
  }));
  return card;
}

// データから機械的に導いたハイライト（指定期間ベース）
function renderInsights(def) {
  const data = window.DASHBOARD_DATA;
  const sm = data.summary_monthly;
  const items = [];

  let bestRoi = null;
  let topLeads = null;
  for (const ch of sm.channels) {
    const t = summaryTotals([ch]);
    if (t.cost) {
      const roi = (t.revenue - t.cost) / t.cost;
      if (!bestRoi || roi > bestRoi.roi) bestRoi = { ch, roi };
    }
    if (!topLeads || t.leads > topLeads.leads) topLeads = { ch, leads: t.leads };
  }
  const all = summaryTotals(null);
  if (bestRoi) {
    items.push(`広告費対効果が最も高い施策は<strong>${bestRoi.ch}</strong>（ROI ${fmt(bestRoi.roi, "percent")}）。`);
  }
  if (topLeads && all.leads) {
    items.push(`リード獲得の最大チャネルは<strong>${topLeads.ch}</strong>（全体の${fmt(topLeads.leads / all.leads, "percent")}）。`);
  }
  const rising = (data.ga_rising_referrers || [])[0];
  if (rising && rising.growth > 0.2) {
    items.push(`参照元<strong>${rising.referrer}</strong>からのHP流入が前月比${fmt(rising.growth, "percent")}増と急上昇中。`);
  }

  const card = makeCard(def.title, true);
  const list = document.createElement("ul");
  list.className = "insights";
  for (const text of items) {
    const li = document.createElement("li");
    li.innerHTML = text;
    list.appendChild(li);
  }
  card.appendChild(list);
  return card;
}

function renderSummaryTable(def) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const card = makeCard(null, true);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const cols = def.metrics.map((key) => SUMMARY_METRICS[key]);

  let html = "<table><thead><tr><th>施策</th>";
  for (const c of cols) html += `<th class="num">${c.label}</th>`;
  html += "</tr></thead><tbody>";
  for (const ch of sm.channels) {
    const t = summaryTotals([ch]);
    html += `<tr><td>${ch}</td>`;
    for (const c of cols) html += `<td class="num">${fmt(c.get(t), c.format)}</td>`;
    html += "</tr>";
  }
  const all = summaryTotals(null);
  html += `<tr class="total-row"><td>合計</td>`;
  for (const c of cols) html += `<td class="num">${fmt(c.get(all), c.format)}</td>`;
  html += "</tr></tbody></table>";

  wrap.innerHTML = html;
  card.appendChild(wrap);
  return card;
}

// 列見出しクリックでソートできる表
function renderTable(def, data) {
  const rows = data[def.dataKey];
  const card = makeCard(def.title, true);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const isNum = (format) => format === "number" || format === "currency" || format === "percent";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const tbody = document.createElement("tbody");
  let sortKey = null;
  let sortDir = 1;

  const renderBody = () => {
    const sorted = [...rows];
    if (sortKey) {
      sorted.sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return (va < vb ? -1 : 1) * sortDir;
      });
    }
    tbody.innerHTML = sorted
      .map((row) =>
        `<tr>${def.columns
          .map((col) => `<td class="${isNum(col.format) ? "num" : ""}">${fmt(row[col.key], col.format)}</td>`)
          .join("")}</tr>`
      )
      .join("");
  };

  for (const col of def.columns) {
    const th = document.createElement("th");
    th.className = `sortable ${isNum(col.format) ? "num" : ""}`;
    th.textContent = col.label;
    th.addEventListener("click", () => {
      if (sortKey === col.key) {
        sortDir = -sortDir;
      } else {
        sortKey = col.key;
        sortDir = isNum(col.format) ? -1 : 1; // 数値列は初回クリックで降順
      }
      headRow.querySelectorAll("th").forEach((el) => el.classList.remove("sorted-asc", "sorted-desc"));
      th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
      renderBody();
    });
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  renderBody();
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

// summary_monthly の複数指標を全施策合計で1つの複合グラフにまとめる
// def.metrics: [{key, label, chart: "bar"|"line", axis?, format?}]
function renderMonthlyMixed(def) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const monthlyTotal = (metricKey) =>
    sm.months.map((_, i) =>
      sm.channels.reduce((sum, ch) => sum + (sm.metrics[metricKey][ch][i] || 0), 0)
    );
  const datasets = def.metrics.map((m, i) => {
    const ds = {
      label: m.label,
      data: monthlyTotal(m.key),
      order: m.chart === "line" ? 0 : 1,
      ...datasetStyle(m.chart, paletteColor(i)),
    };
    if (m.chart !== "bar") ds.type = m.chart;
    if (m.axis) ds.yAxisID = m.axis;
    if (m.format !== undefined) ds._format = m.format;
    return ds;
  });
  // 目標値（data.targets の系列）を破線の折れ線で重ねる
  if (def.targets) {
    const targetsData = window.DASHBOARD_DATA.targets || {};
    for (const target of def.targets) {
      if (!targetsData[target.field]) continue;
      datasets.push({
        label: target.label,
        data: targetsData[target.field],
        type: "line",
        order: 0,
        borderColor: cssVar("--muted"),
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      });
    }
  }
  const card = makeCard(def.title, def.wide !== false);
  const wrapEl = document.createElement("div");
  wrapEl.className = "chart-wrap";
  wrapEl.style.height = "280px";
  wrapEl.innerHTML = "<canvas></canvas>";
  card.appendChild(wrapEl);
  const config = {
    type: "bar",
    data: { labels: sm.months, datasets },
    options: baseOptions({ ...def, type: "bar" }, datasets.length),
  };
  liveCharts.push(new Chart(wrapEl.querySelector("canvas").getContext("2d"), config));
  return card;
}

function renderMonthlyStacked(def) {
  const sm = window.DASHBOARD_DATA.summary_monthly;
  const metricData = sm.metrics[def.metric];
  const chartDef = { ...def, type: "bar", stacked: true };
  const datasets = sm.channels.map((ch, i) => ({
    label: ch,
    data: metricData[ch],
    ...datasetStyle("bar", seriesColor(ch, i)),
  }));
  const card = makeCard(def.title, false);
  const wrapEl = document.createElement("div");
  wrapEl.className = "chart-wrap";
  wrapEl.style.height = "240px";
  wrapEl.innerHTML = "<canvas></canvas>";
  card.appendChild(wrapEl);
  const config = {
    type: "bar",
    data: { labels: sm.months, datasets },
    options: baseOptions(chartDef, datasets.length),
  };
  liveCharts.push(new Chart(wrapEl.querySelector("canvas").getContext("2d"), config));
  return card;
}

function renderChartCard(def, data) {
  const card = makeCard(def.title, false);
  const wrapEl = document.createElement("div");
  wrapEl.className = "chart-wrap";
  wrapEl.style.height = def.type === "pie" ? "260px" : "240px";
  wrapEl.innerHTML = "<canvas></canvas>";
  card.appendChild(wrapEl);
  const config = buildChartConfig(def, data);
  if (config) {
    liveCharts.push(new Chart(wrapEl.querySelector("canvas").getContext("2d"), config));
  }
  return card;
}

function renderDef(def) {
  const data = window.DASHBOARD_DATA;
  switch (def.type) {
    case "summary_kpis":
      return renderSummaryKpis(def);
    case "summary_table":
      return renderSummaryTable(def);
    case "monthly_stacked":
      return renderMonthlyStacked(def);
    case "monthly_mixed":
      return renderMonthlyMixed(def);
    case "funnel":
      return renderFunnel(def);
    case "channel_mix":
      return renderChannelMix(def);
    case "insights":
      return renderInsights(def);
    case "kpi_row":
      if (!(def.dataKey in data)) break;
      return renderKpiRow(def, data);
    case "table":
      if (!(def.dataKey in data)) break;
      return renderTable(def, data);
    default:
      if (!(def.dataKey in data)) break;
      return renderChartCard(def, data);
  }
  console.warn(`dashboard_data.json に "${def.dataKey}" がありません（id: ${def.id}）`);
  return null;
}

// ---- ページ描画・タブ・期間フィルタ ----
function renderPage() {
  liveCharts.splice(0).forEach((c) => c.destroy());
  const root = document.getElementById("dashboard-root");
  root.innerHTML = "";

  const defs = window.CHART_DEFS.filter((d) => d.page === activePage);
  const sectionOrder = [];
  const bySection = new Map();
  for (const def of defs) {
    if (!bySection.has(def.section)) {
      bySection.set(def.section, []);
      sectionOrder.push(def.section);
    }
    bySection.get(def.section).push(def);
  }

  for (const section of sectionOrder) {
    const sec = document.createElement("section");
    sec.className = "section";
    if (section) sec.innerHTML = `<h2>${section}</h2>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const def of bySection.get(section)) {
      const el = renderDef(def);
      if (el) grid.appendChild(el);
    }
    sec.appendChild(grid);
    root.appendChild(sec);
  }
}

function showPage(page) {
  activePage = page;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  // 期間フィルタはサマリーページのKPI・表にのみ効く
  document.getElementById("period-bar").style.display = page === "サマリー" ? "" : "none";
  renderPage();
}

function initPeriodFilter(months) {
  const from = document.getElementById("period-from");
  const to = document.getElementById("period-to");
  for (const sel of [from, to]) {
    months.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = m;
      sel.appendChild(opt);
    });
  }
  from.value = 0;
  to.value = months.length - 1;
  periodRange = [0, months.length - 1];

  const onChange = () => {
    let a = Number(from.value);
    let b = Number(to.value);
    if (a > b) [a, b] = [b, a];
    periodRange = [a, b];
    if (activePage === "サマリー") renderPage();
  };
  from.addEventListener("change", onChange);
  to.addEventListener("change", onChange);
}

function init() {
  const data = window.DASHBOARD_DATA;

  const metaEl = document.getElementById("meta");
  if (data.meta) {
    const generated = new Date(data.meta.generated_at).toLocaleString("ja-JP");
    const badge = data.meta.source === "dummy" ? '<span class="badge">ダミーデータ表示中</span>' : "";
    metaEl.innerHTML = `${data.meta.fiscal_year || ""}　更新日時: ${generated} ${badge}`;
  }

  const pages = [...new Set(window.CHART_DEFS.map((d) => d.page))];
  const nav = document.getElementById("tab-nav");
  for (const page of pages) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.page = page;
    btn.textContent = page;
    btn.addEventListener("click", () => showPage(page));
    nav.appendChild(btn);
  }

  initPeriodFilter(data.summary_monthly.months);
  showPage(pages[0]);
}

document.addEventListener("DOMContentLoaded", init);
