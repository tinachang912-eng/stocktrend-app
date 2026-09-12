import jwt
import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.db import get_db

SECRET_KEY = "super-secret-cms-key-2026-antigravity-practice"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

def create_access_token(data: dict) -> str:
    """簽發 JWT 存取權杖"""
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """解碼並驗證 JWT 權杖"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "error": "TOKEN_EXPIRED", "message": "登入憑證已過期，請重新登入"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "error": "INVALID_TOKEN", "message": "無效的認證權杖"}
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """解析並取得當前登入使用者資訊"""
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "error": "INVALID_CREDENTIALS", "message": "權杖無效"}
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, role, status, created_at FROM users WHERE id = ?;", (int(user_id),))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "error": "USER_NOT_FOUND", "message": "使用者不存在"}
        )

    if user["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 403, "error": "USER_INACTIVE", "message": "該帳號已被凍結或未啟用"}
        )

    return dict(user)

def require_roles(allowed_roles: list):
    """RBAC 角色檢查依賴注入工廠函式"""
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": 403,
                    "error": "FORBIDDEN",
                    "message": f"存取受限：當前角色 [{user_role}] 無權執行此操作，僅允許 [{', '.join(allowed_roles)}]"
                }
            )
        return current_user
    return role_checker
