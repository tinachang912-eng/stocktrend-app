---
name: coding-standards
description: 當編寫、格式化或規範專案中的 Python、JavaScript/React、SQL、CSS 程式碼時使用此 Skill。規範命名慣例、模組拆分、無死角防禦性編程、註解與盤古之白、Git 提交規範與代碼整潔原則（Clean Code）。
---

# 程式碼編寫與品質規範 (Coding Standards & Clean Code)

> **定位**：為全端專案提供跨語言、高一致性、可讀性強且防禦嚴密的編程規範，降低維護成本與團隊認知負擔。  
> **適用技術棧**：Python 3.10+、JavaScript (ES6+) / React 18、SQLite / SQL、CSS3。  
> **關聯規範**：[`dev-guidelines.md`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/rules/dev-guidelines.md) | [`docs-writing.md`](file:///c:/Users/TINA/Documents/antigravity/practice/.agents/rules/docs-writing.md)

---

## 1. 核心開發心法 (Core Coding Philosophies)

1. **可讀性優先於簡寫炫技 (Readability over Cleverness)**：
   - 程式碼是寫給人看的，只是順便能被電腦執行。避免使用過度晦澀的單行運算子或深層巢狀三元表達式。
2. **提早返回原則 (Early Return Pattern)**：
   - 優先處理邊界條件、參數無效或錯誤狀況並立即返回（Guard Clause），減少 `if...else` 縮排層級。
3. **無死角防禦性編程 (Defensive Programming)**：
   - 永遠假設外部輸入、非同步回傳值可能為 `null`、`undefined` 或型別不符，善用安全鏈接（Optional Chaining `?.`）與空值合併（Nullish Coalescing `??`）。
4. **單一職責與簡潔函式 (Single Responsibility Principle)**：
   - 單一函式建議不超過 40 行，若超過應評估是否有職責未拆分。

---

## 2. Python (FastAPI & 後端) 編程標準

### 2.1 命名與格式規範
- **變數與函式**：採用 `snake_case`（例如：`get_user_by_id`、`media_pipeline`）。
- **類別與模型**：採用 `PascalCase`（例如：`ArticleCreateRequest`、`MediaProcessor`）。
- **常數**：採用全大寫底線 `UPPER_SNAKE_CASE`（例如：`MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024`）。

### 2.2 型別標註 (Type Hints) 與防禦性
所有函式參數與回傳值必須明確宣告型別：

```python
from typing import Optional, List, Dict, Any

def calculate_reading_time(content: str, words_per_minute: int = 300) -> int:
    """計算文章預估閱讀時間（分鐘）。
    
    若內文字數少於單分鐘閥值，預設回傳 1 分鐘。
    """
    if not content or not content.strip():
        return 0
        
    char_count = len(content.strip())
    estimated = char_count // words_per_minute
    return max(1, estimated)
```

### 2.3 資源管理 (Context Managers)
- 資料庫連線、檔案讀寫必須使用 `with` 陳述式，確保連線與檔案控制代碼（File Handle）在例外發生時亦能安全關閉：
  ```python
  # 良好實踐
  with get_db_connection() as conn:
      cursor = conn.cursor()
      cursor.execute("SELECT id, username FROM users WHERE id = ?;", (user_id,))
      user = cursor.fetchone()
  ```

---

## 3. JavaScript / React 前端編程標準

### 3.1 元件與 Hooks 規範
1. **全面 Functional Components**：禁止撰寫 React Class 元件。
2. **Props 解構與預設值**：在函式簽名處直接解構，並賦予明確預設值：
   ```jsx
   export function StatusBadge({ status = 'draft', count = 0, onClick }) {
     const statusConfig = {
       draft: { label: '草稿', className: 'badge-muted' },
       published: { label: '已發佈', className: 'badge-success' },
     };

     const current = statusConfig[status] || statusConfig.draft;

     return (
       <span className={`status-badge ${current.className}`} onClick={onClick}>
         {current.label} ({count})
       </span>
     );
   }
   ```
3. **不可變資料更新 (Immutability Pattern)**：
   ```javascript
   // 正確：產生新物件
   setUser(prev => ({ ...prev, avatarUrl: newUrl }));
   
   // 正確：產生新陣列
   setTags(prev => [...prev, newTag]);
   
   // 嚴格禁止直接修改狀態
   // user.avatarUrl = newUrl;
   // tags.push(newTag);
   ```

---

## 4. 註解、文件與排版語言規範

1. **中英文盤古之白 (Spacing Convention)**：
   - 程式碼註解、說明文字中，中文字與英文字母/數字之間必須保留半形空格。
   - 正確：`// 透過 JWT Token 進行使用者身份鑑權`
   - 錯誤：`//透過JWT Token進行使用者身份鑑權`
2. **語意化註解 (Self-Documenting Code)**：
   - 註解應解釋「為什麼這樣做 (Why)」，而非重述程式碼正在做什麼 (What)。
   - 避免冗餘註解（例如：`i = i + 1 // 將 i 加 1`）。

---

## 5. Git 提交訊息規範 (Conventional Commits)

每次 Git Commit 訊息必須遵循語意化提交規範：

| 前綴 (Type) | 適用範圍 | 範例 |
| :--- | :--- | :--- |
| `feat` | 新增功能 | `feat(auth): 支援 RBAC 四階角色權限驗證` |
| `fix` | 修復缺陷或錯誤 | `fix(media): 修正 EXIF 照片旋轉方向錯誤` |
| `refactor` | 重構程式碼（無功能異動） | `refactor(db): 抽離參數化 SQL 查詢連線工廠` |
| `style` | 調整格式、排版、變數命名 | `style(ui): 統一 Design Tokens 與按鈕陰影尺度` |
| `test` | 新增或修復單元測試 | `test(phase2): 補齊 WebP 影像管線二進制測試` |
| `docs` | 文件更新 | `docs(spec): 更新文章生命週期狀態流轉圖` |

---

## 6. 程式碼品質檢核清單 (Coding Standards Checklist)

- [ ] 是否消除了不必要的巢狀 `if...else`（使用 Early Return）？
- [ ] 變數與函式命名是否語意明確，無模糊單字母變數（除迴圈計數器 `i`、`j`）？
- [ ] Python 函式是否全面具備 Type Hints？
- [ ] React 元件是否保持純函式與不可變狀態更新？
- [ ] 註解與文字排版是否確實遵循「盤古之白」（中英數保留半形空格）？
- [ ] 提交紀錄是否符合 Conventional Commits 格式？
