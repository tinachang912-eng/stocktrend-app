"""
twse_tpex_client.py
臺灣證券交易所 (TWSE) 與 證券櫃檯買賣中心 (TPEx) 官方行情資料介接客戶端
實作重試 (Retry)、逾時 (Timeout)、快取 (Cache) 與失敗降級標記
"""

import json
import os
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, List, Tuple
import pytz

from calendar_service import calendar_service, TAIPEI_TZ

# 官方 API 端點
TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
TWSE_STOCK_DAY_HIST_URL = "https://www.twse.com.tw/exchangeReport/STOCK_DAY"

TPEX_QUOTES_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"
TPEX_CLOSE_QUOTES_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
TPEX_HIST_URL = "https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock"

# 快取目錄
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_FILE = os.path.join(CACHE_DIR, "market_quotes_cache.json")


def clean_price_val(val: Any) -> Optional[float]:
    """
    清理價格字串，正確處理逗號、空白、'--'、'null'
    缺少有效價格時回傳 None，絕對不可轉成 0！
    """
    if val is None:
        return None
    s = str(val).strip().replace(",", "")
    if not s or s in ("--", "-", "null", "None", ""):
        return None
    try:
        f = float(s)
        # 若官方給出 0 且成交股數為 0，通常為未成交無收盤價
        if f <= 0:
            return None
        return round(f, 2)
    except (ValueError, TypeError):
        return None


def clean_number_val(val: Any) -> Optional[float]:
    """清理一般數值（如漲跌價差，可為正負或零）"""
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace("+", "")
    if not s or s in ("--", "-", "null", "None", ""):
        return None
    try:
        return round(float(s), 2)
    except (ValueError, TypeError):
        return None


class OfficialStockClient:
    def __init__(self, timeout: int = 8, max_retries: int = 3):
        self.timeout = timeout
        self.max_retries = max_retries
        self._ssl_ctx = ssl.create_default_context()
        self._ssl_ctx.check_hostname = False
        self._ssl_ctx.verify_mode = ssl.CERT_NONE

        # 記憶體快取
        self._twse_cache: Dict[str, Dict[str, Any]] = {}
        self._tpex_cache: Dict[str, Dict[str, Any]] = {}
        self._history_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}

        self._last_twse_fetch_time: Optional[datetime] = None
        self._last_tpex_fetch_time: Optional[datetime] = None
        self._last_fetch_failed: bool = False
        self._last_error_message: str = ""

        # 嘗試從磁碟還原最後成功快取
        self._load_disk_cache()

    def _load_disk_cache(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._twse_cache = data.get("twse", {})
                    self._tpex_cache = data.get("tpex", {})
                    if data.get("twse_time"):
                        self._last_twse_fetch_time = datetime.fromisoformat(data["twse_time"])
                    if data.get("tpex_time"):
                        self._last_tpex_fetch_time = datetime.fromisoformat(data["tpex_time"])
                    print(f"[Client] 已從磁碟快取載入 {len(self._twse_cache)} 檔上市與 {len(self._tpex_cache)} 檔上櫃股票")
            except Exception as e:
                print(f"[Client] 讀取磁碟快取失敗: {e}")

    def _save_disk_cache(self):
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "twse": self._twse_cache,
                    "tpex": self._tpex_cache,
                    "twse_time": self._last_twse_fetch_time.isoformat() if self._last_twse_fetch_time else None,
                    "tpex_time": self._last_tpex_fetch_time.isoformat() if self._last_tpex_fetch_time else None,
                }, f, ensure_ascii=False)
        except Exception as e:
            print(f"[Client] 寫入磁碟快取失敗: {e}")

    def _http_get_with_retry(self, url: str, headers: Optional[Dict[str, str]] = None) -> bytes:
        """帶逾時與重試機制的 HTTP GET 請求"""
        if headers is None:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*"
            }

        last_err = None
        for attempt in range(1, self.max_retries + 1):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=self.timeout) as resp:
                    if resp.status == 200:
                        return resp.read()
                    raise RuntimeError(f"HTTP Status {resp.status}")
            except Exception as e:
                last_err = e
                # 指數退避
                if attempt < self.max_retries:
                    time.sleep(attempt * 0.8)

        raise RuntimeError(f"連線 {url} 失敗（已重試 {self.max_retries} 次）：{last_err}")

    def _http_post_with_retry(self, url: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> bytes:
        """帶逾時與重試機制的 HTTP POST 請求"""
        if headers is None:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://www.tpex.org.tw",
                "Referer": "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html"
            }

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        last_err = None
        for attempt in range(1, self.max_retries + 1):
            try:
                req = urllib.request.Request(url, data=encoded_data, headers=headers)
                with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=self.timeout) as resp:
                    if resp.status == 200:
                        return resp.read()
                    raise RuntimeError(f"HTTP Status {resp.status}")
            except Exception as e:
                last_err = e
                if attempt < self.max_retries:
                    time.sleep(attempt * 0.8)

        raise RuntimeError(f"POST {url} 失敗（已重試 {self.max_retries} 次）：{last_err}")

    # =========================================================================
    # 上市市場 (TWSE) 全市場收盤行情
    # =========================================================================
    def fetch_twse_quotes(self, force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        now = datetime.now(TAIPEI_TZ)
        # 快取 10 分鐘
        if not force_refresh and self._twse_cache and self._last_twse_fetch_time:
            if (now - self._last_twse_fetch_time).total_seconds() < 600:
                return self._twse_cache

        try:
            raw_bytes = self._http_get_with_retry(TWSE_STOCK_DAY_ALL_URL)
            items = json.loads(raw_bytes.decode("utf-8"))
            parsed_dict = {}

            for item in items:
                code = str(item.get("Code", "")).strip()
                if not code:
                    continue

                close_price = clean_price_val(item.get("ClosingPrice"))
                change_val = clean_number_val(item.get("Change"))
                name = str(item.get("Name", "")).strip()
                raw_date = str(item.get("Date", "")).strip()
                volume = clean_number_val(item.get("TradeVolume"))

                trade_date = calendar_service.parse_taiwan_date(raw_date)

                parsed_dict[code] = {
                    "symbol": code,
                    "name": name,
                    "market": "TWSE 上市",
                    "data_source": "臺灣證券交易所 (TWSE) 官方 OpenAPI",
                    "close_price": close_price,
                    "close_price_display": f"{close_price:,.2f}" if close_price is not None else "無有效收盤價",
                    "change": change_val,
                    "trade_date": trade_date,
                    "raw_date": raw_date,
                    "volume": volume,
                    "fetch_time": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_from_cache": False,
                    "update_failed": False
                }

            self._twse_cache = parsed_dict
            self._last_twse_fetch_time = now
            self._last_fetch_failed = False
            self._save_disk_cache()
            return self._twse_cache

        except Exception as e:
            print(f"[TWSE] 抓取上市行情失敗: {e}")
            self._last_fetch_failed = True
            self._last_error_message = str(e)
            if self._twse_cache:
                # 降級使用既有快取，但標示更新失敗
                return self._twse_cache
            raise

    # =========================================================================
    # 上櫃市場 (TPEx) 全市場收盤行情
    # =========================================================================
    def fetch_tpex_quotes(self, force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        now = datetime.now(TAIPEI_TZ)
        if not force_refresh and self._tpex_cache and self._last_tpex_fetch_time:
            if (now - self._last_tpex_fetch_time).total_seconds() < 600:
                return self._tpex_cache

        try:
            # 優先呼叫 tpex_mainboard_quotes
            raw_bytes = self._http_get_with_retry(TPEX_QUOTES_URL)
            items = json.loads(raw_bytes.decode("utf-8"))
            parsed_dict = {}

            for item in items:
                code = str(item.get("SecuritiesCompanyCode", "")).strip()
                if not code:
                    continue

                close_price = clean_price_val(item.get("Close"))
                change_val = clean_number_val(item.get("Change"))
                name = str(item.get("CompanyName", "")).strip()
                raw_date = str(item.get("Date", "")).strip()
                volume = clean_number_val(item.get("TradingShares"))

                trade_date = calendar_service.parse_taiwan_date(raw_date)

                parsed_dict[code] = {
                    "symbol": code,
                    "name": name,
                    "market": "TPEx 上櫃",
                    "data_source": "證券櫃檯買賣中心 (TPEx) 官方 OpenAPI",
                    "close_price": close_price,
                    "close_price_display": f"{close_price:,.2f}" if close_price is not None else "無有效收盤價",
                    "change": change_val,
                    "trade_date": trade_date,
                    "raw_date": raw_date,
                    "volume": volume,
                    "fetch_time": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_from_cache": False,
                    "update_failed": False
                }

            self._tpex_cache = parsed_dict
            self._last_tpex_fetch_time = now
            self._save_disk_cache()
            return self._tpex_cache

        except Exception as e:
            print(f"[TPEx] 抓取上櫃行情失敗: {e}")
            if self._tpex_cache:
                return self._tpex_cache
            raise

    # =========================================================================
    # 取得單一股票最新收盤價與完整狀態
    # =========================================================================
    def get_stock_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        clean_sym = str(symbol).strip()

        # 1. 搜尋上市
        try:
            twse_dict = self.fetch_twse_quotes()
        except Exception:
            twse_dict = self._twse_cache

        quote_data = twse_dict.get(clean_sym)
        is_twse = quote_data is not None

        # 2. 若上市找不到，搜尋上櫃
        if not quote_data:
            try:
                tpex_dict = self.fetch_tpex_quotes()
            except Exception:
                tpex_dict = self._tpex_cache
            quote_data = tpex_dict.get(clean_sym)

        if not quote_data:
            return None

        # 複製並結合官方日曆檢查
        res = dict(quote_data)
        now = datetime.now(TAIPEI_TZ)

        is_updated, actual_iso, expected_iso, status_msg = calendar_service.compare_with_api_date(
            res.get("raw_date", ""), now
        )

        res["is_updated"] = is_updated
        res["trade_date"] = actual_iso
        res["expected_trade_date"] = expected_iso
        res["status_message"] = status_msg

        # 標註是否更新失敗降級
        if self._last_fetch_failed:
            res["update_failed"] = True
            res["status_message"] = f"API 更新失敗（顯示最後成功暫存）：實際交易日為 {actual_iso}"
            res["is_from_cache"] = True

        return res

    # =========================================================================
    # 取得個股真實 30 天歷史行情 (歷史日成交資訊)
    # =========================================================================
    def fetch_stock_history_30days(self, symbol: str) -> List[Dict[str, Any]]:
        clean_sym = str(symbol).strip()
        now_ts = time.time()

        # 記憶體快取 1 小時
        if clean_sym in self._history_cache:
            cache_ts, records = self._history_cache[clean_sym]
            if now_ts - cache_ts < 3600 and len(records) >= 20:
                return records

        # 判斷是上市還是上櫃
        quote = self.get_stock_quote(clean_sym)
        is_tpex = quote and "TPEx" in quote.get("market", "")

        today = datetime.now(TAIPEI_TZ).date()
        # 需抓取當月與上個月以湊齊至少 30 個營業日
        first_day_cur = today.replace(day=1)
        prev_month_end = first_day_cur - timedelta(days=1)
        first_day_prev = prev_month_end.replace(day=1)

        dates_to_fetch = [
            first_day_prev.strftime("%Y%m01"),
            first_day_cur.strftime("%Y%m01")
        ]

        raw_history_rows = []

        if not is_tpex:
            # TWSE STOCK_DAY
            for d_str in dates_to_fetch:
                url = f"{TWSE_STOCK_DAY_HIST_URL}?response=json&date={d_str}&stockNo={clean_sym}"
                try:
                    resp_bytes = self._http_get_with_retry(url)
                    data = json.loads(resp_bytes.decode("utf-8"))
                    if data.get("stat") == "OK" and "data" in data:
                        raw_history_rows.extend(data["data"])
                except Exception as e:
                    print(f"[History] 抓取上市 {clean_sym} 月資料 {d_str} 失敗: {e}")
        else:
            # TPEx afterTrading/tradingStock (POST)
            for d_str in [first_day_prev.strftime("%Y/%m/01"), first_day_cur.strftime("%Y/%m/01")]:
                try:
                    post_data = {"code": clean_sym, "date": d_str, "response": "json"}
                    resp_bytes = self._http_post_with_retry(TPEX_HIST_URL, post_data)
                    data = json.loads(resp_bytes.decode("utf-8"))
                    if data.get("stat") == "ok" and "tables" in data and data["tables"]:
                        t_data = data["tables"][0].get("data", [])
                        raw_history_rows.extend(t_data)
                except Exception as e:
                    print(f"[History] 抓取上櫃 {clean_sym} 月資料 {d_str} 失敗: {e}")

        # 解析並排序（由舊到新）
        parsed_records = []
        for row in raw_history_rows:
            if len(row) >= 7:
                date_iso = calendar_service.parse_taiwan_date(row[0])
                c_price = clean_price_val(row[6])
                chg = clean_number_val(row[7]) if len(row) > 7 else 0.0
                vol = clean_number_val(row[1])
                if date_iso and c_price is not None:
                    parsed_records.append({
                        "date": date_iso,
                        "close_price": c_price,
                        "change": chg if chg is not None else 0.0,
                        "volume": vol if vol is not None else 0.0
                    })

        # 去重並依日期排序
        unique_dict = {r["date"]: r for r in parsed_records}
        sorted_records = [unique_dict[d] for d in sorted(unique_dict.keys())]

        # 取最近 30 筆真實營業日
        final_records = sorted_records[-30:] if len(sorted_records) >= 30 else sorted_records

        if final_records:
            self._history_cache[clean_sym] = (now_ts, final_records)

        return final_records


official_client = OfficialStockClient()
