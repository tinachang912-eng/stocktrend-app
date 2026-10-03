"""
export_data.py
抓取 TWSE 與 TPEx 官方最新真實行情，並輸出靜態 JSON 資料到 data/ 目錄
供 GitHub Pages 與行動裝置直接存取，解決 Mixed Content 與手機無 Python 環境問題
"""

import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from calendar_service import calendar_service, TAIPEI_TZ
from twse_tpex_client import official_client

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
HISTORY_DIR = os.path.join(DATA_DIR, "history")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)

# 常用觀察股票清單 (上市、上櫃、ETF，保留前導 0)
TARGET_SYMBOLS = [
    "2330",  # 台積電 (上市)
    "2308",  # 台達電 (上市)
    "2454",  # 聯發科 (上市)
    "2317",  # 鴻海 (上市)
    "2603",  # 長榮 (上市)
    "2382",  # 廣達 (上市)
    "2881",  # 富邦金 (上市)
    "2882",  # 國泰金 (上市)
    "3008",  # 大立光 (上市)
    "2357",  # 華碩 (上市)
    "3231",  # 緯創 (上市)
    "0050",  # 元大台灣50 (上市ETF)
    "0056",  # 元大高股息 (上市ETF)
    "6488",  # 環球晶 (上櫃)
    "3293",  # 鈊象 (上櫃)
    "8069",  # 元太 (上櫃)
    "5483",  # 中美晶 (上櫃)
    "00679B" # 元大美債20年 (上櫃ETF)
]


def export_all():
    now = datetime.now(TAIPEI_TZ)
    print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] 開始匯出官方市場資料...")

    # 1. 匯出官方日曆與市場狀態
    expected_date = calendar_service.get_latest_expected_trading_date(now)
    is_today_trading = calendar_service.is_trading_day(now.date())
    holidays = sorted(list(calendar_service.fetch_official_holidays()))

    calendar_data = {
        "taipei_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": "Asia/Taipei",
        "is_today_trading_day": is_today_trading,
        "latest_expected_trading_date": expected_date.strftime("%Y-%m-%d"),
        "official_holidays": holidays
    }

    with open(os.path.join(DATA_DIR, "calendar.json"), "w", encoding="utf-8") as f:
        json.dump(calendar_data, f, ensure_ascii=False, indent=2)
    print("  [V] 匯出 data/calendar.json 完成")

    # 2. 抓取並匯出全市場最新各檔股票收盤行情 (TWSE 全部 1380 檔 + TPEx 全部 1013 檔)
    quotes_dict = {}
    twse_all = official_client.fetch_twse_quotes()
    for code, item in twse_all.items():
        q = dict(item)
        is_updated, actual_iso, expected_iso, status_msg = calendar_service.compare_with_api_date(q.get("raw_date", ""), now)
        q["is_updated"] = is_updated
        q["trade_date"] = actual_iso
        q["expected_trade_date"] = expected_iso
        q["status_message"] = status_msg
        quotes_dict[code] = q

    tpex_all = official_client.fetch_tpex_quotes()
    for code, item in tpex_all.items():
        q = dict(item)
        is_updated, actual_iso, expected_iso, status_msg = calendar_service.compare_with_api_date(q.get("raw_date", ""), now)
        q["is_updated"] = is_updated
        q["trade_date"] = actual_iso
        q["expected_trade_date"] = expected_iso
        q["status_message"] = status_msg
        quotes_dict[code] = q

    print(f"  [V] 已成功彙整全市場 {len(quotes_dict)} 檔官方股票與 ETF 收盤行情！")

    quotes_payload = {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "total_count": len(quotes_dict),
        "quotes": quotes_dict
    }

    with open(os.path.join(DATA_DIR, "quotes.json"), "w", encoding="utf-8") as f:
        json.dump(quotes_payload, f, ensure_ascii=False)
    print("  [V] 匯出 data/quotes.json 完成")

    # 3. 匯出預設三檔與常用股票真實 30 天歷史數據與均線 (包含 2303 聯電)
    history_targets = TARGET_SYMBOLS + ["2303", "3034", "00878", "00919"]
    for sym in history_targets:
        try:
            records = official_client.fetch_stock_history_30days(sym)
            if records:
                prices = [r["close_price"] for r in records if r["close_price"] is not None]
                ma5 = round(sum(prices[-5:]) / len(prices[-5:]), 2) if len(prices) >= 5 else None
                ma20 = round(sum(prices[-20:]) / len(prices[-20:]), 2) if len(prices) >= 20 else None
                high_30 = max(prices) if prices else None
                low_30 = min(prices) if prices else None
                latest_p = prices[-1] if prices else None

                bias_5 = round(((latest_p - ma5) / ma5) * 100, 2) if (latest_p and ma5) else 0.0
                bias_20 = round(((latest_p - ma20) / ma20) * 100, 2) if (latest_p and ma20) else 0.0

                hist_payload = {
                    "symbol": sym,
                    "total_days": len(records),
                    "history": records,
                    "indicators": {
                        "ma5": ma5,
                        "ma20": ma20,
                        "high_30": high_30,
                        "low_30": low_30,
                        "bias_5": bias_5,
                        "bias_20": bias_20
                    }
                }

                out_path = os.path.join(HISTORY_DIR, f"{sym}.json")
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(hist_payload, f, ensure_ascii=False, indent=2)
                print(f"  [V] 匯出真實歷史: {sym} ({len(records)} 天)")
        except Exception as e:
            print(f"  [!] 歷史行情匯出失敗 {sym}: {e}")

    print("所有官方資料靜態快照匯出完成！")


if __name__ == "__main__":
    export_all()
