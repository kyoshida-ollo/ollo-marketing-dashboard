"""Google Ads API経由でキャンペーン別費用・クリック・CV数・CPAを取得する。

TODO: Developer Token・顧客ID（CID）・MCC構成が確定したら実装する。
現状は build_data.py が組み立てるデータ構造に合わせたダミーデータを返す。
"""

DUMMY_MONTHS = ["2026-04", "2026-05", "2026-06"]


def get_google_ads_data() -> dict:
    """月次のキャンペーン別費用・クリック・CV数・CPAを返す。"""
    return {
        "ads_campaign_monthly": {
            "months": DUMMY_MONTHS,
            "campaigns": {
                "キャンペーンA": {
                    "cost": [280000, 310000, 295000],
                    "clicks": [1200, 1350, 1280],
                    "cv": [24, 28, 26],
                    "cpa": [11667, 11071, 11346],
                },
                "キャンペーンB": {
                    "cost": [150000, 165000, 172000],
                    "clicks": [700, 760, 810],
                    "cv": [10, 12, 13],
                    "cpa": [15000, 13750, 13231],
                },
            },
        }
    }
