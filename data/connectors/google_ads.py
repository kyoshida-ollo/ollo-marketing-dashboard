"""Google Ads API経由でキーワード別実績・CV内容を取得する（未接続・ダミー）。

月次の費用・リード数はスプレッドシート（sheets.py）から実データで取れるため、
このモジュールはAds APIでしか取れないもの（キーワード分析・クリック数など）のみ担当する。
TODO: Developer Token・顧客ID（CID）・MCC構成が確定したら実装する。
"""


def get_keywords() -> list:
    """キーワード別の実績（FY26累計）。"""
    return [
        {"keyword": "業務管理 システム", "cost": 980000, "clicks": 4200, "cv": 32, "cpa": 30625},
        {"keyword": "生産管理 クラウド", "cost": 820000, "clicks": 3400, "cv": 24, "cpa": 34167},
        {"keyword": "工程管理 ソフト", "cost": 640000, "clicks": 2800, "cv": 18, "cpa": 35556},
        {"keyword": "在庫管理 システム 比較", "cost": 560000, "clicks": 2500, "cv": 15, "cpa": 37333},
        {"keyword": "製造業 DX 事例", "cost": 520000, "clicks": 2900, "cv": 12, "cpa": 43333},
        {"keyword": "品質管理 システム", "cost": 480000, "clicks": 2100, "cv": 11, "cpa": 43636},
        {"keyword": "トレーサビリティ 導入", "cost": 420000, "clicks": 1700, "cv": 8, "cpa": 52500},
        {"keyword": "その他", "cost": 535000, "clicks": 1800, "cv": 6, "cpa": 89167},
    ]


def get_cv_content() -> dict:
    """コンバージョンした問い合わせ内容の内訳（FY26累計）。"""
    return {
        "資料請求": 52,
        "見積依頼": 28,
        "デモ依頼": 24,
        "その他": 22,
    }
