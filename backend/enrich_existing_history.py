"""
enrich_existing_history.py
將 data/history/ 底下所有既有股票歷史 JSON 檔案注入三大法人（外資、投信、自營商）30 天買賣超數據與籌碼面指標
"""

import os
import sys
import json

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
HISTORY_DIR = os.path.join(ROOT_DIR, "data", "history")

sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
from twse_tpex_client import enrich_history_with_institutional, compute_institutional_summary

def process_all_history_files():
    if not os.path.exists(HISTORY_DIR):
        print(f"Directory not found: {HISTORY_DIR}")
        return

    files = [f for f in os.listdir(HISTORY_DIR) if f.endswith(".json")]
    print(f"找到 {len(files)} 個歷史資料檔案，開始更新三大法人籌碼面數據...")

    for fname in sorted(files):
        fpath = os.path.join(HISTORY_DIR, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)

            symbol = data.get("symbol", fname.replace(".json", ""))
            records = data.get("history", [])

            if not records:
                continue

            enriched_records = enrich_history_with_institutional(symbol, records)
            summary = compute_institutional_summary(symbol, enriched_records)

            data["history"] = enriched_records
            data["institutional"] = summary

            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            print(f"  [V] 已成功更新 {symbol}: 30日外資累計 {summary['foreign_30d_net']:+,} 張, 投信 {summary['trust_30d_net']:+,} 張, 綜評: {summary['institutional_sentiment']}")
        except Exception as e:
            print(f"  [X] 更新 {fname} 失敗: {e}")

if __name__ == "__main__":
    process_all_history_files()
