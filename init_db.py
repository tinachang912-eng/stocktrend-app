import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def init_database():
    print(f"正在初始化資料庫: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 讀取並執行 schema.sql
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)

    # 檢查是否已有測試資料
    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] == 0:
        print("正在寫入初始範例資料...")
        
        # 1. 新增會員範例
        users_data = [
            ('alice@example.com', '王小美', '0912-345-678', 'active'),
            ('bob@example.com', '陳大明', '0922-888-999', 'active'),
            ('charlie@example.com', '林志強', '0933-111-222', 'active')
        ]
        cursor.executemany(
            "INSERT INTO users (email, name, phone, status) VALUES (?, ?, ?, ?)",
            users_data
        )

        # 2. 新增商品範例
        products_data = [
            ('AI 智慧降噪耳機', 3800.00, '搭載最新主動降噪技術與 40 小時續航', 50, '3C 數位'),
            ('人體工學機械鍵盤', 2600.00, '熱插拔軸體，支援藍牙與 Type-C 雙模', 30, '電腦周邊'),
            ('超輕量戶外露營帳篷', 4500.00, '高防水係數、雙人快開式登山帳', 15, '戶外生活'),
            ('精品單品手沖咖啡豆 250g', 480.00, '耶加雪菲淺焙，花果香氣濃郁', 100, '生活飲食')
        ]
        cursor.executemany(
            "INSERT INTO products (product_name, price, description, stock, category) VALUES (?, ?, ?, ?, ?)",
            products_data
        )

        # 3. 新增購買紀錄 (user_products)
        # user 1 (王小美) 買了 耳機(1) 和 咖啡豆(4)
        # user 2 (陳大明) 買了 鍵盤(2)
        # user 3 (林志強) 買了 帳篷(3)
        purchases_data = [
            (1, 1, 1, 3800.00, 'completed'),
            (1, 4, 2, 480.00, 'completed'),
            (2, 2, 1, 2600.00, 'completed'),
            (3, 3, 1, 4500.00, 'completed')
        ]
        cursor.executemany(
            "INSERT INTO user_products (user_id, product_id, quantity, purchase_price, status) VALUES (?, ?, ?, ?, ?)",
            purchases_data
        )

        conn.commit()
        print("初始測試資料寫入成功！")

    # 執行關聯查詢測試
    print("\n=== 會員購買明細 (JOIN 驗證查詢) ===")
    query = """
    SELECT 
        u.id AS user_id,
        u.name AS user_name,
        u.email,
        p.product_name,
        up.quantity,
        up.purchase_price,
        (up.quantity * up.purchase_price) AS total_amount,
        up.purchased_at
    FROM user_products up
    JOIN users u ON up.user_id = u.id
    JOIN products p ON up.product_id = p.id
    ORDER BY up.id ASC;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    for row in rows:
        print(f"會員: {row[1]} ({row[2]}) | 商品: {row[3]} | 數量: {row[4]} | 單價: NT${row[5]} | 小計: NT${row[6]}")

    conn.close()
    print("\n資料庫 app.db 建立完成且驗證無誤。")

if __name__ == '__main__':
    init_database()
