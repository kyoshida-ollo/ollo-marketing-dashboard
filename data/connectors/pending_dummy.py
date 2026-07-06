"""まだ実データ接続できていない項目のダミーデータ置き場。

接続でき次第、対応する関数を実コネクタに移して削除する。
ここから出たデータキーは build_data.py で _dummy_keys に登録され、
ダッシュボード上に「ダミー」チップが表示される。

- 受注案件一覧・商談化一覧: HubSpotの取引リスト（エクスポートかシート追加をKengoさんと相談）
- HP問い合わせのきっかけ・都道府県: HubSpotフォーム回答の集計
"""


def get_won_deals() -> list:
    return [
        {"month": "2025-10", "deal": "（ダミー）A社 導入案件", "amount": 10600000, "source": "HP", "contract": "年間ライセンス"},
        {"month": "2026-02", "deal": "（ダミー）B社 新規導入", "amount": 1100000, "source": "HP", "contract": "年間ライセンス"},
    ]


def get_deal_list() -> list:
    return [
        {"month": "2026-03", "deal": "（ダミー）C社 導入検討", "amount": 3000000, "source": "展示会", "stage": "商談中"},
        {"month": "2026-04", "deal": "（ダミー）D社 リプレイス検討", "amount": 5000000, "source": "HP", "stage": "提案中"},
    ]


def get_hp_answers() -> dict:
    return {
        "hp_trigger": {
            "Web検索": 58,
            "展示会で知った": 24,
            "知人の紹介": 18,
            "SNS": 12,
            "広告": 28,
        },
        "hp_prefecture": {
            "東京都": 42,
            "大阪府": 25,
            "愛知県": 18,
            "神奈川県": 15,
            "福岡県": 10,
            "その他": 40,
        },
    }
