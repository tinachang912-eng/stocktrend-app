import sqlite3
import os
import sys
import hashlib
import binascii

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cms.db')

def hash_password(password: str, salt: str = None) -> str:
    """使用 PBKDF2-HMAC-SHA256 生成安全密碼雜湊"""
    if salt is None:
        salt = binascii.hexlify(os.urandom(16)).decode()
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    hash_hex = binascii.hexlify(dk).decode()
    return f"{salt}${hash_hex}"

def verify_password(password: str, password_hash: str) -> bool:
    """驗證密碼是否正確"""
    try:
        salt, expected_hash = password_hash.split('$')
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        actual_hash = binascii.hexlify(dk).decode()
        return actual_hash == expected_hash
    except Exception:
        return False

def get_db():
    """取得資料庫連線並啟用外鍵與字典回傳"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_cms_database():
    """初始化 CMS 資料庫與種子資料"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    # 1. 使用者表 (users)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'editor', 'author', 'proofreader')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. 兩層級分類表 (categories)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id INTEGER NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    """)

    # 3. 標籤表 (tags)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. 文章主表 (articles)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        content_json TEXT DEFAULT '{}',
        content_html TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'published', 'scheduled', 'trash')),
        author_id INTEGER NOT NULL,
        scheduled_at DATETIME,
        published_at DATETIME,
        meta_title TEXT,
        meta_desc TEXT,
        seo_score INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 5. 文章分類多對多關聯表 (article_categories)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS article_categories (
        article_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (article_id, category_id),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
    """)

    # 6. 文章標籤多對多關聯表 (article_tags)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS article_tags (
        article_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (article_id, tag_id),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    """)

    # 7. 文章版本歷史表 (article_revisions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS article_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        editor_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content_json TEXT NOT NULL,
        revision_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 8. 虛擬資料夾表 (media_folders)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS media_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE CASCADE
    );
    """)

    # 9. 媒體資產表 (media_assets)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        webp_url TEXT NOT NULL,
        thumb_url TEXT,
        medium_url TEXT,
        mime_type TEXT NOT NULL DEFAULT 'image/webp',
        file_size INTEGER NOT NULL,
        original_size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        alt_text TEXT,
        folder_id INTEGER NULL,
        uploader_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
        FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 檢查並自動遷移 media_assets 欄位 (Phase 2 升級相容)
    cursor.execute("PRAGMA table_info(media_assets);")
    existing_cols = {row[1] for row in cursor.fetchall()}
    columns_to_add = [
        ("original_filename", "TEXT NOT NULL DEFAULT ''"),
        ("medium_url", "TEXT"),
        ("original_size", "INTEGER NOT NULL DEFAULT 0"),
        ("width", "INTEGER"),
        ("height", "INTEGER"),
        ("folder_id", "INTEGER NULL"),
    ]
    for col_name, col_def in columns_to_add:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE media_assets ADD COLUMN {col_name} {col_def};")

    # 索引優化
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);")

    # 檢查並注入種子資料
    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] == 0:
        print("[*] 正在注入 Phase 1 種子資料...")
        default_pw = hash_password("password123")

        # 4 種角色測試帳號
        users = [
            ('admin@cms.example.com', '系統管理員 (Super Admin)', default_pw, 'super_admin', 'active'),
            ('editor@cms.example.com', '陳主編 (Chief Editor)', default_pw, 'editor', 'active'),
            ('author@cms.example.com', '林專欄 (Author Lin)', default_pw, 'author', 'active'),
            ('proofreader@cms.example.com', '王校對 (Proofreader Wang)', default_pw, 'proofreader', 'active')
        ]
        cursor.executemany("""
        INSERT INTO users (email, name, password_hash, role, status)
        VALUES (?, ?, ?, ?, ?);
        """, users)

        # 兩層級分類
        # 1. 人工智慧 (主分類)
        cursor.execute("INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('人工智慧', 'artificial-intelligence', NULL, 1);")
        ai_id = cursor.lastrowid
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('大語言模型', 'llm', {ai_id}, 1);")
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('提示詞工程', 'prompt-engineering', {ai_id}, 2);")
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('智能代理 Swarm', 'ai-agents', {ai_id}, 3);")

        # 2. 前端開發 (主分類)
        cursor.execute("INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('前端開發', 'frontend-dev', NULL, 2);")
        fe_id = cursor.lastrowid
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('React 生態系', 'react-ecosystem', {fe_id}, 1);")
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('效能最佳化', 'performance', {fe_id}, 2);")

        # 3. 系統架構 (主分類)
        cursor.execute("INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('系統架構', 'system-architecture', NULL, 3);")
        arch_id = cursor.lastrowid
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('微服務與 API', 'microservices', {arch_id}, 1);")
        cursor.execute(f"INSERT INTO categories (name, slug, parent_id, sort_order) VALUES ('資料庫設計', 'database-design', {arch_id}, 2);")

        # 常用標籤
        tags = [
            ('RAG 檢索', 'rag'),
            ('LangChain', 'langchain'),
            ('Vibe Coding', 'vibe-coding'),
            ('RPA 自動化', 'rpa'),
            ('WebP 轉碼', 'webp'),
            ('FastAPI', 'fastapi'),
            ('TailwindCSS', 'tailwindcss'),
            ('Next.js', 'nextjs')
        ]
        cursor.executemany("INSERT INTO tags (name, slug) VALUES (?, ?);", tags)

        # 建立幾篇初始文章以供測試分類關聯
        cursor.execute("""
        INSERT INTO articles (title, slug, excerpt, content_json, content_html, status, author_id, seo_score, view_count, published_at)
        VALUES 
        ('2026 生成式 AI 與 RAG 企業落地全指南', 'generative-ai-rag-guide-2026', '詳解知識圖譜與向量資料庫在企業內部的最佳實踐。', '{}', '<p>正文內容...</p>', 'published', 1, 92, 1280, CURRENT_TIMESTAMP),
        ('Vibe Coding 開發新哲學：從逐行打字到意圖編排', 'vibe-coding-philosophy-2026', '探討工程師如何與 AI 實現心流共振。', '{}', '<p>正文內容...</p>', 'published', 2, 88, 950, CURRENT_TIMESTAMP),
        ('多智能體 (Multi-Agent) 協同架構解析', 'multi-agent-orchestration', '三位一體的自主決策系統設計指南。', '{}', '<p>正文內容...</p>', 'pending', 3, 76, 0, NULL);
        """)

        # 綁定文章分類
        cursor.execute("INSERT INTO article_categories (article_id, category_id) VALUES (1, 2), (2, 4), (3, 4);")
        # 綁定文章標籤
        cursor.execute("INSERT INTO article_tags (article_id, tag_id) VALUES (1, 1), (1, 2), (2, 3), (3, 1);")

    # 檢查並注入初始媒體資料夾 (Phase 2)
    cursor.execute("SELECT COUNT(*) FROM media_folders;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO media_folders (name) VALUES ('專題報導'), ('產品圖庫'), ('活動花絮');")
        print("[+] Phase 2 初始媒體資料夾建立完成！")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_cms_database()
    print("[✔] cms.db 初始化完成。")
