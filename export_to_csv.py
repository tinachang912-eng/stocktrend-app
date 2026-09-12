import sqlite3
import csv
import os
import sys

# 避免 Windows 命令列編碼問題
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')
OUTPUT_DIR = os.path.dirname(__file__)

def export_tables_to_csv():
    if not os.path.exists(DB_PATH):
        print(f"[x] 找不到資料庫檔案: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 取得資料庫內所有使用者自定義的資料表名稱 (排除 sqlite 內部表)
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC;
    """)
    tables = [row[0] for row in cursor.fetchall()]

    print(f"[*] 找到 {len(tables)} 張資料表: {', '.join(tables)}")
    print("=" * 50)

    for table in tables:
        csv_filename = f"{table}.csv"
        csv_path = os.path.join(OUTPUT_DIR, csv_filename)

        cursor.execute(f"SELECT * FROM {table};")
        rows = cursor.fetchall()
        column_names = [description[0] for description in cursor.description]

        # 使用 utf-8-sig 編碼，確保在 Windows Excel 開啟時中文不會亂碼
        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(column_names)  # 寫入欄位表頭
            writer.writerows(rows)         # 寫入所有資料列

        print(f"[✔] 成功匯出: {csv_filename} ({len(rows)} 筆資料，欄位: {', '.join(column_names)})")

    conn.close()
    print("=" * 50)
    print("[*] 全部 CSV 檔案匯出完成！")

if __name__ == '__main__':
    export_tables_to_csv()
