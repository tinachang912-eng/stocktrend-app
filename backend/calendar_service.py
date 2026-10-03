"""
calendar_service.py
官方交易日曆與營業日判斷服務
時區強制使用 Asia/Taipei
比對臺灣證券交易所 (TWSE) 官方休市行事曆
"""

import json
import urllib.request
import ssl
from datetime import datetime, date, time, timedelta
from typing import List, Set, Tuple
import pytz

TAIPEI_TZ = pytz.timezone("Asia/Taipei")

# TWSE 官方休市日曆 API
TWSE_HOLIDAY_API = "https://www.twse.com.tw/holidaySchedule/holidaySchedule?response=json"


class TradingCalendarService:
    def __init__(self):
        self._holidays: Set[str] = set()
        self._last_fetched: datetime = None
        self._ssl_ctx = ssl.create_default_context()
        self._ssl_ctx.check_hostname = False
        self._ssl_ctx.verify_mode = ssl.CERT_NONE

    def fetch_official_holidays(self) -> Set[str]:
        """從證交所官方 API 抓取休市行事曆（快取 24 小時）"""
        now = datetime.now(TAIPEI_TZ)
        if self._holidays and self._last_fetched and (now - self._last_fetched).total_seconds() < 86400:
            return self._holidays

        try:
            req = urllib.request.Request(
                TWSE_HOLIDAY_API,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                holidays = set()
                # data.get('data') 格式: [["2026-01-01", "開國紀念日", "依規定放假1日。"], ...]
                for row in data.get("data", []):
                    if len(row) >= 1 and row[0]:
                        raw_date = row[0].strip().replace("/", "-")
                        holidays.add(raw_date)
                self._holidays = holidays
                self._last_fetched = now
                return self._holidays
        except Exception as e:
            print(f"[Calendar] 抓取官方休市日曆失敗，使用備用固定日曆: {e}")
            # 若網路失敗，使用基本國定假日預備集合
            return self._get_fallback_holidays(now.year)

    def _get_fallback_holidays(self, year: int) -> Set[str]:
        # 基本已知固定假日
        return {
            f"{year}-01-01",
            f"{year}-02-28",
            f"{year}-05-01",
            f"{year}-10-10",
        }

    def is_trading_day(self, target_date: date) -> bool:
        """判斷特定日期是否為台股交易日（非週末且非官方休市日）"""
        # 1. 星期六 (5) 或 星期日 (6) 必然休市
        if target_date.weekday() >= 5:
            return False

        holidays = self.fetch_official_holidays()
        date_str = target_date.strftime("%Y-%m-%d")
        if date_str in holidays:
            return False

        return True

    def get_latest_expected_trading_date(self, current_dt: datetime = None) -> date:
        """
        根據官方交易日曆與台北時間，推算當前「應有的最近一個已完成交易日」。
        規則：
        - 使用 Asia/Taipei 時區。
        - 週一至週五交易日：
            * 若在 15:30 之前（盤後定價交易結束與交易所清算前），當日結算行情尚未產出，
              因此「應有的最近一個已完成交易日」為前一個交易日。
            * 若在 15:30 之後，當日盤後資料已發布，則為今日。
        - 週六、週日或官方休市日：
            * 往回追溯直到最近一個有效交易日。
        """
        if current_dt is None:
            current_dt = datetime.now(TAIPEI_TZ)
        elif current_dt.tzinfo is None:
            current_dt = TAIPEI_TZ.localize(current_dt)
        else:
            current_dt = current_dt.astimezone(TAIPEI_TZ)

        candidate_date = current_dt.date()
        cutoff_time = time(15, 30, 0)  # 官方結算報表發布基準線

        # 若今天剛好是交易日，但尚未到達 15:30 結算時間，則今天不算已完成
        if self.is_trading_day(candidate_date):
            if current_dt.time() < cutoff_time:
                candidate_date -= timedelta(days=1)
            else:
                return candidate_date

        # 若今天是週末、休市日，或尚未過 15:30 減了一天後，持續往回找直到找到交易日
        while not self.is_trading_day(candidate_date):
            candidate_date -= timedelta(days=1)

        return candidate_date

    def compare_with_api_date(self, api_roc_or_ce_date: str, current_dt: datetime = None) -> Tuple[bool, str, str, str]:
        """
        比對 API 回傳日期與官方日曆應有日期。
        回傳: (is_updated, actual_date_iso, expected_date_iso, status_message)
        """
        expected_date = self.get_latest_expected_trading_date(current_dt)
        expected_iso = expected_date.strftime("%Y-%m-%d")

        actual_iso = self.parse_taiwan_date(api_roc_or_ce_date)
        if not actual_iso:
            return False, "未知日期", expected_iso, "無法解析 API 回傳日期"

        actual_date = datetime.strptime(actual_iso, "%Y-%m-%d").date()

        if actual_date >= expected_date:
            return True, actual_iso, expected_iso, "資料已更新"
        else:
            return False, actual_iso, expected_iso, f"官方資料尚未更新（實際交易日期為 {actual_iso}）"

    @staticmethod
    def parse_taiwan_date(raw_date_str: str) -> str:
        """
        將民國年或西元年字串解析為標準 ISO 日期 YYYY-MM-DD
        支援:
        - "1151002" -> 2026-10-02
        - "115/10/02" -> 2026-10-02
        - "20261002" -> 2026-10-02
        - "2026-10-02" -> 2026-10-02
        - "2026/10/02" -> 2026-10-02
        """
        if not raw_date_str:
            return ""
        s = str(raw_date_str).strip().replace("/", "-")

        # 包含 "-" 的情況
        if "-" in s:
            parts = s.split("-")
            if len(parts) == 3:
                year = int(parts[0])
                if year < 1000:  # 民國年
                    year += 1911
                return f"{year:04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"

        # 純數字 7 碼 (如 1151002) 或 6 碼 (如 991002)
        if len(s) in (6, 7):
            roc_year = int(s[:-4])
            ce_year = roc_year + 1911
            month = int(s[-4:-2])
            day = int(s[-2:])
            return f"{ce_year:04d}-{month:02d}-{day:02d}"

        # 純數字 8 碼 (西元年 20261002)
        if len(s) == 8:
            return f"{s[:4]}-{s[4:6]}-{s[6:8]}"

        return s


calendar_service = TradingCalendarService()
