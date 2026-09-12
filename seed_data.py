import sqlite3
import os
import sys

# 避免 Windows PowerShell cp950 編碼問題
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')

def seed_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 啟用外鍵支援
    cursor.execute("PRAGMA foreign_keys = ON;")

    print(f"[*] 連接至資料庫: {DB_PATH}")

    # 清空現有資料表（依外鍵相依性順序）
    cursor.execute("DELETE FROM user_products;")
    cursor.execute("DELETE FROM products;")
    cursor.execute("DELETE FROM users;")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('users', 'products', 'user_products');")

    print("[*] 已重置既有資料表流水號")

    # 1. 插入 10 位多樣化會員資料
    users_data = [
        ('alice.wang@example.com', '王小美', '0912-345-678', 'active', '2025-11-10 09:30:00'),
        ('bob.chen@example.com', '陳大明', '0922-888-999', 'active', '2025-11-15 14:20:00'),
        ('charlie.lin@example.com', '林志強', '0933-111-222', 'active', '2025-12-01 11:15:00'),
        ('diana.chang@example.com', '張淑芬', '0955-666-777', 'active', '2025-12-18 16:45:00'),
        ('eric.huang@example.com', '黃建榮', '0966-333-444', 'active', '2026-01-05 10:00:00'),
        ('fiona.wu@example.com', '吳品妤', '0977-222-111', 'active', '2026-01-14 13:50:00'),
        ('george.hsu@example.com', '許家豪', '0988-999-000', 'active', '2026-01-22 17:30:00'),
        ('hannah.cheng@example.com', '鄭雅婷', '0910-555-888', 'active', '2026-02-03 08:20:00'),
        ('ian.tsai@example.com', '蔡文彬', '0920-444-333', 'inactive', '2026-02-12 15:10:00'),
        ('julia.chao@example.com', '趙心語', '0930-777-666', 'active', '2026-02-25 19:40:00')
    ]

    cursor.executemany("""
        INSERT INTO users (email, name, phone, status, created_at)
        VALUES (?, ?, ?, ?, ?);
    """, users_data)
    print(f"[+] 成功塞入 {len(users_data)} 筆會員資料 (users)")

    # 2. 插入 10 樣涵蓋不同品類的商品
    products_data = [
        (1, 'AI 智慧主動降噪耳機 Pro', 3800.00, '支援 45dB 深度降噪與高解析音質無線傳輸', 45, '3C 數位', 1),
        (2, '客製化熱插拔三模機械鍵盤', 2600.00, 'PBT 鍵帽，支援藍牙 5.3、2.4G 與 Type-C 連接', 28, '電腦周邊', 1),
        (3, '4K 27 吋 Type-C 廣色域護眼螢幕', 8990.00, 'IPS 面板，具備 90W 反向供電與抗藍光技術', 15, '3C 數位', 1),
        (4, '超輕量抗撕裂雙人鋁合金登山帳', 4500.00, '重量僅 1.6kg，防暴雨級外帳材質', 12, '戶外休閒', 1),
        (5, '耶加雪菲產區精品手沖咖啡豆 250g', 480.00, '淺中烘焙，帶有迷人茉莉花香與柑橘果酸', 85, '美食飲品', 1),
        (6, '雙層真空 316 不鏽鋼保溫隨行杯 550ml', 750.00, '長效保溫保冷 12 小時，防漏矽膠密封圈', 60, '生活日用', 1),
        (7, '現代全端架構與大模型實戰應用 (精裝書)', 680.00, '深入講解 React、FastAPI 與企業級 RAG 落地', 40, '專業書籍', 1),
        (8, 'SynapseAI 專業開發者 API 月費訂閱', 1200.00, '提供每月 500 萬 Tokens 推理額度與技術支援', 999, '軟體服務', 1),
        (9, '多功能 10 合 1 鋁合金 USB-C 擴充塢', 1450.00, '支援 4K 60Hz 輸出、PD 100W 快充與千兆網孔', 35, '電腦周邊', 1),
        (10, '高透氣人體工學工藝辦公椅', 6200.00, '全網透氣材質，具備多向腰靠調節與 3D 扶手', 8, '辦公家具', 1)
    ]

    cursor.executemany("""
        INSERT INTO products (id, product_name, price, description, stock, category, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, products_data)
    print(f"[+] 成功塞入 {len(products_data)} 筆商品資料 (products)")

    # 3. 插入 22 筆真實多樣的購買紀錄 (user_products)
    # (user_id, product_id, quantity, purchase_price, status, purchased_at)
    purchases_data = [
        # 王小美 (id=1): 買了耳機、咖啡豆、精裝書
        (1, 1, 1, 3800.00, 'completed', '2025-12-05 14:12:00'),
        (1, 5, 2, 480.00, 'completed', '2025-12-24 10:30:00'),
        (1, 7, 1, 680.00, 'completed', '2026-01-15 09:20:00'),

        # 陳大明 (id=2): 買了鍵盤、擴充塢
        (2, 2, 1, 2600.00, 'completed', '2025-12-10 11:45:00'),
        (2, 9, 1, 1450.00, 'completed', '2026-01-08 16:10:00'),

        # 林志強 (id=3): 買了帳篷、保溫杯
        (3, 4, 1, 4500.00, 'completed', '2026-01-02 20:15:00'),
        (3, 6, 2, 750.00, 'completed', '2026-01-20 18:00:00'),

        # 張淑芬 (id=4): 買了螢幕、人體工學椅 (高額大戶)
        (4, 3, 1, 8990.00, 'completed', '2026-01-12 15:30:00'),
        (4, 10, 1, 6200.00, 'completed', '2026-02-01 11:20:00'),
        (4, 5, 1, 480.00, 'completed', '2026-02-14 14:40:00'),

        # 黃建榮 (id=5): 訂閱了 API、買了機械鍵盤
        (5, 8, 1, 1200.00, 'completed', '2026-01-18 10:05:00'),
        (5, 2, 1, 2600.00, 'completed', '2026-01-25 17:50:00'),

        # 吳品妤 (id=6): 買了耳機、咖啡豆、精裝書
        (6, 1, 1, 3800.00, 'completed', '2026-01-28 12:15:00'),
        (6, 5, 3, 480.00, 'completed', '2026-02-10 16:30:00'),
        (6, 7, 1, 680.00, 'completed', '2026-02-18 09:10:00'),

        # 許家豪 (id=7): 買了擴充塢、保溫杯 (其中保溫杯退款)
        (7, 9, 1, 1450.00, 'completed', '2026-02-05 13:25:00'),
        (7, 6, 1, 750.00, 'refunded', '2026-02-08 19:10:00'),

        # 鄭雅婷 (id=8): 買了螢幕、API 訂閱 (一筆待處理)
        (8, 3, 1, 8990.00, 'completed', '2026-02-15 14:00:00'),
        (8, 8, 1, 1200.00, 'pending', '2026-03-01 10:20:00'),

        # 趙心語 (id=10): 買了耳機、咖啡豆、保溫杯
        (10, 1, 1, 3800.00, 'completed', '2026-02-28 15:45:00'),
        (10, 5, 1, 480.00, 'completed', '2026-03-02 11:30:00'),
        (10, 6, 1, 750.00, 'completed', '2026-03-04 18:20:00')
    ]

    cursor.executemany("""
        INSERT INTO user_products (user_id, product_id, quantity, purchase_price, status, purchased_at)
        VALUES (?, ?, ?, ?, ?, ?);
    """, purchases_data)
    print(f"[+] 成功塞入 {len(purchases_data)} 筆會員購買紀錄 (user_products)")

    conn.commit()

    # 執行統計摘要
    print("\n" + "="*50)
    print("📊 資料庫測試資料概況統計")
    print("="*50)

    # 1. 會員累積消費榜 Top 3
    print("\n🏆【會員累積消費金額 Top 3】：")
    cursor.execute("""
        SELECT u.name, u.email, COUNT(up.id) AS order_count, SUM(up.quantity * up.purchase_price) AS total_spent
        FROM users u
        JOIN user_products up ON u.id = up.user_id
        WHERE up.status = 'completed'
        GROUP BY u.id
        ORDER BY total_spent DESC
        LIMIT 3;
    """)
    for rank, row in enumerate(cursor.fetchall(), 1):
        print(f"  {rank}. {row[0]} ({row[1]}) -> 訂購 {row[2]} 次，累計消費: NT$ {row[3]:,.0f}")

    # 2. 最暢銷熱門商品 Top 3
    print("\n🔥【最暢銷熱門商品 Top 3】：")
    cursor.execute("""
        SELECT p.product_name, p.category, SUM(up.quantity) AS total_qty_sold, SUM(up.quantity * up.purchase_price) AS total_revenue
        FROM products p
        JOIN user_products up ON p.id = up.product_id
        WHERE up.status = 'completed'
        GROUP BY p.id
        ORDER BY total_qty_sold DESC
        LIMIT 3;
    """)
    for rank, row in enumerate(cursor.fetchall(), 1):
        print(f"  {rank}. {row[0]} [{row[1]}] -> 銷售 {row[2]} 件，總營收: NT$ {row[3]:,.0f}")

    # 3. 訂單狀態分佈
    print("\n📦【訂單狀態分佈統計】：")
    cursor.execute("""
        SELECT status, COUNT(*) AS cnt, SUM(quantity * purchase_price) AS total_val
        FROM user_products
        GROUP BY status;
    """)
    for row in cursor.fetchall():
        print(f"  • 狀態: {row[0]:<10} -> 共 {row[1]} 筆訂單，總額: NT$ {row[2]:,.0f}")

    conn.close()
    print("\n[✔] 測試資料寫入與統計驗證全數完成！")

if __name__ == '__main__':
    seed_database()
