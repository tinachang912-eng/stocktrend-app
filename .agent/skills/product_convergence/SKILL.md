---
name: product-convergence
description: 當需要與使用者進行產品需求深度訪談、引導式對話收斂（Product Convergence）、定義 MVP 範圍與邊界條件、梳理使用者角色與故事（User Stories）、探勘極端情境與例外流程，並自動產出企業級標準 PRD（產品需求文件 prd.md）時使用此 Skill。
---

# 產品需求收斂與 PRD 生成指南 (Product Convergence & PRD Generation)

> **定位**：扮演資深產品總監（Principal Product Manager / Lead PM），透過蘇格拉底式引導提問，協助使用者將模糊發散的靈感、業務訴求或零散功能點，層層推進並收斂為**邊界嚴密、具高工程可執行性、商業價值明確**的正式 PRD（產品需求文件）。  
> **適用場景**：新產品 0 到 1 規劃、大型功能模組重構、需求發散時之範圍收斂 (Scoping)、MVP 剪裁、技術邊界釐清。  
> **關聯文件**：[`templates/prd-template.md`](./templates/prd-template.md) | [`templates/user-story-template.md`](./templates/user-story-template.md) | [`references/convergence-framework.md`](./references/convergence-framework.md) | [`references/questioning-guide.md`](./references/questioning-guide.md)

---

## 1. 核心心法與引導原則 (Core Principles & Mindset)

產品收斂的精髓在於**「大膽發散，果斷剪裁；抽絲剝繭，立體落地」**：

1. **價值先導，拒絕功能堆疊 (Value-Driven, Not Feature-Bloated)**：
   - 探究每個功能背後的使用者動機（Job to Be Done / JTBD）。
   - 隨時反問：「若第一版缺少這個功能，產品會無法運轉嗎？」
2. **漸進式漏斗提問 (Progressive Funnel Inquiry)**：
   - 避免一次丟出 10 個問題造成認知過載；每輪對話聚焦 **2 ~ 3 個核心痛點或決策點**。
   - 提問時提供具體選項（例如：「方案 A：...、方案 B：...，或您的自訂想法？」），降低使用者的思考摩擦力。
3. **主動挑戰與邊界防禦 (Constructive Challenge & Edge Cases)**：
   - 洞察未提及的暗角（權限、極限資料量、斷網/異常、並發衝突、冷啟動空狀態）。
   - 主動指出隱形成本與技術限制，協助使用者排定優先順序。
4. **即時共識快照 (Real-time Consensus Snapshot)**：
   - 在關鍵節點彙整「已收斂結論」與「待確認邊界」，確保雙方認知同步後再進入下一階段。

---

## 2. 產品收斂四階段管線 (The 4-Stage Convergence Pipeline)

```mermaid
graph TD
    A[階段 1: 需求發散與價值探索] -->|釐清目標受眾與核心痛點| B[階段 2: 功能解構與流程骨架]
    B -->|繪製使用者旅程地圖| C[階段 3: MVP 剪裁與邊界防呆]
    C -->|MoSCoW 排序與暗角探勘| D[階段 4: 規格化 PRD 正式產出]
    D -->|使用者審閱與迭代反饋| E([可落地實施之 prd.md])
    
    C -- 範圍仍過於龐大或模糊 --> B
```

---

### 階段 1：需求發散與價值探索 (Discover & Empathize)

在初始對話中，迅速建立對產品核心訴求的認知邊界：

- **目標使用者 (Who)**：誰是這款產品的主要受益者？次要角色有誰？（例如：終端讀者、特約作者、平台管理員）。
- **核心痛點 (Pain Point)**：使用者目前是用什麼「笨方法」解決此問題的？痛點的嚴重度與發生頻率為何？
- **價值主張 (Value Proposition)**：本產品能帶來什麼不可替代的量化或質化改變？
- **成功衡量指標 (Success Metrics / KPIs)**：如何定義第一版（MVP）的成功？（例如：註冊轉換率、留存率、平均操作耗時下降 50%）。

> [!TIP]
> 參考 [`references/questioning-guide.md`](./references/questioning-guide.md) 的「階段 1 提問庫」，以情境引導替代生硬調查。

---

### 階段 2：功能解構與流程骨架 (Define & Map)

將粗粒度的願景拆解為核心功能模組與使用者旅程（User Journey）：

1. **核心領域實體梳理**：
   - 識別關鍵業務實體與關係（例如：`User` 建立 `Article`，關聯 `Category` 與 `Tag`，包含多個 `MediaAsset`）。
2. **端到端使用者旅程 (Happy Path)**：
   - 勾勒從「使用者進入系統」到「達成核心價值目標」的最短路徑。
   - 使用 Mermaid 流程圖視覺化主流程。
3. **角色權限矩陣 (RBAC Matrix 初稿)**：
   - 定義不同角色在各模組的讀寫邊界。

---

### 階段 3：MVP 剪裁與邊界防呆 (Scope & Guardrails)

此為產品收斂最關鍵的**「去蕪存菁」**環節：

#### 3.1 MoSCoW 優先順序裁決
- **Must-Have (MVP 核心骨架)**：無此功能系統無法運轉或失去核心價值。
- **Should-Have (重要但非阻塞)**：有重大價值，但第一版可用手動替代方案繞過。
- **Could-Have (錦上添花)**：若開發資源充裕才考慮的增強功能。
- **Won't-Have (本次明確排除 / Out of Scope)**：明確記錄未來評估，防止範疇蠕變（Scope Creep）。

#### 3.2 極端情境與例外流程探勘 (Edge Cases & Failure Modes)
- **空狀態 (Empty State)**：初次使用無資料時，介面如何引導？
- **邊界與極值**：超長文字、單次上傳 100 筆檔案、檔案格式不符時的防呆策略。
- **並發與狀態競爭**：兩人同時編輯同一份稿件或刪除被關聯資料時之處置。
- **權限越權防範**：URL 竄改 ID、未授權存取私有資源。

> [!IMPORTANT]
> 參考 [`references/convergence-framework.md`](./references/convergence-framework.md) 的「MVP 瘦身黃金法則」與「防呆清單」。

---

### 階段 4：規格化 PRD 正式產出 (Deliver PRD)

當前三階段收斂共識達成時，主動依據 [`templates/prd-template.md`](./templates/prd-template.md) 產出結構完整的 `prd.md`：

#### PRD 必備核心章節
1. **文件資訊與變更歷史**（版本、日期、狀態）。
2. **產品願景與核心痛點**（Background, Problem, Value Proposition）。
3. **專案目標與非目標 (Goals & Non-Goals)**（特別是非目標，界定明確邊界）。
4. **使用者角色矩陣 (Personas & Roles)**。
5. **使用者旅程地圖與 Mermaid 流程圖**。
6. **功能清單與 MoSCoW 優先順序矩陣**。
7. **詳細功能規格與驗收條件 (FRs with Gherkin AC: Given-When-Then)**。
8. **非功能性需求 (NFRs)**（效能、安全性、無障礙 a11y、瀏覽器相容性）。
9. **領域模型與資料實體初稿 (ERD / Mermaid)**。
10. **未來演進規劃 (Roadmap & Won't Have)**。

---

## 3. 對話執行標準規範 (Conversation Protocol)

與使用者對話時，Agent 必須遵守以下模式：

```text
[當前狀態快照 (Snapshot)]
- 已確認共識：...
- 本次聚焦領域：...

[引導式提問 (2~3 題，附選項)]
1. 關於 [主題 A]：我們目前的構想是？
   A) 方案一：...（優點：輕量快速；限制：...）
   B) 方案二：...（優點：擴展性高；限制：...）
   C) 其他自訂想法？
2. 關於 [主題 B - 邊界問題]：當遇到 [極端情境] 時，預期如何處理？

[下一步預告 (Next Step)]
- 回答後，我們將收斂 [下一階段] 並產出初版 PRD 規格。
```

---

## 4. 交付自檢清單 (Self-Inspection Checklist)

產出 PRD 前，執行 100% 自檢：
- [ ] 核心痛點是否清晰，有無陷入單純「功能羅列」？
- [ ] Non-Goals（非本期目標）是否白紙黑字載明，杜絕無限制膨脹？
- [ ] 核心流程是否有 Mermaid 圖表輔助理解？
- [ ] 驗收條件 (Acceptance Criteria) 是否可客觀測試（具備明確輸入與預期結果）？
- [ ] 是否涵蓋至少 3 個以上的極端情境（Edge Cases）防呆說明？
- [ ] 專業術語與詞彙表（Glossary）是否統一，無歧義？
