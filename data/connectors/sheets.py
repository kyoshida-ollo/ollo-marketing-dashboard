"""Google Sheets API経由でHubSpot集計シート・展示会費用シートを読む。

TODO: シートID・タブ名が確定したら実装する。
現状は build_data.py が組み立てるデータ構造に合わせたダミーデータを返す。
"""

DUMMY_EXPO_NAMES = ["展示会A", "展示会B", "展示会C", "展示会D"]
DUMMY_MONTHS = ["2026-04", "2026-05", "2026-06"]


def get_expo_data() -> dict:
    """展示会ごとのリード数・商談化率・費用対リード単価を返す。"""
    return {
        "leads_by_expo_monthly": {
            "months": DUMMY_MONTHS,
            "series": {
                "展示会A": [12, 15, 9],
                "展示会B": [8, 10, 11],
                "展示会C": [5, 6, 7],
                "展示会D": [3, 4, 2],
            },
        },
        "expo_conversion_rate": {
            "展示会A": 0.25,
            "展示会B": 0.18,
            "展示会C": 0.30,
            "展示会D": 0.12,
        },
        "expo_cost_per_lead": {
            "展示会A": 12000,
            "展示会B": 18500,
            "展示会C": 9800,
            "展示会D": 21000,
        },
    }


def get_hubspot_crm_data() -> dict:
    """CRMパイプラインスナップショット・新規商談数・成約率を返す。"""
    return {
        "crm_pipeline_snapshot": {
            "stages": ["リード", "商談化", "提案", "成約"],
            "counts": [120, 54, 28, 12],
            "amounts": [0, 43200000, 25600000, 14800000],
        },
        "crm_new_deals_monthly": {
            "months": DUMMY_MONTHS,
            "counts": [18, 22, 20],
        },
        "crm_win_rate": 0.22,
    }
