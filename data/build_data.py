"""HubSpotスプレッドシート・GA4・Google Adsのデータを集約し、
dashboard_data.json / dashboard_data.js を生成する。

使い方:
    python3 data/build_data.py

各コネクタ（connectors/*.py）は現状ダミーデータを返すスタブ。
実APIに接続する際はコネクタの中身だけを差し替え、ここでのマージ処理は変えない。
"""

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

from connectors import sheets, ga4, google_ads

JST = timezone(timedelta(hours=9))
OUTPUT_JSON = Path(__file__).parent / "dashboard_data.json"
OUTPUT_JS = Path(__file__).parent / "dashboard_data.js"


def _channel_totals(metrics: dict, channel: str) -> dict:
    return {key: sum(values[channel]) for key, values in metrics.items()}


def _rate(numer: float, denom: float):
    return numer / denom if denom else None


def build_channel_kpis(metrics: dict, channel: str, lead_label: str) -> list:
    """施策別ページの主要KPIカード（FY26累計）。trend は月次推移のスパークライン用。"""
    t = _channel_totals(metrics, channel)
    return [
        {"label": lead_label, "value": t["leads"], "format": "number", "trend": metrics["leads"][channel]},
        {"label": "新規会社数", "value": t["companies"], "format": "number", "trend": metrics["companies"][channel]},
        {"label": "商談化数", "value": t["deals"], "format": "number", "trend": metrics["deals"][channel]},
        {"label": "商談化率", "value": _rate(t["deals"], t["leads"]), "format": "percent"},
        {"label": "受注数", "value": t["wins"], "format": "number", "trend": metrics["wins"][channel]},
        {"label": "受注率", "value": _rate(t["wins"], t["deals"]), "format": "percent"},
        {"label": "受注金額", "value": t["revenue"], "format": "currency", "trend": metrics["revenue"][channel]},
    ]


def build() -> dict:
    data = {}

    # --- サマリー（施策別月次実績。Google広告の費用はads側からマージ） ---
    summary = sheets.get_summary_monthly()
    ads_monthly = google_ads.get_ads_monthly()
    summary["metrics"]["cost"]["Google広告"] = ads_monthly["cost"]
    data["summary_monthly"] = summary
    data["targets"] = sheets.get_targets()

    # --- 生データ系 ---
    data["won_deals"] = sheets.get_won_deals()
    data["deal_list"] = sheets.get_deal_list()
    data["campaign_list"] = sheets.get_campaign_list()

    metrics = summary["metrics"]

    # --- 展示会レポート ---
    data["expo_kpis"] = build_channel_kpis(metrics, "展示会", "リード件数")
    data["expo_monthly"] = {
        "months": summary["months"],
        "leads": metrics["leads"]["展示会"],
        "companies": metrics["companies"]["展示会"],
        "deals": metrics["deals"]["展示会"],
    }
    data["expo_by_expo"] = sheets.get_expo_by_expo()

    # --- HP問い合わせレポート ---
    data["hp_kpis"] = build_channel_kpis(metrics, "HP", "問い合わせ数")
    data["hp_monthly"] = {
        "months": summary["months"],
        "inquiries": metrics["leads"]["HP"],
        "companies": metrics["companies"]["HP"],
        "deals": metrics["deals"]["HP"],
    }
    data.update(sheets.get_hp_answers())

    # --- HPアクセス分析（GA4 / Search Console） ---
    data["ga_monthly"] = ga4.get_monthly()
    data["ga_channels_monthly"] = ga4.get_channels_monthly()
    referrers = ga4.get_referrers_monthly()
    data["ga_referrers_monthly"] = referrers

    # 急上昇参照元：直近月と前月のセッション数を比較して増減率の高い順に並べる
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
    data["ga_rising_referrers"] = rising

    top_pages = ga4.get_top_pages()
    for page in top_pages:
        page["cv_rate"] = _rate(page["cv"], page["sessions"])
    data["ga_top_pages"] = top_pages

    data["ga_devices"] = ga4.get_devices()
    data["ga_user_types"] = ga4.get_user_types()

    cv_monthly = ga4.get_cv_monthly()
    cv_monthly["cv_rate"] = [
        _rate(cv, s) for cv, s in zip(cv_monthly["cv"], cv_monthly["sessions"])
    ]
    data["ga_cv_monthly"] = cv_monthly

    data["ga_search_keywords"] = ga4.get_search_keywords()

    # --- Google広告レポート ---
    ads_t = _channel_totals(metrics, "Google広告")
    total_cost = sum(ads_monthly["cost"])
    total_cv = sum(ads_monthly["cv"])
    data["ads_kpis"] = [
        {"label": "広告費用", "value": total_cost, "format": "currency", "trend": ads_monthly["cost"]},
        {"label": "クリック数", "value": sum(ads_monthly["clicks"]), "format": "number", "trend": ads_monthly["clicks"]},
        {"label": "CV数", "value": total_cv, "format": "number", "trend": ads_monthly["cv"]},
        {"label": "CPA", "value": _rate(total_cost, total_cv), "format": "currency", "trend": ads_monthly["cpa"]},
        {"label": "商談化数", "value": ads_t["deals"], "format": "number", "trend": metrics["deals"]["Google広告"]},
        {"label": "受注数", "value": ads_t["wins"], "format": "number", "trend": metrics["wins"]["Google広告"]},
        {"label": "受注金額", "value": ads_t["revenue"], "format": "currency", "trend": metrics["revenue"]["Google広告"]},
        {"label": "ROI", "value": _rate(ads_t["revenue"] - total_cost, total_cost), "format": "percent"},
    ]
    data["ads_monthly"] = ads_monthly
    data["ads_keywords"] = google_ads.get_keywords()
    data["ads_cv_content"] = google_ads.get_cv_content()

    data["meta"] = {
        "generated_at": datetime.now(JST).isoformat(),
        "source": "dummy",
        "fiscal_year": "FY26（2025-07〜2026-06）",
    }
    return data


def write_outputs(data: dict) -> None:
    json_text = json.dumps(data, ensure_ascii=False, indent=2)
    OUTPUT_JSON.write_text(json_text + "\n", encoding="utf-8")
    OUTPUT_JS.write_text(
        f"window.DASHBOARD_DATA = {json_text};\n", encoding="utf-8"
    )


if __name__ == "__main__":
    dataset = build()
    write_outputs(dataset)
    print(f"wrote {OUTPUT_JSON}")
    print(f"wrote {OUTPUT_JS}")
