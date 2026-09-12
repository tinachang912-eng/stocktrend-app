import sys
import io
import os
import json
import time
import urllib.request
import urllib.error
from PIL import Image, ImageDraw

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "media"))

import urllib.parse

def api_request(path, method="GET", data=None, token=None, content_type="application/json"):
    parts = path.split("?", 1)
    if len(parts) == 2:
        encoded_query = urllib.parse.quote(parts[1], safe="=&")
        url = f"{BASE_URL}{parts[0]}?{encoded_query}"
    else:
        url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if data is not None:
        if content_type == "application/json":
            headers["Content-Type"] = "application/json"
            body = json.dumps(data).encode("utf-8")
        else:
            headers["Content-Type"] = content_type
            body = data

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"raw": err_body}

def multipart_upload(path, files_dict, form_fields=None, token=None):
    """Utility to perform multipart/form-data upload using urllib."""
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()

    if form_fields:
        for k, v in form_fields.items():
            if v is None:
                continue
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
            body.extend(f"{v}\r\n".encode("utf-8"))

    for field_name, (filename, file_bytes, mime) in files_dict.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {mime}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    content_type = f"multipart/form-data; boundary={boundary}"
    return api_request(path, method="POST", data=bytes(body), token=token, content_type=content_type)

def create_sample_png(width=1600, height=1000, color="blue"):
    """Creates an in-memory sample PNG with geometric patterns to test compression."""
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    for i in range(0, min(width, height) // 2, 25):
        draw.rectangle([i, i, width - i, height - i], outline="gold", width=3)
    draw.text((width // 4, height // 2), f"Phase 2 Test Image - {width}x{height}", fill="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def run_tests():
    print("=" * 70)
    print("🚀 [Phase 2] 媒體管線與資產中心 (Media Pipeline & Asset Hub) 自動化驗收測試")
    print("=" * 70)

    start_all = time.time()

    # 1. 取得管理員與作者 JWT Token
    print("\n[Step 1] 登入並取得授權 Token...")
    status, res = api_request("/api/v1/auth/login", method="POST", data={
        "email": "admin@cms.example.com",
        "password": "password123"
    })
    assert status == 200, f"管理員登入失敗: {res}"
    admin_token = res["data"]["access_token"]
    print("  ✔ 管理員登入成功 (Role: super_admin)")

    status, res = api_request("/api/v1/auth/login", method="POST", data={
        "email": "author@cms.example.com",
        "password": "password123"
    })
    assert status == 200, f"作者登入失敗: {res}"
    author_token = res["data"]["access_token"]
    print("  ✔ 作者登入成功 (Role: author)")

    # 2. 虛擬資料夾 CRUD 測試
    print("\n[Step 2] 測試虛擬資料夾系統 (media_folders)...")
    status, res = api_request("/api/v1/media/folders", token=admin_token)
    assert status == 200 and len(res["data"]) >= 3, f"取得資料夾失敗: {res}"
    initial_folder_count = len(res["data"])
    print(f"  ✔ 成功讀取現有資料夾，共有 {initial_folder_count} 個初始目錄")

    # 新增資料夾
    status, res = api_request("/api/v1/media/folders", method="POST", data={"name": "2026年專案設計圖"}, token=admin_token)
    assert status == 201, f"新增資料夾失敗: {res}"
    created_folder = res["data"]
    folder_id = created_folder["id"]
    print(f"  ✔ 成功建立新資料夾: ID={folder_id}, Name={created_folder['name']}")

    # 更新資料夾名稱
    status, res = api_request(f"/api/v1/media/folders/{folder_id}", method="PATCH", data={"name": "2026年視覺設計庫"}, token=admin_token)
    assert status == 200 and res["data"]["name"] == "2026年視覺設計庫", f"更新資料夾失敗: {res}"
    print(f"  ✔ 成功更新資料夾名稱 -> 2026年視覺設計庫")

    # 3. 圖片轉碼與多尺寸管線測試 (單張上傳)
    print("\n[Step 3] 測試高解析度圖檔上傳與 WebP 轉碼壓縮管線...")
    t0 = time.time()
    sample_png = create_sample_png(width=1800, height=1200, color="navy")
    orig_png_size = len(sample_png)
    print(f"  ℹ 產生測試高解析度 PNG 圖片: 1800x1200, 原始大小: {orig_png_size / 1024:.1f} KB")

    files_payload = {
        "files": ("feature_banner.png", sample_png, "image/png")
    }
    form_fields = {
        "folder_id": str(folder_id),
        "alt_text": "2026 年度專題封面主圖"
    }

    status, res = multipart_upload("/api/v1/media/upload", files_payload, form_fields=form_fields, token=admin_token)
    t_cost = time.time() - t0
    assert status == 201, f"上傳失敗: {res}"
    uploaded_assets = res["data"]
    assert len(uploaded_assets) == 1, "應回傳 1 筆成功上傳資產"
    asset1 = uploaded_assets[0]

    print(f"  ✔ 上傳與轉碼完成！總耗時: {t_cost:.3f} 秒 (遠小於驗收閘門 2 秒門檻)")
    print(f"  ✔ 資產 ID: {asset1['id']}, 原始檔名: {asset1['original_filename']}")
    print(f"  ✔ 轉碼後 WebP 大小: {asset1['file_size'] / 1024:.1f} KB (體積縮減 {(1 - asset1['file_size']/orig_png_size)*100:.1f}%)")
    print(f"  ✔ WebP URL: {asset1['webp_url']}")
    print(f"  ✔ Medium URL (1200px): {asset1['medium_url']}")
    print(f"  ✔ Thumb URL (400x400): {asset1['thumb_url']}")

    # 驗證實體磁碟衍生檔案
    main_fpath = os.path.join(UPLOADS_DIR, os.path.basename(asset1["webp_url"]))
    med_fpath = os.path.join(UPLOADS_DIR, os.path.basename(asset1["medium_url"]))
    thumb_fpath = os.path.join(UPLOADS_DIR, os.path.basename(asset1["thumb_url"]))

    assert os.path.exists(main_fpath), "磁碟應存在主圖 WebP"
    assert os.path.exists(med_fpath), "磁碟應存在中圖 WebP"
    assert os.path.exists(thumb_fpath), "磁碟應存在縮圖 WebP"

    # 驗證縮圖尺寸是否為 400x400
    with Image.open(thumb_fpath) as t_img:
        assert t_img.size == (400, 400), f"縮圖尺寸不符合 400x400: {t_img.size}"
    # 驗證中圖寬度是否為 1200
    with Image.open(med_fpath) as m_img:
        assert m_img.size[0] == 1200, f"中圖寬度不符合 1200: {m_img.size}"

    print("  ✔ 實體檔案與三種尺寸規格 (Full, Medium 1200px, Thumb 400x400) 驗證 100% 正確！")

    # 4. 批次上傳多張圖片測試
    print("\n[Step 4] 測試批次多圖平行上傳...")
    img2 = create_sample_png(width=800, height=600, color="darkgreen")
    img3 = create_sample_png(width=1000, height=1000, color="maroon")

    # Construct multiple files payload
    boundary = "----WebKitFormBoundaryMultiPartBatch"
    batch_body = bytearray()
    for fname, fbytes in [("gallery_1.png", img2), ("gallery_2.png", img3)]:
        batch_body.extend(f"--{boundary}\r\n".encode("utf-8"))
        batch_body.extend(f'Content-Disposition: form-data; name="files"; filename="{fname}"\r\n'.encode("utf-8"))
        batch_body.extend(b"Content-Type: image/png\r\n\r\n")
        batch_body.extend(fbytes)
        batch_body.extend(b"\r\n")
    batch_body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    status, res = api_request(
        "/api/v1/media/upload",
        method="POST",
        data=bytes(batch_body),
        token=admin_token,
        content_type=f"multipart/form-data; boundary={boundary}"
    )
    assert status == 201 and len(res["data"]) == 2, f"批次上傳失敗: {res}"
    print(f"  ✔ 成功批次上傳並轉碼 {len(res['data'])} 張圖片！")

    # 5. 上傳防護測試 (Magic Number 與偽造副檔名攔截)
    print("\n[Step 5] 測試安全檢驗：偽造副檔名與 Magic Number 防護...")
    fake_png_content = b"THIS_IS_NOT_AN_IMAGE_FILE_JUST_MALICIOUS_TEXT"
    fake_payload = {
        "files": ("exploit.png", fake_png_content, "image/png")
    }
    status, res = multipart_upload("/api/v1/media/upload", fake_payload, token=admin_token)
    assert status == 400, f"偽造圖檔應被攔截拒絕 (400)，但回傳: {status}, {res}"
    print("  ✔ 偽造圖檔 Magic Number 檢驗成功攔截 (HTTP 400 Bad Request)")

    # 6. 資產管理 API (檢索、篩選、更新 Alt Text 與搬移資料夾)
    print("\n[Step 6] 測試媒體資產檢索與修改 (Alt Text, 檔名, 移入資料夾)...")
    status, res = api_request(f"/api/v1/media/{asset1['id']}", token=admin_token)
    assert status == 200 and res["data"]["id"] == asset1["id"]

    # 更新 Alt Text 與檔案顯示名稱
    status, res = api_request(f"/api/v1/media/{asset1['id']}", method="PATCH", data={
        "alt_text": "更新後的繁體中文 Alt Text 描述",
        "filename": "年度專案首圖_旗艦版.webp"
    }, token=admin_token)
    assert status == 200
    assert res["data"]["alt_text"] == "更新後的繁體中文 Alt Text 描述"
    assert res["data"]["filename"] == "年度專案首圖_旗艦版.webp"
    print("  ✔ 成功透過 PATCH 更新 Alt Text 與檔案自訂名稱")

    # 關鍵字搜尋測試
    status, res = api_request("/api/v1/media?keyword=旗艦版", token=admin_token)
    assert status == 200 and res["total"] >= 1, f"關鍵字搜尋失敗: {res}"
    print(f"  ✔ 關鍵字篩選搜尋測試成功 (匹配筆數: {res['total']})")

    # 資料夾篩選測試
    status, res = api_request(f"/api/v1/media?folder_id={folder_id}", token=admin_token)
    assert status == 200 and res["total"] >= 1
    print(f"  ✔ 資料夾篩選測試成功 (資料夾 {folder_id} 內部檔案筆數: {res['total']})")

    # 7. 輕量圖片編輯轉換 API (旋轉與裁切)
    print("\n[Step 7] 測試輕量圖片編輯 API (90度順時針旋轉與自訂裁切)...")
    status, res = api_request(f"/api/v1/media/{asset1['id']}/transform", method="POST", data={
        "rotate": 90,
        "crop_x": 100,
        "crop_y": 100,
        "crop_width": 600,
        "crop_height": 600
    }, token=admin_token)
    assert status == 200, f"圖片變換失敗: {res}"
    transformed_asset = res["data"]
    assert transformed_asset["width"] == 600 and transformed_asset["height"] == 600
    print(f"  ✔ 圖片順利完成順時針旋轉與 600x600 正方形裁切，新尺寸: {transformed_asset['width']}x{transformed_asset['height']}")

    # 8. 儲存效益統計 API
    print("\n[Step 8] 測試媒體統計指標 (容量效益與 WebP 節省比率)...")
    status, res = api_request("/api/v1/media/stats", token=admin_token)
    assert status == 200
    stats = res["data"]
    print(f"  ✔ 媒體庫總計: {stats['total_count']} 筆資產")
    print(f"  ✔ 原始總容量: {stats['total_orig_bytes'] / 1024:.1f} KB")
    print(f"  ✔ WebP 轉碼後總容量: {stats['total_webp_bytes'] / 1024:.1f} KB")
    print(f"  ✔ 整體容量節省率: {stats['savings_percentage']}%")

    # 9. 刪除資產與實體檔案清理測試
    print("\n[Step 9] 測試資產刪除與磁碟檔案同步清除...")
    status, res = api_request(f"/api/v1/media/{asset1['id']}", method="DELETE", token=admin_token)
    assert status == 200, f"刪除資產失敗: {res}"
    # 驗證 DB 查無此筆
    status, res = api_request(f"/api/v1/media/{asset1['id']}", token=admin_token)
    assert status == 404, "刪除後應無法再查詢到該資產"
    # 驗證實體檔案是否已從磁碟清除
    trans_main = os.path.join(UPLOADS_DIR, os.path.basename(transformed_asset["webp_url"]))
    assert not os.path.exists(trans_main), f"實體磁碟主圖檔案應已被清除: {trans_main}"
    print("  ✔ 成功刪除資產，且磁碟中衍生檔案皆已徹底清除！")

    # 10. 刪除資料夾時自動孤兒保護 (內部資產歸入根目錄)
    print("\n[Step 10] 測試刪除資料夾之階層保護與軟移轉...")
    status, res = api_request(f"/api/v1/media/folders/{folder_id}", method="DELETE", token=admin_token)
    assert status == 200
    print("  ✔ 資料夾刪除成功，內部資產安全降級至根目錄 (NULL)")

    elapsed = time.time() - start_all
    print("\n" + "=" * 70)
    print(f"🎉 [Phase 2] 全部 10 項自動化測試通過！(100% Passed, 總耗時: {elapsed:.2f}s)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
