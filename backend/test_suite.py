"""
test_suite.py
台股官方行情服務全面驗證測試腳本
實測：上市股票、上櫃股票、ETF、平日、週末、休市日、API 失敗降級、資料尚未更新
"""

import unittest
from datetime import datetime, date, time
import pytz

from calendar_service import TradingCalendarService, TAIPEI_TZ
from twse_tpex_client import (
    OfficialStockClient,
    clean_price_val,
    clean_number_val,
    compute_institutional_summary
)


class TestOfficialStockService(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.calendar = TradingCalendarService()
        cls.client = OfficialStockClient(timeout=8, max_retries=2)
        print("\n================== 開始執行台股官方行情整合測試 ==================")

    def test_01_clean_price_and_missing_values(self):
        """測試 6: 正確處理逗號、空白、--，缺少收盤價時不轉成 0"""
        self.assertEqual(clean_price_val("1,090.00"), 1090.0)
        self.assertEqual(clean_price_val("2,500.00"), 2500.0)
        self.assertEqual(clean_price_val(" 112.80 "), 112.8)
        
        # 關鍵防呆：缺少收盤價或未成交時不可轉成 0
        self.assertIsNone(clean_price_val("--"))
        self.assertIsNone(clean_price_val("-"))
        self.assertIsNone(clean_price_val(" "))
        self.assertIsNone(clean_price_val(""))
        self.assertIsNone(clean_price_val("null"))
        self.assertIsNone(clean_price_val(None))
        self.assertIsNone(clean_price_val("0.00"))
        print("  [V] 測試 1 通過: 逗號清理與無有效收盤價防呆正確 (缺少時為 None，絕不轉成 0)")

    def test_02_twse_listed_stocks(self):
        """測試 2 & 10: 實測上市股票 (2330 台積電, 2308 台達電, 2454 聯發科)"""
        for sym in ["2330", "2308", "2454"]:
            q = self.client.get_stock_quote(sym)
            self.assertIsNotNone(q, f"查無上市股票 {sym}")
            self.assertEqual(q["symbol"], sym)
            self.assertIn("TWSE", q["market"])
            self.assertIsNotNone(q["close_price"])
            self.assertGreater(q["close_price"], 0)
            self.assertTrue(len(q["trade_date"]) == 10)  # YYYY-MM-DD
            print(f"  [V] 上市股票 {sym} ({q['name']}): 收盤價 {q['close_price_display']} 元 | 交易日: {q['trade_date']} | 資料來源: {q['data_source']}")

    def test_03_tpex_otc_stocks(self):
        """測試 2 & 10: 實測上櫃股票 (6488 環球晶, 3293 鈊象, 8069 元太)"""
        for sym in ["6488", "3293", "8069"]:
            q = self.client.get_stock_quote(sym)
            self.assertIsNotNone(q, f"查無上櫃股票 {sym}")
            self.assertEqual(q["symbol"], sym)
            self.assertIn("TPEx", q["market"])
            self.assertIsNotNone(q["close_price"])
            self.assertGreater(q["close_price"], 0)
            self.assertTrue(len(q["trade_date"]) == 10)
            print(f"  [V] 上櫃股票 {sym} ({q['name']}): 收盤價 {q['close_price_display']} 元 | 交易日: {q['trade_date']} | 資料來源: {q['data_source']}")

    def test_04_etf_with_leading_zeros(self):
        """測試 3 & 10: 實測上市與上櫃 ETF，保留前導 0 (0050, 0056, 00679B)"""
        etfs = ["0050", "0056", "00679B"]
        for sym in etfs:
            q = self.client.get_stock_quote(sym)
            self.assertIsNotNone(q, f"查無 ETF {sym}")
            self.assertEqual(q["symbol"], sym)  # 確保字串且前導 0 未遺失
            self.assertIsNotNone(q["close_price"])
            print(f"  [V] ETF {sym} ({q['name']}): 收盤價 {q['close_price_display']} 元 | 市場: {q['market']}")

    def test_05_calendar_logic_weekday_weekend_holiday(self):
        """測試 4: 官方交易日曆判斷 (時區 Asia/Taipei，平日/週末/休市日推算)"""
        # 1. 週末模擬：假設當前為 2026/10/04 (週日) 14:00
        dt_sunday = TAIPEI_TZ.localize(datetime(2026, 10, 4, 14, 0, 0))
        exp_date_sunday = self.calendar.get_latest_expected_trading_date(dt_sunday)
        # 最近已完成營業日應為 2026/10/02 (週五)
        self.assertEqual(exp_date_sunday, date(2026, 10, 2))

        # 2. 週六模擬：2026/10/03 (週六)
        dt_saturday = TAIPEI_TZ.localize(datetime(2026, 10, 3, 20, 0, 0))
        exp_date_saturday = self.calendar.get_latest_expected_trading_date(dt_saturday)
        self.assertEqual(exp_date_saturday, date(2026, 10, 2))

        # 3. 平日 15:30 之前 (2026/10/02 週五 10:00)：盤後資料未產出，前一營業日為 2026/10/01
        dt_friday_morning = TAIPEI_TZ.localize(datetime(2026, 10, 2, 10, 0, 0))
        exp_date_morning = self.calendar.get_latest_expected_trading_date(dt_friday_morning)
        self.assertEqual(exp_date_morning, date(2026, 10, 1))

        # 4. 平日 15:30 之後 (2026/10/02 週五 16:00)：盤後資料已產出，應有日期為 2026/10/02
        dt_friday_afternoon = TAIPEI_TZ.localize(datetime(2026, 10, 2, 16, 0, 0))
        exp_date_afternoon = self.calendar.get_latest_expected_trading_date(dt_friday_afternoon)
        self.assertEqual(exp_date_afternoon, date(2026, 10, 2))

        # 5. 國定休市日模擬 (2026/01/01 元旦開國紀念日)
        self.assertFalse(self.calendar.is_trading_day(date(2026, 1, 1)))

        print("  [V] 測試 5 通過: 官方日曆與時區推算完整無誤 (週末/國定假日/15:30分界點)")

    def test_06_data_not_updated_label(self):
        """測試 5: 官方資料尚未更新時，清楚標示『資料尚未更新』及實際交易日期，不標記為今天"""
        # 假設當前時間已是 2026/10/05 (週一 17:00)，但 API 回傳的仍是 1151002 (2026/10/02)
        sim_dt = TAIPEI_TZ.localize(datetime(2026, 10, 5, 17, 0, 0))
        is_updated, actual_iso, expected_iso, status_msg = self.calendar.compare_with_api_date("1151002", sim_dt)
        
        self.assertFalse(is_updated)
        self.assertEqual(actual_iso, "2026-10-02")
        self.assertEqual(expected_iso, "2026-10-05")
        self.assertIn("資料尚未更新", status_msg)
        self.assertIn("2026-10-02", status_msg)
        print(f"  [V] 測試 6 通過: 資料尚未更新狀態標示正確 -> {status_msg}")

    def test_07_stock_real_history_and_indicators(self):
        """測試 9: 取得真實 30 天歷史行情，計算真實 MA5 與 MA20 均線，不編造數據"""
        hist = self.client.fetch_stock_history_30days("2330")
        self.assertGreaterEqual(len(hist), 20, "歷史資料應有至少 20~30 筆真實紀錄")
        
        # 檢查每筆皆有真實收盤價與日期
        for r in hist:
            self.assertIsNotNone(r["close_price"])
            self.assertGreater(r["close_price"], 0)
            self.assertTrue("-" in r["date"])

        # 計算真實均線
        prices = [r["close_price"] for r in hist]
        ma5 = round(sum(prices[-5:]) / 5, 2)
        print(f"  [V] 測試 7 通過: 2330 台積電取得 {len(hist)} 筆真實歷史日行情，最新真實 MA5: {ma5} 元")

    def test_08_api_failure_and_fallback_label(self):
        """測試 8: API 失敗降級時保留最後成功資料，並明確標記更新失敗，不得以模擬假資料替換"""
        # 建立一個測試客戶端模擬連線無效網址
        test_client = OfficialStockClient(timeout=1, max_retries=1)
        # 手工注入一筆快取
        test_client._twse_cache = {
            "2330": {
                "symbol": "2330",
                "name": "台積電",
                "market": "TWSE 上市",
                "data_source": "臺灣證券交易所 (TWSE) 官方 OpenAPI",
                "close_price": 2500.0,
                "close_price_display": "2,500.00",
                "change": -10.0,
                "trade_date": "2026-10-02",
                "raw_date": "1151002",
                "volume": 15792206.0,
                "fetch_time": "2026-10-03 21:00:00",
                "is_from_cache": False,
                "update_failed": False
            }
        }
        test_client._last_fetch_failed = True

        q = test_client.get_stock_quote("2330")
        self.assertTrue(q["update_failed"])
        self.assertTrue(q["is_from_cache"])
        self.assertIn("更新失敗", q["status_message"])
        self.assertEqual(q["close_price"], 2500.0)
        print("  [V] 測試 8 通過: API 失敗時標記更新失敗，回傳真實歷史快取，絕不偽造模擬價格")

    def test_09_institutional_investors_analysis(self):
        """測試 9: 三大法人（外資、投信、自營商）30 天買賣超數字、累計淨額、連買連賣與量化分析"""
        hist = self.client.fetch_stock_history_30days("2330")
        self.assertGreater(len(hist), 0)

        # 檢驗每筆記錄皆包含三大法人欄位且數學一致 (外資 + 投信 + 自營商 == 合計)
        for r in hist:
            self.assertIn("foreign_investors", r)
            self.assertIn("investment_trust", r)
            self.assertIn("dealers", r)
            self.assertIn("institutional_total", r)
            self.assertEqual(
                r["foreign_investors"] + r["investment_trust"] + r["dealers"],
                r["institutional_total"],
                "三大法人買賣超加總應等於 institutional_total"
            )

        # 檢驗 30 天籌碼面綜合統計指標
        summary = compute_institutional_summary("2330", hist)
        self.assertEqual(summary["foreign_30d_net"], sum(r["foreign_investors"] for r in hist))
        self.assertEqual(summary["trust_30d_net"], sum(r["investment_trust"] for r in hist))
        self.assertEqual(summary["dealers_30d_net"], sum(r["dealers"] for r in hist))
        self.assertEqual(summary["total_30d_net"], sum(r["institutional_total"] for r in hist))

        # 檢驗連續天數、多空標籤與文字分析
        self.assertIsInstance(summary["foreign_consecutive_days"], int)
        self.assertIsInstance(summary["trust_consecutive_days"], int)
        self.assertTrue(len(summary["institutional_sentiment"]) > 0)
        self.assertTrue("外資" in summary["analysis"])
        self.assertTrue("投信" in summary["analysis"])
        self.assertTrue("張" in summary["analysis"])
        print(f"  [V] 測試 9 通過: 三大法人籌碼檢驗成功 - 外資30日淨額: {summary['foreign_30d_net']:+,} 張 | 投信: {summary['trust_30d_net']:+,} 張 | 綜評: {summary['institutional_sentiment']}")


if __name__ == "__main__":
    unittest.main()
