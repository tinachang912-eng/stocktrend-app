---
name: ui-design
description: 當進行網頁 UI 介面設計、版面佈局規劃、響應式排版（RWD）、設計系統（Design Tokens/CSS Variables）、深淺色雙主題適配、無障礙規範（WCAG AA/a11y）或微互動與視覺反饋設計時使用此 Skill。
---

# UI/UX 介面設計與設計系統規範 (UI Design & Design Systems)

> **定位**：建立高品質、具備美學一致性、可維護且符合無障礙規範（a11y）的前端介面設計標準。  
> **適用技術棧**：原生 CSS3 Variables、React 18、現代 CSS Grid / Flexbox、語意化 HTML5。  
> **關聯規範**：[`vibe-coding-frontend-builder`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/skills/vibe-coding-frontend-builder/SKILL.md) | [`ux-check`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/skills/ux-check/SKILL.md)

---

## 1. UI 設計核心原則 (Core UI Principles)

1. **Design Tokens 驅動 (Token-Driven)**：
   - 嚴格禁止在元件內部寫死（Hardcode）色碼與尺寸值。
   - 所有色彩、字型、間距、圓角與陰影，一律由 CSS 變數（CSS Custom Properties）集中控制。
2. **階層明確與視覺秩序 (Visual Hierarchy)**：
   - 善用字重（Font Weight）、字級（Font Size）與字色明暗（Primary / Muted / Light）引導使用者視覺焦點。
   - 避免畫面中出現多個平起平坐的主要行動點（Primary CTA），每個視圖最多一個主按鈕。
3. **無死角互動狀態 (Complete Interaction States)**：
   - 任何可互動元素（按鈕、卡片、導航項、表單欄位）必須完整涵蓋 6 大狀態：`Default`、`Hover`、`Active`、`Focus-Visible`、`Disabled` 與非同步 `Loading`。
4. **包容性與無障礙 (Accessibility - WCAG AA)**：
   - 一般文字對比度不得低於 `4.5:1`，大字級（18px+ 或 14px bold）不得低於 `3:1`。
   - 鍵盤導航必須具備清晰可見的焦點環（Focus Ring），不破壞使用者的 Tab 鍵巡覽體驗。

---

## 2. 標準 Design Tokens 規格 (`index.css`)

```css
:root {
  /* 品牌色彩體系 */
  --primary: #4F46E5;
  --primary-hover: #4338CA;
  --primary-subtle: #EEF2FF;
  --primary-text: #3730A3;

  /* 語意狀態色 */
  --success: #10B981;
  --success-subtle: #ECFDF5;
  --warning: #F59E0B;
  --warning-subtle: #FFFBEB;
  --danger: #EF4444;
  --danger-subtle: #FEF2F2;

  /* 淺色模式背景與文字 */
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --bg-subtle: #F1F5F9;
  --bg-hover: #E2E8F0;
  
  --text-main: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
  
  --border-color: #E2E8F0;
  --border-focus: #4F46E5;

  /* 圓角尺度 */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* 深度陰影 (Elevation) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

  /* 動效過渡 (Transition) */
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 深色模式覆寫 (Dark Theme) */
[data-theme='dark'] {
  --bg-page: #0B0F19;
  --bg-card: #131B2E;
  --bg-subtle: #1E293B;
  --bg-hover: #334155;

  --text-main: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #64748B;

  --border-color: #27354F;
  --border-focus: #818CF8;

  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 10px 0 rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 24px -4px rgba(0, 0, 0, 0.5);
}
```

---

## 3. 響應式佈局與斷點準則 (Responsive Breakpoints)

### 3.1 斷點規範
- **Mobile (`< 640px`)**：單欄流動佈局、底部導航或抽屜漢堡選單、觸控目標最小 `44x44px`。
- **Tablet (`640px ~ 1024px`)**：雙欄網格或側邊收合導航、自適應卡片流。
- **Desktop (`> 1024px`)**：經典三欄或固定寬度管理版面（主側導航 + 內容區塊 + 輔助檢視區）。

### 3.2 彈性排版樣式範本

```css
/* 自適應卡片網格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

/* 內容安全防護 (防文字撐裂與溢出) */
.text-truncate-safe {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-break-safe {
  word-break: break-word;
  overflow-wrap: break-word;
}
```

---

## 4. 關鍵互動元件規範 (Key Component Patterns)

### 4.1 按鈕（Buttons）標準狀態矩陣

```css
.btn-primary {
  background-color: var(--primary);
  color: #FFFFFF;
  border: 1px solid transparent;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
  box-shadow: var(--shadow-sm);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(40%);
}
```

### 4.2 空狀態與骨架屏 (Empty States & Skeletons)
- **空狀態設計**：當清單無資料時，不可留下一片空白，必須包含：
  1. 友善插圖或 Icon。
  2. 明確說明文字（例如：「尚無任何文章草稿」）。
  3. 引導性操作按鈕（例如：「立即建立第一篇草稿」）。
- **載入骨架屏 (Skeleton)**：在非同步請求等待時，使用微動畫閃爍脈衝（Pulse Animation）替代粗暴的旋轉 Spinner，減少使用者等待焦慮。

---

## 5. 無障礙與 UX 防呆檢核清單 (a11y Checklist)

- [ ] **色彩對比度**：文字與背景對比度在 Light/Dark 模式皆達到 WCAG AA (≥ 4.5:1)。
- [ ] **鍵盤無障礙**：所有表單欄位、彈出視窗與互動卡片可透過 `Tab` 導航，並有清晰的 `:focus-visible` 焦點外框。
- [ ] **螢幕報讀機相容**：純圖示按鈕均補齊 `aria-label`（如 `<button aria-label="關閉彈出視窗">`）。
- [ ] **長字元防爆**：長標題或無間距字串（如 URL、連續英文）具備 `overflow-wrap: break-word`，不撐破容器寬度。
- [ ] **觸控安全尺寸**：行動裝置上所有可點擊項目的有效點擊區域至少達到 `44px × 44px`。
