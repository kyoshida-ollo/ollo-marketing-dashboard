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


def build_channel_comparison() -> dict:
    """チャネル別（展示会/HP/広告/紹介）の商談化率・成約率の比較。

    TODO: 現状は他のダミー値から手計算した概算。実データ接続後はCRM側の
    チャネル属性を使って正しく集計し直す。
    """
    return {
        "channel_comparison": {
            "channels": ["展示会", "HP", "広告", "紹介"],
            "conversion_rate": [0.22, 0.15, 0.19, 0.35],
            "win_rate": [0.24, 0.18, 0.20, 0.30],
        }
    }


def build() -> dict:
    data = {}
    data.update(sheets.get_expo_data())
    data.update(sheets.get_hubspot_crm_data())
    data.update(ga4.get_ga4_data())
    data.update(google_ads.get_google_ads_data())
    data.update(build_channel_comparison())
    data["meta"] = {
        "generated_at": datetime.now(JST).isoformat(),
        "source": "dummy",
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
