#!/usr/bin/env python3
"""Download officially published TWSE T86 daily institutional net shares.
Only exchange-reported fields; never estimate from stock prices.
"""
import datetime as dt
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "institutional_latest.json"
TZ = ZoneInfo("Asia/Taipei")

def number(value):
    text = str(value).replace(",", "").replace("+", "").strip()
    if text in {"", "--", "---", "N/A"}:
        raise ValueError("missing value")
    return int(text)

def index_of(fields, include, exclude=()):
    for i, field in enumerate(fields):
        name = re.sub(r"<[^>]+>", "", str(field)).replace(" ", "").replace("\n", "")
        if all(x in name for x in include) and not any(x in name for x in exclude):
            return i
    raise ValueError("missing T86 field " + repr(include))

def download(day):
    qs = urllib.parse.urlencode({"response":"json", "date":day.strftime("%Y%m%d"), "selectType":"ALLBUT0999"})
    url = "https://www.twse.com.tw/rwd/zh/fund/T86?" + qs
    request = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0", "Accept":"application/json"})
    with urllib.request.urlopen(request, timeout=24) as response:
        payload = json.load(response)
    fields, rows = payload.get("fields") or [], payload.get("data") or []
    if not fields or not rows:
        raise ValueError("No official rows for " + day.isoformat())
    symbol_i = index_of(fields, ["證券代號"])
    foreign_i = index_of(fields, ["外陸資買賣超股數"])
    trust_i = index_of(fields, ["投信買賣超股數"])
    dealer_i = index_of(fields, ["自營商買賣超股數"], ["自行買賣", "避險"])
    result = {}
    for row in rows:
        try:
            symbol = str(row[symbol_i]).strip()
            if not re.fullmatch(r"[0-9A-Za-z]{4,8}", symbol):
                continue
            foreign = number(row[foreign_i])
            trust = number(row[trust_i])
            dealer = number(row[dealer_i])
            # Exchange values are shares, displayed values are lots (1000 shares).
            result[symbol] = {"foreign": round(foreign/1000, 3),
                              "trust": round(trust/1000, 3),
                              "dealers": round(dealer/1000, 3),
                              "total": round((foreign+trust+dealer)/1000, 3)}
        except (IndexError, ValueError):
            continue
    if len(result) < 100:
        raise ValueError("Too few valid stocks: " + str(len(result)))
    return {"date":day.isoformat(), "source":"TWSE T86", "unit":"lots", "stocks":result}

def main():
    now = dt.datetime.now(TZ).date()
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    for offset in range(0, 9):
        day = now - dt.timedelta(days=offset)
        if day.weekday() >= 5:
            continue
        try:
            fresh = download(day)
            if previous.get("date", "") > fresh["date"]:
                print("Existing newer snapshot retained")
                return
            OUT.write_text(json.dumps(fresh, ensure_ascii=False, separators=(",",":"))+"\n", encoding="utf-8")
            print("Published", fresh["date"], "stocks", len(fresh["stocks"]))
            return
        except Exception as exc:
            print(day.isoformat(), str(exc))
            time.sleep(1)
    print("No valid official snapshot: retaining previous file, if present.")

if __name__ == "__main__":
    main()
