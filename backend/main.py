from fastapi import FastAPI, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import re
import os
import sys
import io

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from backend.db import get_db, verify_password, init_cms_database
from backend.auth import create_access_token, get_current_user, require_roles
from backend.media_pipeline import (
    process_and_save_image,
    remove_media_files,
    UPLOAD_BASE_DIR,
    MEDIA_DIR
)
from PIL import Image

# 初始化資料庫
init_cms_database()

app = FastAPI(
    title="CMS Backend API (Phase 1 & 2)",
    description="企業級內容管理系統 - Phase 1: RBAC 基礎 | Phase 2: 媒體管線與資產中心",
    version="2.0.0"
)

# 靜態資源掛載 (提供已轉碼 WebP 圖檔存取)
app.mount("/uploads", StaticFiles(directory=UPLOAD_BASE_DIR), name="uploads")

# 跨來源資源共享 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== Pydantic 資料模型 =====================

class LoginRequest(BaseModel):
    email: str
    password: str

class CategoryCreateRequest(BaseModel):
    name: str
    slug: str
    parent_id: Optional[int] = None
    sort_order: Optional[int] = 0

class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None

class TagCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None

class FolderCreateRequest(BaseModel):
    name: str
    parent_id: Optional[int] = None

class FolderUpdateRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

class MediaAssetUpdateRequest(BaseModel):
    filename: Optional[str] = None
    alt_text: Optional[str] = None
    folder_id: Optional[int] = None
    clear_folder: Optional[bool] = False

class ImageTransformRequest(BaseModel):
    rotate: Optional[int] = 0
    crop_x: Optional[int] = None
    crop_y: Optional[int] = None
    crop_width: Optional[int] = None
    crop_height: Optional[int] = None

# ===================== 身份驗證 API =====================

@app.post("/api/v1/auth/login", tags=["Auth"])
def login(payload: LoginRequest):
    """會員登入並簽發 JWT 存取權杖"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?;", (payload.email.strip(),))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "error": "INVALID_CREDENTIALS", "message": "電子信箱或密碼錯誤"}
        )

    if user["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 403, "error": "ACCOUNT_DISABLED", "message": "該帳號目前未啟用或已遭凍結"}
        )

    # 簽發 JWT (Payload 包含 sub 為字串型態與 role)
    token = create_access_token({
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    })

    return {
        "code": 200,
        "message": "登入成功",
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "status": user["status"]
            }
        }
    }

@app.get("/api/v1/auth/me", tags=["Auth"])
def get_my_profile(current_user: dict = Depends(get_current_user)):
    """取得當前登入者資訊與角色權限"""
    # 角色權限矩陣定義
    permissions = {
        "super_admin": ["manage_all", "manage_users", "manage_categories", "publish_articles", "delete_articles", "view_audit_logs"],
        "editor": ["manage_categories", "publish_articles", "edit_all_articles", "manage_media"],
        "author": ["create_articles", "edit_own_articles", "submit_for_review", "upload_media"],
        "proofreader": ["view_articles", "comment_articles", "suggest_edits"]
    }
    role = current_user.get("role")
    return {
        "code": 200,
        "data": {
            **current_user,
            "permissions": permissions.get(role, [])
        }
    }

# ===================== 分類管理 API (Categories) =====================

@app.get("/api/v1/categories", tags=["Categories"])
def get_categories():
    """取得兩層級分類樹狀清單 (包含文章計數)"""
    conn = get_db()
    cursor = conn.cursor()

    # 查詢所有分類及各自歸屬的文章數量
    query = """
    SELECT 
        c.id, c.name, c.slug, c.parent_id, c.sort_order, c.created_at,
        COUNT(ac.article_id) AS article_count
    FROM categories c
    LEFT JOIN article_categories ac ON c.id = ac.category_id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.id ASC;
    """
    cursor.execute(query)
    all_cats = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # 組裝成兩層級樹狀結構 (Parent -> Children)
    parents = [c for c in all_cats if c["parent_id"] is None]
    children_map = {}
    for c in all_cats:
        if c["parent_id"] is not None:
            children_map.setdefault(c["parent_id"], []).append(c)

    tree = []
    for p in parents:
        p["children"] = children_map.get(p["id"], [])
        tree.append(p)

    return {
        "code": 200,
        "data": tree,
        "total_categories": len(all_cats)
    }

@app.post("/api/v1/categories", status_code=status.HTTP_201_CREATED, tags=["Categories"])
def create_category(
    payload: CategoryCreateRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor"]))
):
    """建立新分類 (僅限超級管理員或總編輯)"""
    conn = get_db()
    cursor = conn.cursor()

    # 檢查 slug 是否重複
    cursor.execute("SELECT id FROM categories WHERE slug = ?;", (payload.slug,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "error": "SLUG_EXISTS", "message": f"分類代稱 [{payload.slug}] 已存在"}
        )

    # 若有指定父分類，檢查父分類是否存在且本身為頂層分類 (保證最多兩層)
    if payload.parent_id:
        cursor.execute("SELECT parent_id FROM categories WHERE id = ?;", (payload.parent_id,))
        parent = cursor.fetchone()
        if not parent:
            conn.close()
            raise HTTPException(status_code=404, detail={"code": 404, "message": "指定的父分類不存在"})
        if parent["parent_id"] is not None:
            conn.close()
            raise HTTPException(status_code=400, detail={"code": 400, "message": "不允許超過兩層級分類架構"})

    cursor.execute("""
    INSERT INTO categories (name, slug, parent_id, sort_order)
    VALUES (?, ?, ?, ?);
    """, (payload.name, payload.slug, payload.parent_id, payload.sort_order or 0))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "code": 201,
        "message": "分類建立成功",
        "data": { "id": new_id, **payload.model_dump() }
    }

@app.delete("/api/v1/categories/{category_id}", tags=["Categories"])
def delete_category(
    category_id: int,
    transfer_to_id: Optional[int] = Query(None, description="若該分類下有文章，移轉至之目標分類 ID"),
    current_user: dict = Depends(require_roles(["super_admin", "editor"]))
):
    """刪除分類 (具備文章防孤立移轉防呆機制)"""
    conn = get_db()
    cursor = conn.cursor()

    # 檢查該分類是否存在
    cursor.execute("SELECT id, name FROM categories WHERE id = ?;", (category_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該分類"})

    # 檢查是否有子分類
    cursor.execute("SELECT COUNT(*) FROM categories WHERE parent_id = ?;", (category_id,))
    child_count = cursor.fetchone()[0]

    # 檢查是否有文章關聯
    cursor.execute("SELECT COUNT(*) FROM article_categories WHERE category_id = ?;", (category_id,))
    article_count = cursor.fetchone()[0]

    if (article_count > 0 or child_count > 0) and not transfer_to_id:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail={
                "code": 400,
                "error": "CATEGORY_NOT_EMPTY",
                "message": f"分類「{target['name']}」下尚有 {article_count} 篇文章與 {child_count} 個子分類，請指定 transfer_to_id 參數進行轉移後方可刪除"
            }
        )

    # 執行轉移
    if transfer_to_id:
        if transfer_to_id == category_id:
            conn.close()
            raise HTTPException(status_code=400, detail={"code": 400, "message": "轉移目標不可為當前分類自身"})
        # 移轉子分類
        cursor.execute("UPDATE categories SET parent_id = ? WHERE parent_id = ?;", (transfer_to_id, category_id))
        # 移轉文章
        cursor.execute("UPDATE article_categories SET category_id = ? WHERE category_id = ?;", (transfer_to_id, category_id))

    # 執行刪除
    cursor.execute("DELETE FROM categories WHERE id = ?;", (category_id,))
    conn.commit()
    conn.close()

    return {
        "code": 200,
        "message": f"分類已成功刪除，相關 {article_count} 篇文章已處理",
        "data": { "deleted_id": category_id, "transfer_to_id": transfer_to_id }
    }

# ===================== 標籤管理 API (Tags) =====================

@app.get("/api/v1/tags", tags=["Tags"])
def get_tags(keyword: Optional[str] = None):
    """取得標籤雲清單與使用次數統計"""
    conn = get_db()
    cursor = conn.cursor()

    if keyword:
        cursor.execute("""
        SELECT t.id, t.name, t.slug, t.created_at, COUNT(at.article_id) AS usage_count
        FROM tags t
        LEFT JOIN article_tags at ON t.id = at.tag_id
        WHERE t.name LIKE ? OR t.slug LIKE ?
        GROUP BY t.id
        ORDER BY usage_count DESC, t.name ASC;
        """, (f"%{keyword}%", f"%{keyword}%"))
    else:
        cursor.execute("""
        SELECT t.id, t.name, t.slug, t.created_at, COUNT(at.article_id) AS usage_count
        FROM tags t
        LEFT JOIN article_tags at ON t.id = at.tag_id
        GROUP BY t.id
        ORDER BY usage_count DESC, t.name ASC;
        """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {
        "code": 200,
        "data": rows,
        "total_tags": len(rows)
    }

@app.post("/api/v1/tags", status_code=status.HTTP_201_CREATED, tags=["Tags"])
def create_tag(
    payload: TagCreateRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """建立標籤 (超級管理員、總編輯、作者均可建立)"""
    slug = payload.slug or re.sub(r'[\s_]+', '-', payload.name.strip().lower())
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM tags WHERE name = ? OR slug = ?;", (payload.name, slug))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "error": "TAG_EXISTS", "message": f"標籤「{payload.name}」已存在"}
        )

    cursor.execute("INSERT INTO tags (name, slug) VALUES (?, ?);", (payload.name, slug))
    tag_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "code": 201,
        "message": "標籤建立成功",
        "data": { "id": tag_id, "name": payload.name, "slug": slug }
    }

@app.delete("/api/v1/tags/{tag_id}", tags=["Tags"])
def delete_tag(
    tag_id: int,
    current_user: dict = Depends(require_roles(["super_admin", "editor"]))
):
    """刪除標籤 (僅限超級管理員或總編輯)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tags WHERE id = ?;", (tag_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()

    if affected == 0:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該標籤"})

    return {
        "code": 200,
        "message": "標籤已刪除",
        "data": { "deleted_tag_id": tag_id }
    }

# ===================== RBAC 權限驗證測試 API =====================

@app.get("/api/v1/admin/users", tags=["Admin (Super Admin Only)"])
def list_all_users(
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """列出全站使用者與角色 (僅限超級管理員 super_admin)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, role, status, created_at FROM users ORDER BY id ASC;")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {
        "code": 200,
        "data": users,
        "total": len(users)
    }

@app.get("/api/v1/system/summary", tags=["System"])
def get_system_summary():
    """公開系統概況與統計指標"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users;")
    user_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM categories;")
    category_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM tags;")
    tag_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM articles;")
    article_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM media_assets;")
    media_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM media_folders;")
    folder_count = cursor.fetchone()[0]
    conn.close()

    return {
        "code": 200,
        "data": {
            "status": "online",
            "phase": "Phase 1: Auth & RBAC | Phase 2: Media Pipeline & Asset Hub",
            "database": "SQLite (cms.db)",
            "users": user_count,
            "categories": category_count,
            "tags": tag_count,
            "articles": article_count,
            "media_assets": media_count,
            "media_folders": folder_count
        }
    }

# ==============================================================================
# Phase 2: 媒體管線與資產中心 API (Media Pipeline & Asset Hub)
# ==============================================================================

# ----------------- 虛擬資料夾 (Media Folders) -----------------

@app.get("/api/v1/media/folders", tags=["Media Folders"])
def list_media_folders(current_user: dict = Depends(get_current_user)):
    """取得所有虛擬資料夾列表及各資料夾下之資產數量"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            f.id, f.name, f.parent_id, f.created_at,
            COUNT(m.id) as asset_count
        FROM media_folders f
        LEFT JOIN media_assets m ON m.folder_id = f.id
        GROUP BY f.id, f.name, f.parent_id, f.created_at
        ORDER BY f.name ASC;
    """)
    folders = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"code": 200, "data": folders}

@app.post("/api/v1/media/folders", status_code=status.HTTP_201_CREATED, tags=["Media Folders"])
def create_media_folder(
    payload: FolderCreateRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """新增虛擬資料夾"""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail={"code": 400, "message": "資料夾名稱不得為空"})

    conn = get_db()
    cursor = conn.cursor()
    if payload.parent_id:
        cursor.execute("SELECT id FROM media_folders WHERE id = ?;", (payload.parent_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail={"code": 404, "message": "指定的父資料夾不存在"})

    cursor.execute("INSERT INTO media_folders (name, parent_id) VALUES (?, ?);", (name, payload.parent_id))
    folder_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "code": 201,
        "message": "資料夾建立成功",
        "data": {
            "id": folder_id,
            "name": name,
            "parent_id": payload.parent_id,
            "asset_count": 0
        }
    }

@app.patch("/api/v1/media/folders/{folder_id}", tags=["Media Folders"])
def update_media_folder(
    folder_id: int,
    payload: FolderUpdateRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """更新資料夾名稱或階層"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media_folders WHERE id = ?;", (folder_id,))
    folder = cursor.fetchone()
    if not folder:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該資料夾"})

    updates = []
    params = []

    if payload.name is not None:
        name_clean = payload.name.strip()
        if not name_clean:
            conn.close()
            raise HTTPException(status_code=400, detail={"code": 400, "message": "資料夾名稱不得為空"})
        updates.append("name = ?")
        params.append(name_clean)

    if payload.parent_id is not None:
        if payload.parent_id == folder_id:
            conn.close()
            raise HTTPException(status_code=400, detail={"code": 400, "message": "父資料夾不能設為自己"})
        target_parent = payload.parent_id if payload.parent_id > 0 else None
        updates.append("parent_id = ?")
        params.append(target_parent)

    if updates:
        params.append(folder_id)
        cursor.execute(f"UPDATE media_folders SET {', '.join(updates)} WHERE id = ?;", params)
        conn.commit()

    cursor.execute("""
        SELECT f.id, f.name, f.parent_id, f.created_at, COUNT(m.id) as asset_count
        FROM media_folders f
        LEFT JOIN media_assets m ON m.folder_id = f.id
        WHERE f.id = ?
        GROUP BY f.id, f.name, f.parent_id, f.created_at;
    """, (folder_id,))
    updated_folder = dict(cursor.fetchone())
    conn.close()

    return {
        "code": 200,
        "message": "資料夾更新成功",
        "data": updated_folder
    }

@app.delete("/api/v1/media/folders/{folder_id}", tags=["Media Folders"])
def delete_media_folder(
    folder_id: int,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """刪除資料夾（所屬子資料夾與內部圖檔將自動歸類至根目錄）"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM media_folders WHERE id = ?;", (folder_id,))
    folder = cursor.fetchone()
    if not folder:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該資料夾"})

    # 內部圖檔 folder_id 移至 NULL
    cursor.execute("UPDATE media_assets SET folder_id = NULL WHERE folder_id = ?;", (folder_id,))
    # 子資料夾 parent_id 移至 NULL
    cursor.execute("UPDATE media_folders SET parent_id = NULL WHERE parent_id = ?;", (folder_id,))
    cursor.execute("DELETE FROM media_folders WHERE id = ?;", (folder_id,))
    conn.commit()
    conn.close()

    return {
        "code": 200,
        "message": f"資料夾「{folder['name']}」已刪除，內部資產已移至根目錄",
        "data": {"deleted_folder_id": folder_id}
    }

# ----------------- 媒體資產管理 (Media Assets) -----------------

@app.post("/api/v1/media/upload", status_code=status.HTTP_201_CREATED, tags=["Media Assets"])
async def upload_media_assets(
    files: List[UploadFile] = File(...),
    folder_id: Optional[int] = Form(None),
    alt_text: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    批次或單張圖片平行上傳：
    - 強制轉碼為 WebP（品質 85%）
    - 同步產製 Medium (1200px) 與 Thumbnail (400px 正方形) 衍生圖
    - 單圖限制 <20MB 與 Magic Number 驗證
    """
    if not files:
        raise HTTPException(status_code=400, detail={"code": 400, "message": "未提供任何上傳檔案"})

    # 驗證 folder_id 有效性
    conn = get_db()
    cursor = conn.cursor()
    valid_folder_id = None
    if folder_id and folder_id > 0:
        cursor.execute("SELECT id FROM media_folders WHERE id = ?;", (folder_id,))
        if cursor.fetchone():
            valid_folder_id = folder_id

    created_assets = []
    errors = []

    for file in files:
        try:
            content = await file.read()
            if len(content) > 20 * 1024 * 1024:
                errors.append(f"{file.filename}: 檔案超過 20MB 上限")
                continue

            processed = process_and_save_image(content, file.filename or "uploaded_image.png")

            cursor.execute("""
                INSERT INTO media_assets (
                    filename, original_filename, webp_url, thumb_url, medium_url,
                    mime_type, file_size, original_size, width, height,
                    alt_text, folder_id, uploader_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                processed["filename"],
                processed["original_filename"],
                processed["webp_url"],
                processed["thumb_url"],
                processed["medium_url"],
                processed["mime_type"],
                processed["file_size"],
                processed["original_size"],
                processed["width"],
                processed["height"],
                alt_text if alt_text else processed["original_filename"],
                valid_folder_id,
                int(current_user["id"])
            ))
            asset_id = cursor.lastrowid

            cursor.execute("""
                SELECT 
                    m.id, m.filename, m.original_filename, m.webp_url, m.thumb_url, m.medium_url,
                    m.mime_type, m.file_size, m.original_size, m.width, m.height,
                    m.alt_text, m.folder_id, f.name as folder_name,
                    m.uploader_id, u.name as uploader_name, m.created_at
                FROM media_assets m
                LEFT JOIN media_folders f ON m.folder_id = f.id
                LEFT JOIN users u ON m.uploader_id = u.id
                WHERE m.id = ?;
            """, (asset_id,))
            created_assets.append(dict(cursor.fetchone()))

        except ValueError as val_err:
            errors.append(f"{file.filename}: {str(val_err)}")
        except Exception as ex:
            errors.append(f"{file.filename}: 處理發生異常 ({str(ex)})")

    conn.commit()
    conn.close()

    if not created_assets and errors:
        raise HTTPException(status_code=400, detail={"code": 400, "message": "上傳失敗", "errors": errors})

    return {
        "code": 201,
        "message": f"成功上傳並轉碼 {len(created_assets)} 張圖片" + (f"，略過 {len(errors)} 個問題檔案" if errors else ""),
        "data": created_assets,
        "errors": errors if errors else None
    }

@app.get("/api/v1/media", tags=["Media Assets"])
def list_media_assets(
    folder_id: Optional[str] = Query(None, description="資料夾 ID，'root' 表示根目錄，'all' 或省略表示全部"),
    keyword: Optional[str] = Query(None, description="檔案名稱或 Alt Text 關鍵字"),
    sort_by: str = Query("created_at", pattern="^(created_at|file_size|filename|width|height)$"),
    order: str = Query("desc", pattern="^(asc|desc|ASC|DESC)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """查詢媒體檔案列表（支援資料夾篩選、關鍵字檢索與分頁）"""
    conn = get_db()
    cursor = conn.cursor()

    conditions = []
    params = []

    if folder_id is not None and folder_id != "" and folder_id.lower() != "all":
        if folder_id.lower() in ("root", "null", "none", "0"):
            conditions.append("m.folder_id IS NULL")
        else:
            try:
                fid = int(folder_id)
                conditions.append("m.folder_id = ?")
                params.append(fid)
            except ValueError:
                pass

    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        conditions.append("(m.filename LIKE ? OR m.original_filename LIKE ? OR m.alt_text LIKE ?)")
        params.extend([kw, kw, kw])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # 計算總筆數
    cursor.execute(f"SELECT COUNT(*) FROM media_assets m {where_clause};", params)
    total_count = cursor.fetchone()[0]

    # 分頁查詢
    offset = (page - 1) * limit
    order_dir = order.upper()
    query_sql = f"""
        SELECT 
            m.id, m.filename, m.original_filename, m.webp_url, m.thumb_url, m.medium_url,
            m.mime_type, m.file_size, m.original_size, m.width, m.height,
            m.alt_text, m.folder_id, f.name as folder_name,
            m.uploader_id, u.name as uploader_name, m.created_at
        FROM media_assets m
        LEFT JOIN media_folders f ON m.folder_id = f.id
        LEFT JOIN users u ON m.uploader_id = u.id
        {where_clause}
        ORDER BY m.{sort_by} {order_dir}
        LIMIT ? OFFSET ?;
    """
    cursor.execute(query_sql, params + [limit, offset])
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # 為每筆資產計算體積壓縮百分比
    for item in items:
        orig = item["original_size"] or 1
        curr = item["file_size"] or 1
        item["compression_ratio"] = round((1 - (curr / orig)) * 100, 1)

    return {
        "code": 200,
        "data": items,
        "total": total_count,
        "page": page,
        "limit": limit
    }

@app.get("/api/v1/media/stats", tags=["Media Assets"])
def get_media_statistics(current_user: dict = Depends(get_current_user)):
    """取得媒體庫儲存容量與 WebP 轉碼壓縮效益統計"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(file_size), 0) as total_webp_bytes,
            COALESCE(SUM(original_size), 0) as total_orig_bytes
        FROM media_assets;
    """)
    row = dict(cursor.fetchone())
    orig = row["total_orig_bytes"]
    webp = row["total_webp_bytes"]
    savings_pct = round((1 - (webp / orig)) * 100, 1) if orig > 0 else 0
    row["savings_percentage"] = savings_pct
    conn.close()

    return {"code": 200, "data": row}

@app.get("/api/v1/media/{asset_id}", tags=["Media Assets"])
def get_media_asset(asset_id: int, current_user: dict = Depends(get_current_user)):
    """取得單一媒體資產詳情"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            m.id, m.filename, m.original_filename, m.webp_url, m.thumb_url, m.medium_url,
            m.mime_type, m.file_size, m.original_size, m.width, m.height,
            m.alt_text, m.folder_id, f.name as folder_name,
            m.uploader_id, u.name as uploader_name, m.created_at
        FROM media_assets m
        LEFT JOIN media_folders f ON m.folder_id = f.id
        LEFT JOIN users u ON m.uploader_id = u.id
        WHERE m.id = ?;
    """, (asset_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該媒體資產"})

    asset = dict(row)
    orig = asset["original_size"] or 1
    curr = asset["file_size"] or 1
    asset["compression_ratio"] = round((1 - (curr / orig)) * 100, 1)

    return {"code": 200, "data": asset}

@app.patch("/api/v1/media/{asset_id}", tags=["Media Assets"])
def update_media_asset(
    asset_id: int,
    payload: MediaAssetUpdateRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """更新媒體資產之 Alt Text、顯示檔名或所屬資料夾"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media_assets WHERE id = ?;", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該媒體資產"})

    updates = []
    params = []

    if payload.filename is not None:
        fname = payload.filename.strip()
        if fname:
            updates.append("filename = ?")
            params.append(fname)

    if payload.alt_text is not None:
        updates.append("alt_text = ?")
        params.append(payload.alt_text.strip())

    if payload.clear_folder:
        updates.append("folder_id = NULL")
    elif payload.folder_id is not None:
        if payload.folder_id == 0:
            updates.append("folder_id = NULL")
        else:
            cursor.execute("SELECT id FROM media_folders WHERE id = ?;", (payload.folder_id,))
            if not cursor.fetchone():
                conn.close()
                raise HTTPException(status_code=404, detail={"code": 404, "message": "指定的目標資料夾不存在"})
            updates.append("folder_id = ?")
            params.append(payload.folder_id)

    if updates:
        params.append(asset_id)
        cursor.execute(f"UPDATE media_assets SET {', '.join(updates)} WHERE id = ?;", params)
        conn.commit()

    cursor.execute("""
        SELECT 
            m.id, m.filename, m.original_filename, m.webp_url, m.thumb_url, m.medium_url,
            m.mime_type, m.file_size, m.original_size, m.width, m.height,
            m.alt_text, m.folder_id, f.name as folder_name,
            m.uploader_id, u.name as uploader_name, m.created_at
        FROM media_assets m
        LEFT JOIN media_folders f ON m.folder_id = f.id
        LEFT JOIN users u ON m.uploader_id = u.id
        WHERE m.id = ?;
    """, (asset_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return {"code": 200, "message": "媒體資產更新成功", "data": updated}

@app.delete("/api/v1/media/{asset_id}", tags=["Media Assets"])
def delete_media_asset(
    asset_id: int,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """刪除媒體資產（從資料庫移除並同步刪除磁碟中 Full, Medium, Thumb WebP 檔案）"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media_assets WHERE id = ?;", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該媒體資產"})

    # 實體檔案清理
    remove_media_files(asset["webp_url"], asset["medium_url"], asset["thumb_url"])

    cursor.execute("DELETE FROM media_assets WHERE id = ?;", (asset_id,))
    conn.commit()
    conn.close()

    return {
        "code": 200,
        "message": f"媒體資產 {asset['filename']} 已永久刪除",
        "data": {"deleted_asset_id": asset_id}
    }

@app.post("/api/v1/media/{asset_id}/transform", tags=["Media Assets"])
def transform_media_asset(
    asset_id: int,
    payload: ImageTransformRequest,
    current_user: dict = Depends(require_roles(["super_admin", "editor", "author"]))
):
    """
    輕量圖片編輯轉換：
    支援 90/180/270 度旋轉與自訂矩形裁切，並自動重製 WebP / Medium / Thumb 衍生檔案
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media_assets WHERE id = ?;", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "找不到該媒體資產"})

    raw_filename = os.path.basename(asset["webp_url"])
    full_path = os.path.join(MEDIA_DIR, raw_filename)
    if not os.path.exists(full_path):
        conn.close()
        raise HTTPException(status_code=404, detail={"code": 404, "message": "伺服器磁碟找不到該主圖檔案"})

    try:
        img = Image.open(full_path)
        img = img.convert("RGBA" if img.mode in ("RGBA", "LA") else "RGB")

        # 旋轉 (順時針)
        if payload.rotate in (90, 180, 270):
            # PIL rotate 是逆時針，負值為順時針
            img = img.rotate(-payload.rotate, expand=True)

        # 裁切
        if payload.crop_width and payload.crop_height:
            cx = max(0, payload.crop_x or 0)
            cy = max(0, payload.crop_y or 0)
            cw = min(img.width - cx, payload.crop_width)
            ch = min(img.height - cy, payload.crop_height)
            if cw > 10 and ch > 10:
                img = img.crop((cx, cy, cx + cw, cy + ch))

        # 重新寫入磁碟與衍生檔案
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=85)
        new_bytes = buf.getvalue()

        # 更新衍生圖
        processed = process_and_save_image(new_bytes, asset["original_filename"])

        # 移除舊圖檔
        remove_media_files(asset["webp_url"], asset["medium_url"], asset["thumb_url"])

        # 更新 DB 記錄
        cursor.execute("""
            UPDATE media_assets
            SET webp_url = ?, thumb_url = ?, medium_url = ?,
                file_size = ?, width = ?, height = ?
            WHERE id = ?;
        """, (
            processed["webp_url"],
            processed["thumb_url"],
            processed["medium_url"],
            processed["file_size"],
            processed["width"],
            processed["height"],
            asset_id
        ))
        conn.commit()

        cursor.execute("""
            SELECT 
                m.id, m.filename, m.original_filename, m.webp_url, m.thumb_url, m.medium_url,
                m.mime_type, m.file_size, m.original_size, m.width, m.height,
                m.alt_text, m.folder_id, f.name as folder_name,
                m.uploader_id, u.name as uploader_name, m.created_at
            FROM media_assets m
            LEFT JOIN media_folders f ON m.folder_id = f.id
            LEFT JOIN users u ON m.uploader_id = u.id
            WHERE m.id = ?;
        """, (asset_id,))
        updated = dict(cursor.fetchone())
        conn.close()

        return {"code": 200, "message": "圖片編輯與衍生圖更新成功", "data": updated}

    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail={"code": 500, "message": f"圖片處理失敗: {str(e)}"})
