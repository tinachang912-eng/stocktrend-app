---
name: coding-standards
description: 當編寫、格式化或規範專案中的 Python、JavaScript、HTML、CSS 程式碼與 Git 提交紀錄時使用此 Skill。規範命名慣例、模組職責、防禦性編程、前導零型別保護、盤古之白（中英文間距）與 Git 提交規範（Conventional Commits）。
---

# 程式碼編寫與品質規範 (Coding Standards & Clean Code)

> **定位**：為全端專案提供高一致性、可讀性強且防禦嚴密的編程規範，降低維護成本與團隊認知負擔。  
> **適用技術棧**：Python 3.10+ (PEP 8)、JavaScript (ES6+)、HTML5、CSS3、Git。  
> **關聯規範**：[`dev-guidelines.md`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/rules/dev-guidelines.md) | [`docs-writing.md`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/rules/docs-writing.md)

---

## 1. 核心開發心法 (Core Coding Philosophies)

1. **可讀性優先於簡寫炫技 (Readability over Cleverness)**：
   - 程式碼是寫給人看的，只是順便能被電腦執行。避免使用過度晦澀的單行運算子或深層巢狀三元表達式。
2. **提早返回原則 (Early Return Pattern)**：
   - 優先處理邊界條件、參數無效或空值情況並立即返回（Guard Clause），減少多層 `if...else` 縮排。
3. **無死角防禦性編程 (Defensive Programming)**：
   - 永遠假設外部輸入、非同步回傳值可能為 `null`、`undefined` 或型別不符，善用安全鏈接（Optional Chaining `?.`）與空值合併（Nullish Coalescing `??`）。
4. **型別一致性與零破壞 (Strict Type Integrity)**：
   - 具備前導零的識別字串（如股票代碼 `0050`、`00631L`），在各層級傳遞中**嚴禁轉為數字型別**。

---

## 2. Python (FastAPI & 資料處理) 編程標準

### 2.1 命名規範
- **變數與函式**：採用 `snake_case`（例如：`clean_price_val`、`fetch_stock_history_30days`）。
- **類別與模型**：採用 `PascalCase`（例如：`OfficialStockClient`、`CalendarService`）。
- **常數**：採用全大寫底線 `UPPER_SNAKE_CASE`（例如：`TAIPEI_TZ = pytz.timezone("Asia/Taipei")`）。

### 2.2 型別標註 (Type Hints)
所有核心函式參數與回傳值必須明確標註型別：

```python
from typing import Optional, List, Dict, Any, Tuple

def fetch_stock_history_30days(symbol: str) -> List[Dict[str, Any]]:
    clean_sym = str(symbol).strip().upper()
    if not clean_sym:
        return []
    # 核心邏輯...
```

---

## 3. JavaScript (前端互動與狀態機) 編程標準

### 3.1 宣告與現代語法
- **禁止使用 `var`**：一律使用 `const` 宣告，僅在變數需重新指派時使用 `let`。
- **解構賦值與預設值**：善用物件與陣列解構，避免重複存取深層屬性。

### 3.2 字串清洗與安全取得
```javascript
// 股票代號正規化：保留前導 0 與英文字母後綴
function normalizeSymbol(input) {
  if (!input) return '';
  const match = String(input).trim().match(/^[0-9A-Za-z]{4,6}/);
  return match ? match[0].toUpperCase() : '';
}

// 安全取得指標數值，防止 undefined 爆錯
const ma5 = historyData?.indicators?.ma5 ?? null;
```

---

## 4. 排版與中英文間距規範 (盤古之白)

在註解、文件、介面標籤與 Toast 提示訊息中，必須落實**盤古之白**（中文字與英文字母、數字之間保留一個半形空格）：
-  **正確範例**：`取得最近 30 個營業日官方成交資料`、`支援 MA5 與 MA20 均線運算`。
- ❌ **錯誤範例**：`取得最近30個營業日官方成交資料`、`支援MA5與MA20均線運算`。

---

## 5. Git 提交規範 (Conventional Commits)

專案一律遵循標準 Conventional Commits 格式：
`<type>(<scope>): <精簡動賓結構描述>`

| Type | 適用情境 | 範例 |
| :--- | :--- | :--- |
| `feat` | 新增功能或個股支援 | `feat: 新增川湖 (2059) 官方歷史走勢與搜尋建議` |
| `fix` | 修復 Bug 或邏輯防呆 | `fix: 修復切換股票時舊圖表殘留問題` |
| `style` | 介面樣式、排版與 a11y 優化 | `style(ux): 完善 a11y 鍵盤焦點與小螢幕排版` |
| `docs` | 文件、規範與註解變更 | `docs(rules): 更新台股工具全端開發規範` |
| `refactor` | 不影響行為之架構重構 | `refactor: 模組化日曆服務與時區計算函式` |
| `test` | 新增或維護自動化測試 | `test: 補齊 30 天均線計算與空值清洗單元測試` |
| `chore` | 構建設定或例行資料更新 | `chore(data): 自動更新官方台股最新收盤行情` |
