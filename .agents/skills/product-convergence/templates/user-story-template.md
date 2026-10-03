# 使用者故事與驗收準則標準範本 (User Story & Acceptance Criteria)

> **說明**：本範本用於在產品收斂階段，將粗粒度的功能需求具體解構為工程團隊可直接排程、估點與進行測試驗收的原子化工作單元。

---

## 1. 使用者故事標準格式 (User Story Structure)

```text
標題：[US-編號] [簡短動態描述，例如：身為作者，我希望能即時自動儲存草稿]

As a (身為)   : [具體角色 / Persona，例如：專欄特約作者]
I want to (我希望) : [執行的行為或擁有的能力，例如：在撰寫文章時，系統能每隔 3 秒於背景自動儲存文稿]
So that (以便於)  : [獲得的商業或體驗價值，例如：避免因網路波動或瀏覽器當機造成心血遺失]
```

---

## 2. 故事詳細屬性表 (Story Attributes)

| 欄位 | 填寫規範 | 範例 |
| :--- | :--- | :--- |
| **故事編號** | `US-{模組簡稱}-{流水號}` | `US-ART-01` |
| **所屬史詩 (Epic)** | 歸屬的宏觀模組 | 內容編輯與審批流程 |
| **優先順序** | `P0 (Must)` / `P1 (Should)` / `P2 (Could)` | `P0 (Must)` |
| **故事點數 (Story Points)** | 費氏數列估算複雜度 (1, 2, 3, 5, 8, 13) | `3` |
| **前置相依 (Dependencies)** | 必須先完成的項目或 API | `US-AUTH-02 (JWT 驗證 API)` |
| **影響範圍** | 涉及之後端模組 / 前端組件 | `ArticleEditor.jsx`, `POST /api/v1/articles` |

---

## 3. 驗收準則 (Acceptance Criteria - Gherkin Given/When/Then)

每個使用者故事至少應涵蓋 **正常情境 (Happy Path)** 與 **至少 2 個例外/邊界情境 (Negative / Edge Cases)**：

### 準則 1：正常情境 (Happy Path - 背景靜默自動儲存)
```gherkin
Scenario: 編輯中停止打字自動觸發儲存
  Given 使用者已登入且處於文章編輯頁面
  And 目前文章內容與前次儲存記錄存在變更
  When 使用者停止鍵盤輸入達 3 秒鐘
  Then 系統背景發送 PATCH /api/v1/articles/{id} 請求
  And 介面右上角更新儲存時間標籤為「已於 HH:mm:ss 自動儲存」
  And 不產生阻斷使用者輸入之 Loading 遮罩
```

### 準則 2：例外情境 (Edge Case 1 - 斷網或後端逾時)
```gherkin
Scenario: 網路中斷時之本地降級保存
  Given 使用者處於離線狀態 (斷網)
  When 自動儲存計時器觸發
  Then 系統檢測到網路異常並攔截錯誤
  And 將文稿暫存於瀏覽器 localStorage
  And 介面提示黃色警示圖標「目前處於離線狀態，已為您暫存至本地」
  And 當網路恢復連線時，自動重新嘗試同步至後端
```

### 準則 3：邊界情境 (Edge Case 2 - 內容為空或無效字元)
```gherkin
Scenario: 嘗試儲存空白標題或純空格內容
  Given 文章標題僅填寫空白字元
  When 使用者點擊「提交審核」按鈕
  Then 系統阻擋請求發送
  And 標題輸入框聚焦並呈現紅色外框
  And 顯示微反饋提示「文章標題不得為純空白」
```

---

## 4. 完工定義檢核表 (Definition of Done - DoD)

本故事視為正式交付前，需通過以下標準：
- [ ] **功能實作**：前後端邏輯符合上述所有 Given-When-Then 驗收情境。
- [ ] **自動化測試**：單元測試 (Unit Test) 與 API 測試通過，且無 Regressions。
- [ ] **錯誤處理**：所有 API 調用均具備 Try-Catch 與使用者友善 Toast 提示。
- [ ] **無障礙與視覺**：符合 Design Tokens 色彩規範，支援鍵盤焦點訪問。
- [ ] **代碼審查 (Code Review)**：經由至少 1 位同儕審核通過，無安全漏洞。
