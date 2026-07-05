"""Google Analytics Data API経由でセッション数・PV数・流入元別数値を取得する。

TODO: GA4プロパティID・認証方法（サービスアカウント想定）が確定したら実装する。
現状は build_data.py が組み立てるデータ構造に合わせたダミーデータを返す。
"""

DUMMY_MONTHS = ["2026-04", "2026-05", "2026-06"]


def get_ga4_data() -> dict:
    """月次セッション数・PV数、流入元別セッション比率を返す。"""
    return {
        "hp_sessions_pv_monthly": {
            "months": DUMMY_MONTHS,
            "sessions": [3200, 3550, 4100],
            "pageviews": [8600, 9400, 10800],
        },
        "hp_traffic_by_channel": {
            "自然検索": 1800,
            "広告": 1200,
            "直接": 650,
            "紹介": 450,
        },
    }
