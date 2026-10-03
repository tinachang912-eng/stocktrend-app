---
description: 專案文件與技術規格撰寫規範 (Documentation & Markdown Writing Rules)
globs: ["**/*.md", "docs/**"]
---

# 文件撰寫規範 (Documentation Writing Guidelines)

本規範定義專案內各類技術文件、規格書（PRD、Spec、Architecture）、開發日誌及 Markdown 檔案的撰寫準則與排版格式，以確保專案文件的清晰度、一致性與可維護性。

---

## 1. 語言與用詞規範 (Language & Terminology)

1. **語系標準**：
   - 預設使用**繁體中文（台灣習慣用語）**進行撰寫。
   - 術語對照範例：
     - 使用者（User）、專案（Project）、程式碼（Code）、介面（Interface）
     - 伺服器（Server）、資料庫（Database）、快取（Cache）、模組（Module）
     - 預設（Default）、支援（Support）、非同步（Asynchronous）
2. **中英文排版間距（盤古之白）**：
   - 中文字與英文字母、數字之間，應保留半形空格。
   - 正確範例：`支援 85% 質量的 WebP 圖片轉碼`
   - 錯誤範例：`支援85%質量的WebP圖片轉碼`
3. **專有名詞規範**：
   - 專有名詞保持標準大小寫與拼寫，例如：`JavaScript`, `TypeScript`, `Node.js`, `Python`, `SQLite`, `PostgreSQL`, `RESTful API`, `JWT`, `HTML5`, `CSS3`。
   - 縮寫字首度出現時，建議附帶全稱或簡述（例如：`RBAC (Role-Based Access Control)`）。

---

## 2. 結構與排版層級 (Structure & Hierarchy)

1. **標題規範**：
   - 每份文件**僅能有一個 H1 標題**（`# 文件名稱`），作為整份文件的根主題。
   - 子章節嚴格依照階層遞增（`## H2` -> `### H3` -> `#### H4`），**嚴禁跳級**（例如：H1 直接跳至 H3）。
   - 標題文字應簡明具體，並可於括號內附註英文術語，利於檢索與多語言理解。
2. **段落與行距**：
   - 段落之間應空一行，保持版面透氣度。
   - 避免過長的大段文字（建議單一段落不超過 4-5 行），適當拆分段落或轉換為清單列點。
3. **清單與列表**：
   - 無順序關聯之要點說明，使用無序清單（`-`）。
   - 具備先後順序、操作流程或依賴關係之步驟，使用有序清單（`1.`, `2.`, `3.`）。

---

## 3. 程式碼與配置區塊 (Code Blocks & Snippets)

1. **行內代碼（Inline Code）**：
   - 變數名稱、函式名、檔案路徑、API 端點、指令參數等，一律以反引號包裹。
   - 範例：呼叫 `GET /api/v1/auth/me` 端點、設定 `backend/config.py` 中的 `SECRET_KEY`。
2. **區塊代碼（Fenced Code Blocks）**：
   - 必須明確宣告語言識別名稱（Syntax Highlighting Identifier）。
   - 常用語言標籤：`python`, `javascript`, `typescript`, `json`, `sql`, `bash`, `html`, `css`, `yaml`, `markdown`。
   - 無法對應特定語言之純文字或指令輸出，應標註 `text`，不得留空。

---

## 4. 圖表與視覺化呈現 (Diagrams & Visualizations)

1. **架構與流程圖**：
   - 系統架構圖、業務流程、狀態機轉換與資料流，優先採用 **Mermaid** 語法繪製，以便於版本控管與後續迭代維護。
   - 範例：
     ```mermaid
     graph TD
         Client[前端介面] --> API[後端 API]
         API --> DB[(資料庫)]
     ```
2. **多維度資料與比對**：
   - 權限矩陣、API 參數表、效能指標比較等結構化資訊，優先採用 Markdown 表格呈現。
   - 表格標題列下方需明確設定對齊方向（如 `:---` 置左、`:---:` 置中、`---:` 置右）。

---

## 5. 提示框與強調語法 (Callouts / Alerts)

重要說明、注意事項或安全提醒，應採用標準 GitHub 風格之 Callout / Alert 語法：

> [!NOTE]
> 提供背景資訊、延伸說明或輔助脈絡。

> [!TIP]
> 提供最佳實踐、效率提升小技巧或效能建議。

> [!IMPORTANT]
> 強調核心需求、關鍵前置條件或必備操作步驟。

> [!WARNING]
> 標示破壞性變更、相容性限制或潛在風險。

> [!CAUTION]
> 警示高風險操作，如資料遺失、安全性漏洞或不可逆異動。

---

## 6. 文件中繼資訊與生命週期 (Metadata & Maintenance)

1. **重要文件頭部資訊**：
   - 正式規格文件（如 PRD、架構規格書）頂部應包含中繼資料區塊：
     ```markdown
     > **版本**：v1.0.0  
     > **最後更新**：YYYY-MM-DD  
     > **狀態**：草稿 (Draft) / 審查中 (In Review) / 已核准 (Approved)  
     > **維護人員**：[名稱 / 角色]
     ```
2. **安全與機密性保護**：
   - **嚴禁**在文件內寫入任何真實的敏感憑證（如私鑰、資料庫連線密碼、生產環境 API Token）。
   - 一律使用環境變數代稱或佔位符替代（例如：`os.getenv("JWT_SECRET")` 或 `YOUR_API_KEY_HERE`）。
3. **檔案連結完整性**：
   - 參照專案內部檔案時，建議採用相對路徑或標準超連結語法，並定期確保檔案路徑正確無死鏈。
