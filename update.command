#!/bin/zsh
# ダブルクリックでデータ更新→ブラウザ表示（Mac用）
cd "$(dirname "$0")"
echo "データを更新しています..."
if python3 data/build_data.py; then
  open site/index.html
else
  echo ""
  echo "データ更新に失敗しました。上のエラーメッセージを確認してください。"
  read -k 1 "?何かキーを押すと閉じます..."
fi
