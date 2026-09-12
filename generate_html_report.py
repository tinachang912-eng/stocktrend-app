import sqlite3
import os
import sys

# 避免 Windows 命令列編碼問題
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')
OUTPUT_HTML_PATH = os.path.join(os.path.dirname(__file__), 'database_report.html')

def fetch_table_data(cursor, table_name):
    cursor.execute(f"SELECT * FROM {table_name};")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    return columns, rows

def generate_html_report():
    if not os.path.exists(DB_PATH):
        print(f"[x] 找不到資料庫檔案: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. 讀取三張表資料
    users_cols, users_rows = fetch_table_data(cursor, 'users')
    products_cols, products_rows = fetch_table_data(cursor, 'products')
    user_products_cols, user_products_rows = fetch_table_data(cursor, 'user_products')

    # 讀取具備關聯名稱的購買紀錄 (JOIN 檢視，更直覺易讀)
    cursor.execute("""
        SELECT 
            up.id,
            u.name AS user_name,
            u.email AS user_email,
            p.product_name,
            up.quantity,
            up.purchase_price,
            (up.quantity * up.purchase_price) AS subtotal,
            up.status,
            up.purchased_at
        FROM user_products up
        JOIN users u ON up.user_id = u.id
        JOIN products p ON up.product_id = p.id
        ORDER BY up.id ASC;
    """)
    enriched_rows = cursor.fetchall()

    # 統計指標
    total_users = len(users_rows)
    total_products = len(products_rows)
    total_orders = len(user_products_rows)
    cursor.execute("SELECT SUM(quantity * purchase_price) FROM user_products WHERE status = 'completed';")
    total_revenue = cursor.fetchone()[0] or 0.0

    conn.close()

    # 2. 構建 HTML 表格渲染輔助函數
    def render_table(columns, rows, table_id=""):
        headers_html = "".join([f"<th>{col}</th>" for col in columns])
        rows_html = []
        for row in rows:
            tds = []
            for i, val in enumerate(row):
                col_name = columns[i]
                val_str = str(val) if val is not None else '<span class="null-val">NULL</span>'
                
                # 特殊徽章樣式渲染
                if col_name == 'status':
                    badge_class = f"badge badge-{val}"
                    tds.append(f'<td><span class="{badge_class}">{val}</span></td>')
                elif col_name in ('price', 'purchase_price', 'subtotal'):
                    tds.append(f'<td class="text-right font-mono">NT$ {float(val):,.2f}</td>')
                elif col_name in ('id', 'user_id', 'product_id', 'quantity', 'stock'):
                    tds.append(f'<td class="text-center font-mono">{val}</td>')
                elif col_name == 'is_active':
                    tds.append(f'<td class="text-center">{"<span class=\'badge badge-active\'>上架中</span>" if val == 1 else "<span class=\'badge badge-inactive\'>已下架</span>"}</td>')
                else:
                    tds.append(f'<td>{val_str}</td>')
            rows_html.append(f"<tr>{''.join(tds)}</tr>")

        return f"""
        <div class="table-responsive">
            <table class="data-table" id="{table_id}">
                <thead><tr>{headers_html}</tr></thead>
                <tbody>{''.join(rows_html)}</tbody>
            </table>
        </div>
        """

    # 3. 組裝完整 HTML 頁面
    html_content = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQLite 資料庫資料檢視報告 | app.db</title>
    <style>
        :root {{
            --bg-body: #faf6f0;
            --bg-card: #ffffff;
            --bg-header: #f7f2ea;
            --primary: #e05638;
            --primary-gradient: linear-gradient(135deg, #e05638 0%, #ea580c 50%, #d97706 100%);
            --text-main: #2c2523;
            --text-muted: #796f6a;
            --border: #ede4d8;
            --border-highlight: rgba(224, 86, 56, 0.35);
            --shadow-sm: 0 2px 8px rgba(138, 80, 40, 0.06);
            --shadow-md: 0 8px 20px rgba(138, 80, 40, 0.08);
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans TC", sans-serif;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: var(--font-family);
            background-color: var(--bg-body);
            color: var(--text-main);
            padding: 2.5rem 1.5rem;
            line-height: 1.6;
        }}

        .container {{
            max-width: 1280px;
            margin: 0 auto;
        }}

        /* 標題區 */
        .page-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 1rem;
        }}

        .page-title h1 {{
            font-size: 2rem;
            font-weight: 850;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }}

        .page-title p {{
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-top: 0.3rem;
        }}

        .file-badge {{
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #c2410c;
            padding: 0.35rem 0.9rem;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 700;
        }}

        /* KPI 指標卡 */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }}

        .kpi-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1.5rem 1.8rem;
            box-shadow: var(--shadow-sm);
            display: flex;
            align-items: center;
            gap: 1.2rem;
        }}

        .kpi-icon {{
            width: 52px;
            height: 52px;
            border-radius: 14px;
            background: #ffedd5;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
        }}

        .kpi-info .val {{
            font-size: 1.75rem;
            font-weight: 850;
            color: var(--text-main);
            line-height: 1.2;
        }}

        .kpi-info .lbl {{
            font-size: 0.85rem;
            color: var(--text-muted);
            font-weight: 500;
        }}

        /* 區塊卡片 */
        .section-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2.8rem;
            box-shadow: var(--shadow-sm);
        }}

        .section-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.4rem;
            border-bottom: 2px solid #fed7aa;
            padding-bottom: 0.8rem;
            flex-wrap: wrap;
            gap: 0.8rem;
        }}

        .section-header h2 {{
            font-size: 1.35rem;
            font-weight: 800;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .table-badge {{
            background: #f5efe6;
            color: #796f6a;
            border: 1px solid var(--border);
            padding: 0.25rem 0.65rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }}

        /* 表格樣式 */
        .table-responsive {{
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid var(--border);
        }}

        .data-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.92rem;
            text-align: left;
        }}

        .data-table th {{
            background-color: var(--bg-header);
            color: var(--text-main);
            font-weight: 700;
            padding: 0.9rem 1rem;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
        }}

        .data-table td {{
            padding: 0.85rem 1rem;
            border-bottom: 1px solid #f0e9df;
            color: var(--text-main);
        }}

        .data-table tbody tr:hover {{
            background-color: #fdfaf6;
        }}

        .data-table tbody tr:last-child td {{
            border-bottom: none;
        }}

        .font-mono {{
            font-family: Consolas, Monaco, "Courier New", monospace;
        }}

        .text-center {{ text-align: center; }}
        .text-right {{ text-align: right; }}

        /* 徽章 Badge */
        .badge {{
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.78rem;
            font-weight: 700;
        }}

        .badge-active, .badge-completed {{
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }}

        .badge-pending {{
            background-color: #fffbeb;
            color: #b45309;
            border: 1px solid #fde68a;
        }}

        .badge-refunded, .badge-suspended, .badge-inactive {{
            background-color: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }}

        .null-val {{
            color: #c4b5a5;
            font-style: italic;
        }}

        /* 頁尾 */
        footer {{
            text-align: center;
            color: var(--text-muted);
            font-size: 0.85rem;
            margin-top: 3rem;
            padding-top: 1.5rem;
            border-top: 1px solid var(--border);
        }}
    </style>
</head>
<body>

<div class="container">
    <!-- 頂部資訊條 -->
    <header class="page-header">
        <div class="page-title">
            <h1>📊 SQLite 資料庫內容檢視報告</h1>
            <p>透過 Python 自 <code>app.db</code> 即時提取並結構化輸出之三張核心資料表全覽</p>
        </div>
        <div class="file-badge">
            📁 資料庫來源：app.db
        </div>
    </header>

    <!-- KPI 數據卡片 -->
    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-icon">👥</div>
            <div class="kpi-info">
                <div class="val">{total_users}</div>
                <div class="lbl">註冊會員總數 (users)</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon">🛍️</div>
            <div class="kpi-info">
                <div class="val">{total_products}</div>
                <div class="lbl">上架商品品項 (products)</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon">📦</div>
            <div class="kpi-info">
                <div class="val">{total_orders}</div>
                <div class="lbl">累積購買紀錄 (user_products)</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-info">
                <div class="val">NT$ {total_revenue:,.0f}</div>
                <div class="lbl">已完成總成交額 (Completed)</div>
            </div>
        </div>
    </div>

    <!-- 表 1：會員資料表 (users) -->
    <section class="section-card">
        <div class="section-header">
            <h2>👤 1. 會員資料表 <code>users</code></h2>
            <span class="table-badge">共 {len(users_rows)} 筆資料</span>
        </div>
        {render_table(users_cols, users_rows, "table-users")}
    </section>

    <!-- 表 2：商品資料表 (products) -->
    <section class="section-card">
        <div class="section-header">
            <h2>🏷️ 2. 商品資料表 <code>products</code></h2>
            <span class="table-badge">共 {len(products_rows)} 筆資料</span>
        </div>
        {render_table(products_cols, products_rows, "table-products")}
    </section>

    <!-- 表 3：會員購買關聯表 (user_products 原始資料) -->
    <section class="section-card">
        <div class="section-header">
            <h2>🛒 3. 會員購買關聯表 <code>user_products</code> (原始外鍵關聯)</h2>
            <span class="table-badge">共 {len(user_products_rows)} 筆記錄</span>
        </div>
        {render_table(user_products_cols, user_products_rows, "table-user-products")}
    </section>

    <!-- 額外加值檢視：JOIN 完整明細表 (具備會員姓名與商品名稱) -->
    <section class="section-card">
        <div class="section-header">
            <h2>✨ 購買明細 JOIN 視覺化整合檢視 (Enriched View)</h2>
            <span class="table-badge">包含會員姓名、商品名稱與小計金額</span>
        </div>
        {render_table(
            ['流水號', '買家會員', '會員信箱', '購買商品', '數量', '成交單價', '小計金額', '狀態', '下單時間'], 
            enriched_rows, 
            "table-enriched-orders"
        )}
    </section>

    <footer>
        資料庫檢視報告由 Python 自動產生 • 來源資料庫：app.db • 生成時間：2026-09-05
    </footer>
</div>

</body>
</html>
"""

    with open(OUTPUT_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"[✔] 成功讀取 app.db 並生成 HTML 報告檔案: {OUTPUT_HTML_PATH}")
    print(f"    - users 表: {len(users_rows)} 筆")
    print(f"    - products 表: {len(products_rows)} 筆")
    print(f"    - user_products 表: {len(user_products_rows)} 筆")

if __name__ == '__main__':
    generate_html_report()
