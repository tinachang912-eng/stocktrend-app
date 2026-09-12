import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# 將 practice 目錄加入 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_phase1_workflow():
    print("=" * 60)
    print("🚀 開始執行 Phase 1 獨立自動化測試矩陣")
    print("=" * 60)

    # 1. 測試公開系統概況端點
    res = client.get("/api/v1/system/summary")
    assert res.status_code == 200
    summary = res.json()["data"]
    print(f"[✔] 系統概況端點正常：{summary}")

    # 2. 測試 4 種角色的登入
    roles_login = [
        ("admin@cms.example.com", "super_admin"),
        ("editor@cms.example.com", "editor"),
        ("author@cms.example.com", "author"),
        ("proofreader@cms.example.com", "proofreader")
    ]
    tokens = {}
    for email, expected_role in roles_login:
        login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
        assert login_res.status_code == 200, f"登入失敗: {email}"
        data = login_res.json()["data"]
        assert data["user"]["role"] == expected_role
        tokens[expected_role] = data["access_token"]
        print(f"[✔] 成功登入角色 [{expected_role}] ({email})，取得 JWT Token")

    # 3. 測試錯誤密碼登入 (401)
    bad_login = client.post("/api/v1/auth/login", json={"email": "admin@cms.example.com", "password": "wrongpassword"})
    assert bad_login.status_code == 401
    print("[✔] 密碼錯誤防護正常 (HTTP 401)")

    # 4. 測試 GET /api/v1/auth/me
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['editor']}"})
    assert me_res.status_code == 200
    assert me_res.json()["data"]["role"] == "editor"
    print(f"[✔] /auth/me 個人資訊與權限正常: {me_res.json()['data']['permissions']}")

    # 5. 測試 RBAC 越權攔截 (Super Admin 專屬端點)
    # 5.1 Author 呼叫 admin 端點 -> 必須被攔截為 403
    forbidden_res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {tokens['author']}"})
    assert forbidden_res.status_code == 403, f"應為 403，實際為 {forbidden_res.status_code}"
    print(f"[✔] RBAC 越權防護驗證成功：Author 存取管理端點被正確攔截 (HTTP 403)")

    # 5.2 Super Admin 呼叫 admin 端點 -> 必須成功 200
    admin_res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {tokens['super_admin']}"})
    assert admin_res.status_code == 200
    assert len(admin_res.json()["data"]) >= 4
    print(f"[✔] Super Admin 存取管理端點成功 (HTTP 200，共 {admin_res.json()['total']} 位使用者)")

    # 6. 測試兩層級分類樹 (GET /api/v1/categories)
    cats_res = client.get("/api/v1/categories")
    assert cats_res.status_code == 200
    tree = cats_res.json()["data"]
    assert len(tree) >= 3
    print(f"[✔] 兩層級分類樹正常：頂層主分類共 {len(tree)} 個，例如首個「{tree[0]['name']}」擁有 {len(tree[0]['children'])} 個子分類")

    # 7. 測試建立分類
    # 7.1 Author 嘗試建立分類 -> 403 Forbidden
    auth_cat_res = client.post(
        "/api/v1/categories", 
        json={"name": "未授權分類", "slug": "unauthorized-cat"},
        headers={"Authorization": f"Bearer {tokens['author']}"}
    )
    assert auth_cat_res.status_code == 403
    print("[✔] RBAC 分類建立權限控制正常：Author 無權建立分類 (HTTP 403)")

    # 7.2 Editor 建立二級分類 -> 201 Created
    import time
    unique_slug = f"multimodal-ai-test-{int(time.time())}"
    parent_ai_id = tree[0]["id"]
    new_cat_res = client.post(
        "/api/v1/categories", 
        json={"name": "多模態視覺 AI", "slug": unique_slug, "parent_id": parent_ai_id},
        headers={"Authorization": f"Bearer {tokens['editor']}"}
    )
    assert new_cat_res.status_code == 201
    created_cat_id = new_cat_res.json()["data"]["id"]
    print(f"[✔] Editor 成功在主分類下建立子分類「多模態視覺 AI」(ID={created_cat_id})")

    # 8. 測試刪除分類防呆與刪除功能
    del_res = client.delete(
        f"/api/v1/categories/{created_cat_id}",
        headers={"Authorization": f"Bearer {tokens['editor']}"}
    )
    assert del_res.status_code == 200
    print(f"[✔] Editor 成功刪除測試子分類")

    # 9. 測試標籤雲與搜尋 (GET /api/v1/tags)
    tags_res = client.get("/api/v1/tags")
    assert tags_res.status_code == 200
    tags_list = tags_res.json()["data"]
    assert len(tags_list) >= 8
    print(f"[✔] 標籤雲清單正常，共有 {len(tags_list)} 個標籤，首個為「{tags_list[0]['name']}」(關聯 {tags_list[0]['usage_count']} 篇文章)")

    # 10. Author 建立標籤
    tag_create_res = client.post(
        "/api/v1/tags",
        json={"name": "邊緣運算 SLM"},
        headers={"Authorization": f"Bearer {tokens['author']}"}
    )
    assert tag_create_res.status_code == 201
    new_tag_id = tag_create_res.json()["data"]["id"]
    print(f"[✔] Author 成功新增標籤「邊緣運算 SLM」(ID={new_tag_id})")

    # 清理測試標籤
    client.delete(f"/api/v1/tags/{new_tag_id}", headers={"Authorization": f"Bearer {tokens['editor']}"})

    print("=" * 60)
    print("🎉 Phase 1 所有單元與整合測試全數通過 (100% Passed)！")
    print("=" * 60)

if __name__ == '__main__':
    test_phase1_workflow()
