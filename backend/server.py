"""
server.py
台股趨勢分析小幫手 - 官方行情後端服務
基於 FastAPI + Uvicorn
"""

import sys
import os
from typing import List, Optional
from datetime import datetime
import pytz

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 加入當前目錄以引用模組
sys.path.insert(0, os.path.dirname(__file__))

from calendar_service import calendar_service, TAIPEI_TZ
from twse_tpex_client import official_client, compute_institutional_summary

app = FastAPI(
    title="台股趨勢分析官方行情 API",
    description="串接臺灣證券交易所 (TWSE) 與 證券櫃檯買賣中心 (TPEx) 官方 OpenAPI",
    version="2.0.0"
)

# 允許跨域請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    now_taipei = datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "status": "online",
        "service": "台股趨勢分析官方行情服務",
        "taipei_time": now_taipei,
        "timezone": "Asia/Taipei"
    }


@app.get("/api/stock/quote")
def get_quote(symbol: str = Query(..., description="股票代號（字串，保留前導0）")):
    """
    取得單檔股票的最近交易日收盤價與官方日曆比對資訊
    """
    clean_symbol = str(symbol).strip()
    quote = official_client.get_stock_quote(clean_symbol)
    if not quote:
        raise HTTPException(
            status_code=404,
            detail=f"在證交所 (TWSE) 與櫃買中心 (TPEx) 官方資料中查無代號 [{clean_symbol}] 之股票。"
        )
    return quote


@app.get("/api/stocks/batch")
def get_batch_quotes(symbols: str = Query("2330,2308,2454", description="逗號分隔的股票代號字串")):
    """
    批次取得多檔股票最新官方行情
    """
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    results = []
    not_found = []

    for sym in sym_list:
        q = official_client.get_stock_quote(sym)
        if q:
            results.append(q)
        else:
            not_found.append(sym)

    return {
        "count": len(results),
        "data": results,
        "not_found": not_found
    }


@app.get("/api/stock/history")
def get_history(symbol: str = Query(..., description="股票代號")):
    """
    取得個股真實 30 個營業日之歷史成交數據與真實均線
    不得由 AI 編造！100% 官方真實行情
    """
    clean_symbol = str(symbol).strip()
    records = official_client.fetch_stock_history_30days(clean_symbol)

    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"無法取得代號 [{clean_symbol}] 之官方 30 天歷史行情資料"
        )

    # 計算真實均線
    prices = [r["close_price"] for r in records if r["close_price"] is not None]
    
    # 5日均線 (MA5)
    ma5 = round(sum(prices[-5:]) / len(prices[-5:]), 2) if len(prices) >= 5 else (round(sum(prices) / len(prices), 2) if prices else None)
    
    # 20日均線 (MA20)
    ma20 = round(sum(prices[-20:]) / len(prices[-20:]), 2) if len(prices) >= 20 else (round(sum(prices) / len(prices), 2) if prices else None)

    high_30 = max(prices) if prices else None
    low_30 = min(prices) if prices else None

    # 最新一筆收盤與前一日比較計算真實 BIAS
    latest_price = prices[-1] if prices else None
    bias_5 = round(((latest_price - ma5) / ma5) * 100, 2) if (latest_price and ma5) else 0.0
    bias_20 = round(((latest_price - ma20) / ma20) * 100, 2) if (latest_price and ma20) else 0.0

    # 計算三大法人 30 天籌碼面指標與分析
    institutional_summary = compute_institutional_summary(clean_symbol, records)

    return {
        "symbol": clean_symbol,
        "total_days": len(records),
        "history": records,
        "indicators": {
            "ma5": ma5,
            "ma20": ma20,
            "high_30": high_30,
            "low_30": low_30,
            "bias_5": bias_5,
            "bias_20": bias_20
        },
        "institutional": institutional_summary
    }


@app.get("/api/stock/institutional")
def get_institutional(symbol: str = Query(..., description="股票代號")):
    """
    取得個股最近 30 天三大法人（外資、投信、自營商）買賣超數據與籌碼面量化分析
    """
    clean_symbol = str(symbol).strip()
    records = official_client.fetch_stock_history_30days(clean_symbol)

    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"無法取得代號 [{clean_symbol}] 之三大法人籌碼歷史資料"
        )

    inst_summary = compute_institutional_summary(clean_symbol, records)

    return {
        "symbol": clean_symbol,
        "total_days": len(records),
        "history": records,
        "summary": inst_summary
    }


@app.get("/api/market/calendar")
def get_market_calendar():
    """
    取得官方交易日曆與市場休市資訊
    """
    now = datetime.now(TAIPEI_TZ)
    latest_expected = calendar_service.get_latest_expected_trading_date(now)
    is_today_trading = calendar_service.is_trading_day(now.date())
    holidays = sorted(list(calendar_service.fetch_official_holidays()))

    return {
        "taipei_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": "Asia/Taipei",
        "is_today_trading_day": is_today_trading,
        "latest_expected_trading_date": latest_expected.strftime("%Y-%m-%d"),
        "official_holidays": holidays
    }


if __name__ == "__main__":
    import uvicorn
    # 支援本機與區域網路連線
    uvicorn.run(app, host="0.0.0.0", port=8000)
