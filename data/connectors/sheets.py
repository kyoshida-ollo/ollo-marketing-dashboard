"""施策集計スプレッドシート「LookerStudio_data」（expense_leadタブ）を読む実データコネクタ。

列構成: イベント名 / 実施日 / 費用（税抜） / 獲得リード数 / 予想リード数 / 商談化数 /
受注数 / 受注金額 / カテゴリー（展示会・ウェビナー・HP・Google広告） / 展示会_リードA〜C

取得経路は上から順に試し、成功したらローカルキャッシュを更新する:
1. サービスアカウント（.env の GOOGLE_SERVICE_ACCOUNT_JSON。シートをSAのメールアドレスに共有しておくこと）
2. 公開CSVエクスポート（シートが「リンクを知っている全員（閲覧者）」になっている場合のみ）
3. ローカルキャッシュ data/cache/expense_lead.csv
"""

import csv
import io
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_SHEET_ID = "1kaNNLhxanVi8LwvlWvMYKArBlV3H19dMHAsS8xPhuUk"
DEFAULT_TAB = "expense_lead"
CACHE_PATH = Path(__file__).resolve().parent.parent / "cache" / "expense_lead.csv"

CHANNELS = ["展示会", "ウェビナー", "HP", "Google広告"]

_COLUMNS = {
    "name": "イベント名",
    "date": "実施日",
    "cost": "費用（税抜）",
    "leads": "獲得リード数",
    "expected": "予想リード数",
    "deals": "商談化数",
    "wins": "受注数",
    "revenue": "受注金額",
    "category": "カテゴリー",
    "rank_a": "展示会_リードA",
    "rank_b": "展示会_リードB",
    "rank_c": "展示会_リードC",
}

_DATE_RE = re.compile(r"(\d{4})/(\d{1,2})")


def _sheet_id() -> str:
    return os.environ.get("DASHBOARD_SHEET_ID", DEFAULT_SHEET_ID)


def _tab() -> str:
    return os.environ.get("DASHBOARD_SHEET_TAB", DEFAULT_TAB)


def _fetch_via_service_account():
    sa_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_path or not Path(sa_path).exists():
        return None
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        print("warn: google-auth が未インストールのためサービスアカウント経路をスキップ"
              "（pip install -r requirements.txt）")
        return None
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    creds.refresh(Request())
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{_sheet_id()}"
        f"/values/{urllib.parse.quote(_tab())}?majorDimension=ROWS"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {creds.token}"})
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.load(res)
    return payload.get("values")


def _fetch_via_public_csv():
    url = (
        f"https://docs.google.com/spreadsheets/d/{_sheet_id()}"
        f"/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(_tab())}"
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as res:
            text = res.read().decode("utf-8")
    except Exception:
        return None
    if text.lstrip().startswith("<"):  # ログインページ等のHTMLが返ってきた場合
        return None
    return list(csv.reader(io.StringIO(text)))


def _read_cache():
    if not CACHE_PATH.exists():
        return None
    with CACHE_PATH.open(encoding="utf-8") as f:
        return list(csv.reader(f))


def _write_cache(rows) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CACHE_PATH.open("w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)


def _fetch_rows():
    for fetch, label in [
        (_fetch_via_service_account, "サービスアカウント"),
        (_fetch_via_public_csv, "公開CSV"),
    ]:
        try:
            rows = fetch()
        except Exception as e:
            print(f"warn: {label}経由の取得に失敗: {e}")
            rows = None
        if rows:
            print(f"info: スプレッドシートを{label}経由で取得")
            _write_cache(rows)
            return rows
    rows = _read_cache()
    if rows:
        print(f"info: ローカルキャッシュを使用（{CACHE_PATH}）")
        return rows
    raise RuntimeError(
        "スプレッドシートを取得できません。GOOGLE_SERVICE_ACCOUNT_JSON を .env に設定するか、"
        "data/cache/expense_lead.csv を用意してください。"
    )


def _to_number(text):
    if text is None:
        return None
    s = str(text).strip().replace("¥", "").replace(",", "").replace("％", "%")
    if not s:
        return None
    if s.endswith("%"):
        try:
            return float(s[:-1]) / 100
        except ValueError:
            return None
    try:
        f = float(s)
    except ValueError:
        return None
    return int(f) if f == int(f) else f


def _to_month(text):
    m = _DATE_RE.match(str(text or "").strip())
    return f"{m.group(1)}-{int(m.group(2)):02d}" if m else None


def load_records() -> list:
    """シートの行を正規化したレコードのリストにして返す。"""
    rows = _fetch_rows()
    header_idx = None
    for i, row in enumerate(rows):
        if _COLUMNS["name"] in row:
            header_idx = i
            break
    if header_idx is None:
        raise RuntimeError(f"ヘッダー行（{_COLUMNS['name']}列）が見つかりません")
    header = rows[header_idx]
    col = {}
    for key, label in _COLUMNS.items():
        col[key] = header.index(label) if label in header else None

    def cell(row, key):
        i = col[key]
        return row[i] if i is not None and i < len(row) else None

    records = []
    for row in rows[header_idx + 1:]:
        name = (cell(row, "name") or "").strip()
        month = _to_month(cell(row, "date"))
        category = (cell(row, "category") or "").strip()
        if not name or not month or not category:
            continue
        records.append({
            "name": name,
            "month": month,
            "category": category,
            "cost": _to_number(cell(row, "cost")),
            "leads": _to_number(cell(row, "leads")),
            "expected": _to_number(cell(row, "expected")),
            "deals": _to_number(cell(row, "deals")),
            "wins": _to_number(cell(row, "wins")),
            "revenue": _to_number(cell(row, "revenue")),
            "rank_a": _to_number(cell(row, "rank_a")),
            "rank_b": _to_number(cell(row, "rank_b")),
            "rank_c": _to_number(cell(row, "rank_c")),
        })
    return records
