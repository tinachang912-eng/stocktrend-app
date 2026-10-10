---
name: architecture
description: 當需要進行全端系統架構設計、模組拆分、雙模運行機制設計（本地 API vs 雲端無伺服器靜態展示）、資料管線規劃、API 契約設計，或評估大型功能重構與技術選型時使用此 Skill。涵蓋前後端分離、資料庫/靜態快照存取分層、定時 CI/CD 管線與外部 OpenAPI 整合。
---

# 全端系統架構與工程設計規範 (System Architecture & Engineering Design)

> **定位**：定義現代全端系統與數據視覺化應用的高內聚、低耦合軟體架構，規範雙模運行機制（本地動態伺服器 + 雲端靜態展示）、資料流轉邊界、定時自動化管線與容錯降級架構。  
> **適用技術棧**：Python FastAPI + Uvicorn、原生 ES6+ JavaScript、HTML5、CSS Variables、Chart.js、GitHub Actions、GitHub Pages。  
> **關聯規範**：[`dev-guidelines.md`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/rules/dev-guidelines.md) | [`backend-integration`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/skills/backend-integration/SKILL.md)

---

## 1. 架構核心原則 (Core Architectural Principles)

1. **雙模共存與無縫降級 (Dual-Mode & Graceful Degradation)**：
   - 系統同時支援「本地全功能後端模式」與「雲端無伺服器靜態展示模式」。
   - 前端根據運行環境自動切換資料來源，在缺少後端服務時優雅降級為靜態快照，杜絕白畫面。
2. **單向資料流與職責解耦 (Unidirectional Data Flow & Layering)**：
   - 表現層（UI/DOM）專注互動渲染與使用者事件，不直接耦合第三方底層協議。
   - 資料處理層（Client/Pipeline）專責數值清洗、指標計算與格式正規化。
3. **契約先行與型別守門 (Contract-First & Type Integrity)**：
   - 所有實體資料（股票代碼、價格、指標物件）必須遵循嚴格的 Schema 約束，關鍵識別碼一律以字串鎖死型別。
4. **自動化資料管線 (Automated Data Pipeline)**：
   - 依賴 GitHub Actions 定時工作流實現靜態資料庫的定時自動更新，維持無伺服器架構之時效性。

---

## 2. 系統架構分層圖 (System Layered Architecture)

```mermaid
graph TD
    subgraph Client["前端表現層 (Frontend - Browser)"]
        UI["股價儀表板 • 技術指標卡片 • 走勢分析報告"]
        State["狀態機 (AppState: watchlist, selectedSymbol, mode)"]
        Chart["視覺化引擎 (Chart.js 趨勢折線圖)"]
    end

    subgraph ModeSwitch{"模式自動判定 (Dual-Mode Router)"}
        Detect["檢查 window.location.hostname"]
    end

    subgraph LocalBackend["本地後端服務層 (FastAPI @ localhost:8000)"]
        Router["API 路由 (backend/server.py)"]
        CalendarSvc["交易日曆服務 (calendar_service.py)"]
        OfficialClient["官方 OpenAPI 客戶端 (twse_tpex_client.py)"]
        Cache["本地容錯快取 (backend/cache/)"]
    end

    subgraph StaticStorage["靜態資料持久層 (Static Storage @ ./data/)"]
        QuotesData["當日全市場收盤快照 (data/quotes.json)"]
        CalData["官方日曆狀態 (data/calendar.json)"]
        HistData["30天歷史明細與均線 (data/history/*.json)"]
    end

    subgraph External["外部官方數據源 (Third-Party Providers)"]
        TWSE["臺灣證券交易所 (TWSE OpenAPI)"]
        TPEx["證券櫃檯買賣中心 (TPEx OpenAPI)"]
    end

    subgraph Automation["自動化 CI/CD 排程 (GitHub Actions)"]
        CronJob["每日 16:30 排程 (update-market-data.yml)"]
        ExportScript["資料匯出腳本 (backend/export_data.py)"]
    end

    UI --> State
    State --> Chart
    State --> Detect
    Detect -->|localhost / 127.0.0.1| Router
    Detect -->|GitHub Pages / 靜態端| StaticStorage

    Router --> CalendarSvc
    Router --> OfficialClient
    OfficialClient --> Cache
    OfficialClient --> TWSE
    OfficialClient --> TPEx

    CronJob --> ExportScript
    ExportScript --> OfficialClient
    ExportScript -->|更新快照並 Commit Push| StaticStorage
```

---

## 3. 分層職責與目錄約定 (Layer Responsibilities)

### 3.1 前端層 (`index.html`, `app.js`, `style.css`)
- **`index.html`**：語意化 DOM 骨架、SEO / Viewport Meta 配置、`<datalist>` 搜尋建議與快取版本號控制。
- **`app.js`**：掌管全域 `AppState`、生命週期調度、Chart.js 實例管理、LocalStorage 存取與使用者事件監聽。
- **`style.css`**：中央 Design Tokens 定義、暗色科技風格主題、RWD 斷點排版與無障礙焦點外框。

### 3.2 後端 API 服務層 (`backend/`)
- **`server.py`**：FastAPI 實例化、CORS 中介軟體配置、RESTful API 路由與例外錯誤統一包裝。
- **`calendar_service.py`**：處理 `Asia/Taipei` 時區計算、臺灣證交所國定假日判定、交易日曆校驗與時效比對。
- **`twse_tpex_client.py`**：底層 HTTP 客戶端，實作逾時（Timeout）、最大重試（Retry）、數值清洗防呆與離線快取（Cache）。
- **`export_data.py`**：全市場數據批次抓取與靜態 JSON 快照生成管線。

### 3.3 自動化與資料層 (`.github/`, `data/`)
- **`.github/workflows/update-market-data.yml`**：自動化工作流，定時調度 Python 腳本更新行情資料。
- **`data/`**：靜態 JSON 資料儲存區，供 GitHub Pages 直接以 HTTP GET 讀取。

---

## 4. 架構設計審查清單 (Architecture Review Checklist)

- [ ] **無單點故障**：當外部 API 故障或請求逾時，系統能降級至本地快取或靜態資料，不致當機。
- [ ] **CORS 隔離**：靜態前端不直接依賴無 CORS 標頭的外部 API，一律透過後端轉發或前置快照處理。
- [ ] **高內聚低耦合**：日曆邏輯、行情介接與展示邏輯各自獨立拆檔，互不越界。
- [ ] **可擴充性**：新增觀測標的僅需於匯出清單擴充代碼，無須修改底層核心管線架構。
