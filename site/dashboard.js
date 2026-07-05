// dashboard_data.js (window.DASHBOARD_DATA) と charts.js (window.CHART_DEFS) を読み、
// セクションごとにグラフを描画する。グラフ定義自体はここではなく charts.js を編集する。

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getCategoricalColors() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cssVar(`--series-${n}`));
}

function formatValue(value, format) {
  if (value === null || value === undefined) return "-";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "currency":
      return `¥${Math.round(value).toLocaleString("ja-JP")}`;
    default:
      return value.toLocaleString("ja-JP");
  }
}

function baseOptions(def) {
  const muted = cssVar("--muted");
  const gridline = cssVar("--gridline");
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: cssVar("--text-secondary"), boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = Array.isArray(ctx.raw) ? ctx.raw[1] : ctx.raw;
            return `${ctx.dataset.label ?? ctx.label}: ${formatValue(v, def.valueFormat)}`;
          },
        },
      },
    },
    scales:
      def.type === "pie"
        ? {}
        : {
            x: { grid: { display: false }, ticks: { color: muted } },
            y: {
              grid: { color: gridline },
              ticks: {
                color: muted,
                callback: (v) => formatValue(v, def.valueFormat),
              },
            },
          },
  };
}

function buildDatasetStyle(type, color, index) {
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
  return {
    backgroundColor: color,
    borderRadius: 4,
    maxBarThickness: 36,
  };
}

function buildChartConfig(def, data, colors) {
  const value = data[def.dataKey];

  if (def.shape === "categorical_series") {
    const names = Object.keys(value[def.seriesField]);
    return {
      type: def.type,
      data: {
        labels: value[def.categoryField],
        datasets: names.map((name, i) => ({
          label: name,
          data: value[def.seriesField][name],
          ...buildDatasetStyle(def.type, colors[i % colors.length], i),
        })),
      },
      options: { ...baseOptions(def), plugins: { ...baseOptions(def).plugins, legend: { display: names.length > 1, labels: baseOptions(def).plugins.legend.labels } } },
    };
  }

  if (def.shape === "categorical_nested_series") {
    const names = Object.keys(value[def.seriesField]);
    return {
      type: def.type,
      data: {
        labels: value[def.categoryField],
        datasets: names.map((name, i) => ({
          label: name,
          data: value[def.seriesField][name][def.metric],
          ...buildDatasetStyle(def.type, colors[i % colors.length], i),
        })),
      },
      options: { ...baseOptions(def), plugins: { ...baseOptions(def).plugins, legend: { display: names.length > 1, labels: baseOptions(def).plugins.legend.labels } } },
    };
  }

  if (def.shape === "categorical_fields") {
    const fields = def.fields;
    return {
      type: def.type,
      data: {
        labels: value[def.categoryField],
        datasets: fields.map((field, i) => ({
          label: (def.fieldLabels && def.fieldLabels[field]) || field,
          data: value[field],
          ...buildDatasetStyle(def.type, colors[i % colors.length], i),
        })),
      },
      options: { ...baseOptions(def), plugins: { ...baseOptions(def).plugins, legend: { display: fields.length > 1, labels: baseOptions(def).plugins.legend.labels } } },
    };
  }

  if (def.shape === "flat_map") {
    const labels = Object.keys(value);
    const values = Object.values(value);
    return {
      type: def.type,
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
            borderRadius: def.type === "bar" ? 4 : 0,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        ...baseOptions(def),
        plugins: {
          ...baseOptions(def).plugins,
          legend: { display: def.type === "pie", labels: baseOptions(def).plugins.legend.labels },
        },
      },
    };
  }

  return null;
}

function renderStatCard(def, data) {
  const value = data[def.dataKey];
  const card = document.createElement("div");
  card.className = "card stat-card";
  card.innerHTML = `
    <h3>${def.title}</h3>
    <div class="stat-value">${formatValue(value, def.valueFormat)}</div>
  `;
  return card;
}

function renderChartCard(def, data, colors) {
  const card = document.createElement("div");
  card.className = "card";
  const height = def.type === "pie" ? 260 : 220;
  card.innerHTML = `
    <h3>${def.title}</h3>
    <div class="chart-wrap" style="height:${height}px">
      <canvas></canvas>
    </div>
  `;
  const canvas = card.querySelector("canvas");
  const config = buildChartConfig(def, data, colors);
  if (config) {
    new Chart(canvas.getContext("2d"), config);
  }
  return card;
}

function renderDashboard() {
  const data = window.DASHBOARD_DATA;
  const defs = window.CHART_DEFS;
  const colors = getCategoricalColors();
  const main = document.getElementById("dashboard-root");
  main.innerHTML = "";

  const metaEl = document.getElementById("meta");
  if (data.meta) {
    const generated = new Date(data.meta.generated_at).toLocaleString("ja-JP");
    const dummyBadge = data.meta.source === "dummy" ? '<span class="badge">ダミーデータ表示中</span>' : "";
    metaEl.innerHTML = `更新日時: ${generated} ${dummyBadge}`;
  }

  const sections = [];
  const bySection = new Map();
  defs.forEach((def) => {
    if (!bySection.has(def.section)) {
      bySection.set(def.section, []);
      sections.push(def.section);
    }
    bySection.get(def.section).push(def);
  });

  sections.forEach((section) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "section";
    sectionEl.innerHTML = `<h2>${section}</h2>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    bySection.get(section).forEach((def) => {
      if (!(def.dataKey in data)) {
        console.warn(`dashboard_data.json に "${def.dataKey}" がありません（chart id: ${def.id}）`);
        return;
      }
      const card = def.shape === "stat" ? renderStatCard(def, data) : renderChartCard(def, data, colors);
      grid.appendChild(card);
    });
    sectionEl.appendChild(grid);
    main.appendChild(sectionEl);
  });
}

document.addEventListener("DOMContentLoaded", renderDashboard);
