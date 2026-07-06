"""施策集計スプレッドシート・GA4・Google Adsのデータを集約し、
dashboard_data.json / dashboard_data.js を生成する。

使い方:
    python3 data/build_data.py

データソースの現状:
- 施策実績（リード・商談化・受注・費用・目標）: スプレッドシート実データ（connectors/sheets.py）
- GA4アクセス分析・Search Consoleキーワード: ダミー（connectors/ga4.py。プロパティID・認証待ち）
- Google広告キーワード分析: ダミー（connectors/google_ads.py。Developer Token・CID待ち）
- HubSpot取引明細・HP問い合わせ内訳: ダミー（connectors/pending_dummy.py）

ダミー由来のデータキーは _dummy_keys に列挙し、画面上に「ダミー」チップを表示する。
"""

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from connectors import sheets, ga4, google_ads, pending_dummy

JST = timezone(timedelta(hours=9))
OUTPUT_JSON = Path(__file__).parent / "dashboard_data.json"
OUTPUT_JS = Path(__file__).parent / "dashboard_data.js"
ENV_PATH = Path(__file__).parent.parent / ".env"


def load_env() -> None:
    """.env の KEY=VALUE を環境変数に読み込む（既存の環境変数は上書きしない）。"""
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def month_seq(start: str, end: str) -> list:
    """"YYYY-MM" の連続リストを生成する。"""
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    months = []
    while (y, m) <= (ey, em):
        months.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return months


def _rate(numer, denom):
    return numer / denom if denom else None


def build_channel_kpis(metrics: dict, channel: str, lead_label: str) -> list:
    t = {k: sum(v[channel]) for k, v in metrics.items()}
    return [
        {"label": lead_label, "value": t["leads"], "format": "number", "trend": metrics["leads"][channel]},
        {"label": "商談化数", "value": t["deals"], "format": "number", "trend": metrics["deals"][channel]},
        {"label": "商談化率", "value": _rate(t["deals"], t["leads"]), "format": "percent"},
        {"label": "受注数", "value": t["wins"], "format": "number", "trend": metrics["wins"][channel]},
        {"label": "受注率", "value": _rate(t["wins"], t["deals"]), "format": "percent"},
        {"label": "受注金額", "value": t["revenue"], "format": "currency", "trend": metrics["revenue"][channel]},
    ]


def build() -> dict:
    data = {}
    records = sheets.load_records()
    now_month = datetime.now(JST).strftime("%Y-%m")

    actual_months = [r["month"] for r in records if r["leads"] is not None]
    months = month_seq(min(actual_months), now_month)
    idx = {m: i for i, m in enumerate(months)}
    n = len(months)

    # --- 施策カテゴリ別の月次実績 ---
    metric_fields = ["leads", "deals", "wins", "revenue", "cost"]
    metrics = {k: {ch: [0] * n for ch in sheets.CHANNELS} for k in metric_fields}
    targets_leads = [0] * n
    for r in records:
        i = idx.get(r["month"])
        if i is None:
            continue
        if r["expected"]:
            targets_leads[i] += r["expected"]
        ch = r["category"]
        if ch not in metrics["leads"]:
            continue
        for key in metric_fields:
            if r[key]:
                metrics[key][ch][i] += r[key]

    data["summary_monthly"] = {
        "months": months,
        "channels": sheets.CHANNELS,
        "metrics": metrics,
    }
    data["targets"] = {
        "leads": [v if v else None for v in targets_leads],
    }

    # --- 施策一覧（予定含む全行） ---
    data["campaign_list"] = [
        {
            "name": r["name"],
            "category": r["category"],
            "period": r["month"],
            "cost": r["cost"],
            "leads": r["leads"],
            "expected": r["expected"],
            "deals": r["deals"],
            "wins": r["wins"],
            "revenue": r["revenue"],
        }
        for r in sorted(records, key=lambda r: r["month"])
    ]

    # --- 展示会レポート ---
    data["expo_kpis"] = build_channel_kpis(metrics, "展示会", "リード件数")
    data["expo_monthly"] = {
        "months": months,
        "leads": metrics["leads"]["展示会"],
        "deals": metrics["deals"]["展示会"],
    }
    expos = sorted(
        (r for r in records if r["category"] == "展示会" and (r["leads"] or 0) > 0),
        key=lambda r: r["month"],
    )
    data["expo_by_expo"] = {
        "expos": [r["name"].split("_", 1)[-1] for r in expos],
        "ranks": {
            "Aランク": [r["rank_a"] or 0 for r in expos],
            "Bランク": [r["rank_b"] or 0 for r in expos],
            "Cランク": [r["rank_c"] or 0 for r in expos],
        },
        "conv_rate": [_rate(r["deals"] or 0, r["leads"]) for r in expos],
        "cost_per_lead": [_rate(r["cost"] or 0, r["leads"]) for r in expos],
        "wins": [r["wins"] or 0 for r in expos],
        "win_rate": [_rate(r["wins"] or 0, r["deals"]) if r["deals"] else None for r in expos],
    }

    # --- HP問い合わせレポート ---
    data["hp_kpis"] = build_channel_kpis(metrics, "HP", "問い合わせ数")
    data["hp_monthly"] = {
        "months": months,
        "inquiries": metrics["leads"]["HP"],
        "deals": metrics["deals"]["HP"],
    }

    # --- Google広告レポート ---
    ads_cost = metrics["cost"]["Google広告"]
    ads_leads = metrics["leads"]["Google広告"]
    data["ads_monthly"] = {
        "months": months,
        "cost": ads_cost,
        "leads": ads_leads,
        "cpl": [_rate(c, l) if l else None for c, l in zip(ads_cost, ads_leads)],
    }
    ads_t = {k: sum(v["Google広告"]) for k, v in metrics.items()}
    data["ads_kpis"] = [
        {"label": "広告費用", "value": ads_t["cost"], "format": "currency", "trend": ads_cost},
        {"label": "リード数", "value": ads_t["leads"], "format": "number", "trend": ads_leads},
        {"label": "リード単価", "value": _rate(ads_t["cost"], ads_t["leads"]), "format": "currency"},
        {"label": "商談化数", "value": ads_t["deals"], "format": "number"},
        {"label": "受注数", "value": ads_t["wins"], "format": "number"},
        {"label": "受注金額", "value": ads_t["revenue"], "format": "currency"},
        {"label": "ROI", "value": _rate(ads_t["revenue"] - ads_t["cost"], ads_t["cost"]), "format": "percent"},
    ]

    # --- 未接続分はダミー（画面に「ダミー」チップが付く） ---
    dummy = {}
    dummy["won_deals"] = pending_dummy.get_won_deals()
    dummy["deal_list"] = pending_dummy.get_deal_list()
    dummy.update(pending_dummy.get_hp_answers())
    dummy["ga_monthly"] = ga4.get_monthly()
    dummy["ga_channels_monthly"] = ga4.get_channels_monthly()
    referrers = ga4.get_referrers_monthly()
    dummy["ga_referrers_monthly"] = referrers
    rising = []
    for name, values in referrers["series"].items():
        prev, last = values[-2], values[-1]
        rising.append({
            "referrer": name,
            "prev_month": prev,
            "last_month": last,
            "growth": _rate(last - prev, prev),
        })
    rising.sort(key=lambda r: (r["growth"] is None, -(r["growth"] or 0)))
    dummy["ga_rising_referrers"] = rising
    top_pages = ga4.get_top_pages()
    for page in top_pages:
        page["cv_rate"] = _rate(page["cv"], page["sessions"])
    dummy["ga_top_pages"] = top_pages
    dummy["ga_devices"] = ga4.get_devices()
    dummy["ga_user_types"] = ga4.get_user_types()
    cv_monthly = ga4.get_cv_monthly()
    cv_monthly["cv_rate"] = [
        _rate(cv, s) for cv, s in zip(cv_monthly["cv"], cv_monthly["sessions"])
    ]
    dummy["ga_cv_monthly"] = cv_monthly
    dummy["ga_search_keywords"] = ga4.get_search_keywords()
    dummy["ads_keywords"] = google_ads.get_keywords()
    dummy["ads_cv_content"] = google_ads.get_cv_content()

    data.update(dummy)
    data["_dummy_keys"] = sorted(dummy.keys())

    data["meta"] = {
        "generated_at": datetime.now(JST).isoformat(),
        "source": "sheets",
        "period_label": f"{months[0]}〜{months[-1]} 実績",
        "dummy_note": "GA4・広告キーワード・HubSpot明細はダミー",
    }
    return data


def write_outputs(data: dict) -> None:
    json_text = json.dumps(data, ensure_ascii=False, indent=2)
    OUTPUT_JSON.write_text(json_text + "\n", encoding="utf-8")
    OUTPUT_JS.write_text(
        f"window.DASHBOARD_DATA = {json_text};\n", encoding="utf-8"
    )


if __name__ == "__main__":
    load_env()
    dataset = build()
    write_outputs(dataset)
    print(f"wrote {OUTPUT_JSON}")
    print(f"wrote {OUTPUT_JS}")
