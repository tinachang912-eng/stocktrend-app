import os
import io
import uuid
from typing import Dict, Any, Tuple
from PIL import Image, ImageOps

UPLOAD_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
MEDIA_DIR = os.path.join(UPLOAD_BASE_DIR, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB limit
WEBP_QUALITY = 85
MEDIUM_MAX_WIDTH = 1200
THUMBNAIL_SIZE = (400, 400)

MAGIC_SIGNATURES = [
    (b"\xFF\xD8\xFF", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"BM", "image/bmp"),
]

def validate_magic_number(data: bytes) -> bool:
    """Check magic bytes to ensure file is genuinely an image."""
    if len(data) < 12:
        return False
    # Check standard signatures
    for sig, _ in MAGIC_SIGNATURES:
        if data.startswith(sig):
            return True
    # WebP check: RIFF....WEBP
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True
    return False

def process_and_save_image(file_bytes: bytes, original_filename: str) -> Dict[str, Any]:
    """
    Validates, converts, and generates responsive WebP variants of the uploaded image.
    Outputs:
      - Full resolution WebP (quality=85)
      - Medium WebP (max width 1200px, aspect-ratio preserved)
      - Thumbnail WebP (400x400 square fit)
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"檔案大小超過上限 20MB (當前大小: {len(file_bytes) / (1024 * 1024):.2f}MB)")

    if not validate_magic_number(file_bytes):
        raise ValueError("不合法的圖檔標頭 (Magic Number 驗證失敗)，僅支援 JPG、PNG、WebP、GIF、BMP")

    try:
        img = Image.open(io.BytesIO(file_bytes))
        # 自動校正 EXIF 旋轉方向 (如手機相簿拍攝的方向標籤)
        img = ImageOps.exif_transpose(img) or img
    except Exception as e:
        raise ValueError(f"無法解析圖片格式: {str(e)}")

    orig_width, orig_height = img.size

    # 色彩通道處理：透明背景轉 RGBA，一般轉 RGB
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        img_full = img.convert("RGBA")
    else:
        img_full = img.convert("RGB")

    unique_prefix = f"{uuid.uuid4().hex[:12]}"
    # 保持原主檔名安全字元
    base_name = os.path.splitext(os.path.basename(original_filename))[0]
    safe_name = "".join(c for c in base_name if c.isalnum() or c in ("-", "_")).strip()
    if not safe_name:
        safe_name = "asset"
    safe_name = safe_name[:40]

    full_filename = f"{safe_name}_{unique_prefix}.webp"
    medium_filename = f"{safe_name}_{unique_prefix}_medium.webp"
    thumb_filename = f"{safe_name}_{unique_prefix}_thumb.webp"

    full_filepath = os.path.join(MEDIA_DIR, full_filename)
    medium_filepath = os.path.join(MEDIA_DIR, medium_filename)
    thumb_filepath = os.path.join(MEDIA_DIR, thumb_filename)

    # 1. 儲存 Full-Resolution WebP
    img_full.save(full_filepath, format="WEBP", quality=WEBP_QUALITY, method=6)
    full_file_size = os.path.getsize(full_filepath)

    # 2. 儲存 Medium WebP (寬度最多 1200px，高度等比縮放)
    if orig_width > MEDIUM_MAX_WIDTH:
        med_width = MEDIUM_MAX_WIDTH
        med_height = int(orig_height * (MEDIUM_MAX_WIDTH / orig_width))
        img_medium = img_full.resize((med_width, med_height), Image.Resampling.LANCZOS)
    else:
        img_medium = img_full.copy()
    img_medium.save(medium_filepath, format="WEBP", quality=WEBP_QUALITY, method=6)

    # 3. 儲存 400x400 正方形縮圖 (Square Thumbnail fit)
    img_thumb = ImageOps.fit(img_full, THUMBNAIL_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    img_thumb.save(thumb_filepath, format="WEBP", quality=WEBP_QUALITY, method=6)

    return {
        "filename": full_filename,
        "original_filename": original_filename,
        "webp_url": f"/uploads/media/{full_filename}",
        "medium_url": f"/uploads/media/{medium_filename}",
        "thumb_url": f"/uploads/media/{thumb_filename}",
        "mime_type": "image/webp",
        "file_size": full_file_size,
        "original_size": len(file_bytes),
        "width": orig_width,
        "height": orig_height,
        "full_filepath": full_filepath,
        "medium_filepath": medium_filepath,
        "thumb_filepath": thumb_filepath,
    }

def remove_media_files(webp_url: str, medium_url: str = None, thumb_url: str = None):
    """Safely delete derivative images from disk."""
    for url in [webp_url, medium_url, thumb_url]:
        if not url:
            continue
        fname = os.path.basename(url)
        fpath = os.path.join(MEDIA_DIR, fname)
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except OSError:
                pass
