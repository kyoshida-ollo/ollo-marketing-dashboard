"""Google Analytics Data API経由でHPアクセス分析データを取得する。

TODO: GA4プロパティID・認証方法（サービスアカウント想定）が確定したら実装する。
検索キーワード（get_search_keywords）はGA4ではなくSearch Console APIの連携が必要。
現状は build_data.py が組み立てるデータ構造に合わせたダミーデータ（FY26 = 2025-07〜2026-06）を返す。
"""

MONTHS = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
]

_SESSIONS = [3050, 3180, 3020, 3410, 3350, 2980, 3620, 3480, 3900, 3560, 3720, 3980]


def get_monthly() -> dict:
    """月次セッション数・PV数。"""
    return {
        "months": MONTHS,
        "sessions": _SESSIONS,
        "pageviews": [8200, 8600, 8100, 9300, 9050, 8000, 9800, 9400, 10600, 9700, 10100, 10900],
    }


def get_channels_monthly() -> dict:
    """流入元（デフォルトチャネル）別セッション数の月次推移。"""
    return {
        "months": MONTHS,
        "series": {
            "自然検索":   [1500, 1560, 1490, 1690, 1650, 1470, 1800, 1720, 1930, 1760, 1840, 1980],
            "広告":       [900, 940, 880, 1000, 990, 870, 1060, 1030, 1150, 1050, 1100, 1160],
            "直接":       [430, 450, 430, 480, 470, 420, 510, 490, 550, 500, 520, 560],
            "参照リンク": [220, 230, 220, 240, 240, 220, 250, 240, 270, 250, 260, 280],
        },
    }


def get_referrers_monthly() -> dict:
    """参照リンク元（リファラー）別セッション数の月次推移。"""
    return {
        "months": MONTHS,
        "series": {
            "YouTube":                [40, 45, 50, 55, 60, 70, 85, 95, 120, 150, 210, 320],
            "プレスリリース(PR TIMES)": [10, 150, 20, 15, 10, 8, 12, 180, 25, 15, 10, 12],
            "業界メディア":            [60, 65, 58, 70, 66, 60, 72, 68, 75, 71, 74, 78],
            "X(旧Twitter)":           [25, 28, 22, 30, 26, 24, 32, 32, 35, 30, 33, 36],
            "パートナー企業サイト":     [30, 32, 31, 35, 33, 30, 36, 34, 38, 35, 37, 40],
        },
    }


def get_top_pages() -> list:
    """よく見られているページ（FY26累計）。cv_rate は build_data.py 側で計算する。"""
    return [
        {"page": "/（トップ）", "pv": 18500, "sessions": 15200, "cv": 32},
        {"page": "/product（製品紹介）", "pv": 9800, "sessions": 7600, "cv": 28},
        {"page": "/case（導入事例）", "pv": 7200, "sessions": 5400, "cv": 22},
        {"page": "/blog（ブログ）", "pv": 6800, "sessions": 5900, "cv": 8},
        {"page": "/price（料金）", "pv": 5600, "sessions": 4300, "cv": 30},
        {"page": "/company（会社概要）", "pv": 3200, "sessions": 2700, "cv": 4},
        {"page": "/download（資料DL）", "pv": 2900, "sessions": 2300, "cv": 45},
        {"page": "/contact（問い合わせ）", "pv": 2600, "sessions": 2200, "cv": 150},
    ]


def get_devices() -> dict:
    """デバイス別セッション数（FY26累計）。"""
    return {
        "PC": 24800,
        "スマートフォン": 15600,
        "タブレット": 1850,
    }


def get_user_types() -> dict:
    """新規・リピーター別セッション数（FY26累計）。"""
    return {
        "新規": 26400,
        "リピーター": 15850,
    }


def get_cv_monthly() -> dict:
    """月次CV数（フォーム送信）。cv_rate は build_data.py 側でセッション数から計算する。"""
    return {
        "months": MONTHS,
        "sessions": _SESSIONS,
        "cv": [9, 11, 10, 13, 12, 8, 14, 12, 16, 13, 15, 17],
    }


def get_search_keywords() -> list:
    """検索キーワード（Search Console API連携が必要。FY26累計）。"""
    return [
        {"keyword": "ollo（指名検索）", "clicks": 520, "impressions": 3900, "ctr": 0.133, "position": 1.1},
        {"keyword": "業務管理 システム", "clicks": 420, "impressions": 12500, "ctr": 0.034, "position": 4.2},
        {"keyword": "生産管理 とは", "clicks": 380, "impressions": 22000, "ctr": 0.017, "position": 6.8},
        {"keyword": "工程管理 エクセル 限界", "clicks": 250, "impressions": 8200, "ctr": 0.030, "position": 3.5},
        {"keyword": "在庫管理 効率化", "clicks": 210, "impressions": 9800, "ctr": 0.021, "position": 5.1},
        {"keyword": "製造業 DX 事例", "clicks": 180, "impressions": 11000, "ctr": 0.016, "position": 7.4},
        {"keyword": "品質管理 ソフト 比較", "clicks": 160, "impressions": 6800, "ctr": 0.024, "position": 4.9},
        {"keyword": "トレーサビリティ 義務化", "clicks": 140, "impressions": 9500, "ctr": 0.015, "position": 8.2},
    ]
