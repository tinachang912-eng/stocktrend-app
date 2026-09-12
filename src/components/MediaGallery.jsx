import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';
const BACKEND_BASE = 'http://127.0.0.1:8000';

export default function MediaGallery({ token, currentUser, showToast }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('all'); // 'all' | 'root' | number
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  
  // 檢視模式與篩選
  const [viewLayout, setViewLayout] = useState('grid'); // 'grid' | 'list'
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // 新增資料夾狀態
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 檢視與輕量編輯彈窗
  const [inspectingAsset, setInspectingAsset] = useState(null);
  const [editAltText, setEditAltText] = useState('');
  const [editFilename, setEditFilename] = useState('');
  const [selectedCropRatio, setSelectedCropRatio] = useState('free'); // '1:1' | '4:3' | '16:9' | 'free'
  const [transforming, setTransforming] = useState(false);

  // 拖曳上傳 Dropzone 狀態
  const [isDraggingOverDropzone, setIsDraggingOverDropzone] = useState(false);
  const [draggedAssetId, setDraggedAssetId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFolders();
    fetchStats();
  }, [token]);

  useEffect(() => {
    fetchAssets();
  }, [selectedFolderId, keyword, sortBy, sortOrder, token]);

  const authHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. 取得資料夾列表
  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/media/folders`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setFolders(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. 取得統計數據
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/media/stats`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. 取得資產列表
  const fetchAssets = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/media?sort_by=${sortBy}&order=${sortOrder}&limit=100`;
      if (selectedFolderId && selectedFolderId !== 'all') {
        url += `&folder_id=${selectedFolderId}`;
      }
      if (keyword.trim()) {
        url += `&keyword=${encodeURIComponent(keyword.trim())}`;
      }

      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setAssets(data.data || []);
      } else {
        showToast(data.detail?.message || '載入媒體資產失敗', 'error');
      }
    } catch (err) {
      showToast('連線至媒體伺服器失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 4. 批次或單張圖片上傳
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(`正在處理與轉碼 ${files.length} 個圖檔...`);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    if (selectedFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'root') {
      formData.append('folder_id', selectedFolderId);
    }

    try {
      const res = await fetch(`${API_BASE}/media/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || '圖片轉碼上傳成功！', 'success');
        fetchAssets();
        fetchFolders();
        fetchStats();
      } else {
        const errorMsg = data.detail?.message || (data.detail?.errors ? data.detail.errors.join(', ') : '上傳失敗');
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      showToast(`上傳異常: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 5. 新增資料夾
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/media/folders`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`資料夾「${newFolderName}」建立成功`, 'success');
        setNewFolderName('');
        setIsCreatingFolder(false);
        fetchFolders();
      } else {
        showToast(data.detail?.message || '建立資料夾失敗', 'error');
      }
    } catch (err) {
      showToast('建立資料夾連線異常', 'error');
    }
  };

  // 6. 刪除資料夾
  const handleDeleteFolder = async (folderId, folderName) => {
    if (!window.confirm(`確定要刪除資料夾「${folderName}」嗎？\n內部資產將自動移至根目錄，不會遺失。`)) return;

    try {
      const res = await fetch(`${API_BASE}/media/folders/${folderId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || '資料夾已刪除', 'success');
        if (selectedFolderId == folderId) {
          setSelectedFolderId('all');
        }
        fetchFolders();
        fetchAssets();
      } else {
        showToast(data.detail?.message || '刪除失敗', 'error');
      }
    } catch (err) {
      showToast('刪除資料夾失敗', 'error');
    }
  };

  // 7. 拖曳檔案至資料夾 (Move Asset to Folder)
  const handleDropOnFolder = async (targetFolderId) => {
    if (!draggedAssetId) return;

    try {
      const res = await fetch(`${API_BASE}/media/${draggedAssetId}`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folder_id: targetFolderId === 'root' ? 0 : Number(targetFolderId),
          clear_folder: targetFolderId === 'root'
        })
      });

      if (res.ok) {
        showToast('檔案已成功移動所屬資料夾！', 'success');
        fetchAssets();
        fetchFolders();
      } else {
        showToast('移動檔案失敗', 'error');
      }
    } catch (err) {
      showToast('操作異常', 'error');
    } finally {
      setDraggedAssetId(null);
    }
  };

  // 8. 刪除資產
  const handleDeleteAsset = async (assetId, filename) => {
    if (!window.confirm(`確定要永久刪除圖片「${filename}」嗎？\n此動作將一併刪除伺服器磁碟上的 WebP 與縮圖。`)) return;

    try {
      const res = await fetch(`${API_BASE}/media/${assetId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || '資產已刪除', 'success');
        if (inspectingAsset?.id === assetId) {
          setInspectingAsset(null);
        }
        fetchAssets();
        fetchFolders();
        fetchStats();
      } else {
        showToast(data.detail?.message || '刪除失敗', 'error');
      }
    } catch (err) {
      showToast('刪除資產失敗', 'error');
    }
  };

  // 9. 開啟圖片檢查器 / 編輯彈窗
  const openInspector = (asset) => {
    setInspectingAsset(asset);
    setEditAltText(asset.alt_text || '');
    setEditFilename(asset.filename || '');
    setSelectedCropRatio('free');
  };

  // 10. 儲存 Alt Text 與檔名修改
  const handleSaveAssetMetadata = async () => {
    if (!inspectingAsset) return;

    try {
      const res = await fetch(`${API_BASE}/media/${inspectingAsset.id}`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alt_text: editAltText.trim(),
          filename: editFilename.trim()
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast('圖片資訊與 Alt Text 已更新！', 'success');
        setInspectingAsset(data.data);
        fetchAssets();
      } else {
        showToast(data.detail?.message || '更新失敗', 'error');
      }
    } catch (err) {
      showToast('更新資產失敗', 'error');
    }
  };

  // 11. 圖片輕量轉換（旋轉 90 度或裁切）
  const handleTransformImage = async (rotateDeg = 0, cropPreset = null) => {
    if (!inspectingAsset) return;
    setTransforming(true);

    let cropParams = {};
    if (cropPreset === '1:1') {
      const side = Math.min(inspectingAsset.width, inspectingAsset.height);
      const cx = Math.floor((inspectingAsset.width - side) / 2);
      const cy = Math.floor((inspectingAsset.height - side) / 2);
      cropParams = { crop_x: cx, crop_y: cy, crop_width: side, crop_height: side };
    } else if (cropPreset === '16:9') {
      let targetW = inspectingAsset.width;
      let targetH = Math.floor(targetW * 9 / 16);
      if (targetH > inspectingAsset.height) {
        targetH = inspectingAsset.height;
        targetW = Math.floor(targetH * 16 / 9);
      }
      const cx = Math.floor((inspectingAsset.width - targetW) / 2);
      const cy = Math.floor((inspectingAsset.height - targetH) / 2);
      cropParams = { crop_x: cx, crop_y: cy, crop_width: targetW, crop_height: targetH };
    } else if (cropPreset === '4:3') {
      let targetW = inspectingAsset.width;
      let targetH = Math.floor(targetW * 3 / 4);
      if (targetH > inspectingAsset.height) {
        targetH = inspectingAsset.height;
        targetW = Math.floor(targetH * 4 / 3);
      }
      const cx = Math.floor((inspectingAsset.width - targetW) / 2);
      const cy = Math.floor((inspectingAsset.height - targetH) / 2);
      cropParams = { crop_x: cx, crop_y: cy, crop_width: targetW, crop_height: targetH };
    }

    try {
      const res = await fetch(`${API_BASE}/media/${inspectingAsset.id}/transform`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rotate: rotateDeg,
          ...cropParams
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast('圖片處理完成並已重新產製衍生 WebP！', 'success');
        setInspectingAsset(data.data);
        fetchAssets();
        fetchStats();
      } else {
        showToast(data.detail?.message || '圖片變換失敗', 'error');
      }
    } catch (err) {
      showToast('轉換服務發生錯誤', 'error');
    } finally {
      setTransforming(false);
    }
  };

  // 複製網址工具
  const copyToClipboard = (relUrl, label = 'URL') => {
    const fullUrl = `${BACKEND_BASE}${relUrl}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast(`已複製 ${label} 到剪貼簿！`, 'success');
    }).catch(() => {
      showToast('複製失敗，請手動複製', 'error');
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* 1. 頂部效益指標與控制欄 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          padding: '1.2rem 1.5rem',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
            🖼️ 總媒體資產
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
            {stats?.total_count ?? assets.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>個檔案</span>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          padding: '1.2rem 1.5rem',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
            ⚡ WebP 轉碼壓縮總容量
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
            {formatBytes(stats?.total_webp_bytes || 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            原始體積: {formatBytes(stats?.total_orig_bytes || 0)}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          padding: '1.2rem 1.5rem',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
            📉 儲存空間節省效益
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--warm-amber)' }}>
            {stats?.savings_percentage !== undefined ? `${stats.savings_percentage}%` : '85%'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            自動產製 1200px 及 400px 縮圖
          </div>
        </div>
      </div>

      {/* 2. 拖曳上傳 Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOverDropzone(true);
        }}
        onDragLeave={() => setIsDraggingOverDropzone(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOverDropzone(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
          }
        }}
        style={{
          border: `2px dashed ${isDraggingOverDropzone ? 'var(--primary)' : 'var(--border)'}`,
          background: isDraggingOverDropzone ? 'var(--warm-peach)' : 'var(--bg-card)',
          borderRadius: '16px',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          transition: 'all 0.25s ease',
          cursor: 'pointer',
          boxShadow: isDraggingOverDropzone ? 'var(--shadow-md)' : 'none'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleUploadFiles(e.target.files)}
        />
        <div style={{ fontSize: '2.4rem', marginBottom: '0.6rem' }}>
          {uploading ? '⏳' : isDraggingOverDropzone ? '📥' : '☁️'}
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
          {uploading ? uploadProgress : '點擊選取或拖曳圖檔至此處上傳'}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          支援多圖平行上傳 • 單檔限制 &lt; 20MB • 自動轉為 WebP (Quality 85%) 並產生 1200px 中圖與 400px 正方形縮圖
        </div>
      </div>

      {/* 3. 媒體庫主區域 (側邊資料夾 + 檔案展示格) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>

        {/* 側邊虛擬資料夾導航 (支援作為拖曳放下目標) */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '1.2rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.6rem',
            borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              📁 媒體資料夾
            </div>
            <button
              onClick={() => setIsCreatingFolder(true)}
              style={{
                background: 'var(--bg-tag)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--primary)',
                cursor: 'pointer'
              }}
            >
              + 新建
            </button>
          </div>

          {/* 新增資料夾輸入欄 */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} style={{ marginBottom: '1rem', display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={newFolderName}
                placeholder="資料夾名稱..."
                autoFocus
                onChange={(e) => setNewFolderName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                確定
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </form>
          )}

          {/* 資料夾項目 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div
              onClick={() => setSelectedFolderId('all')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedFolderId === 'all' ? 'var(--warm-peach)' : 'transparent',
                color: selectedFolderId === 'all' ? 'var(--primary)' : 'var(--text-main)',
                fontWeight: selectedFolderId === 'all' ? 700 : 500,
                fontSize: '0.88rem',
                transition: 'background 0.2s'
              }}
            >
              <span>🌐 全部資產</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{stats?.total_count || assets.length}</span>
            </div>

            <div
              onClick={() => setSelectedFolderId('root')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnFolder('root');
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedFolderId === 'root' ? 'var(--warm-peach)' : 'transparent',
                color: selectedFolderId === 'root' ? 'var(--primary)' : 'var(--text-main)',
                fontWeight: selectedFolderId === 'root' ? 700 : 500,
                fontSize: '0.88rem',
                transition: 'background 0.2s'
              }}
            >
              <span>📂 根目錄 (未分類)</span>
            </div>

            {folders.map(f => (
              <div
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnFolder(f.id);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedFolderId == f.id ? 'var(--warm-peach)' : 'transparent',
                  color: selectedFolderId == f.id ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: selectedFolderId == f.id ? 700 : 500,
                  fontSize: '0.88rem',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                  <span>📁</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{f.asset_count}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(f.id, f.name);
                    }}
                    title="刪除此資料夾"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '0 2px'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '0.8rem',
            borderRadius: '8px',
            background: 'var(--bg-tag)',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            💡 <strong>小提示</strong>：直接把右側圖片拖曳到左側資料夾項目上，即可快速完成歸類！
          </div>
        </div>

        {/* 右側檔案庫展示區 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* 搜尋、排序與佈局切換列 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.8rem',
            background: 'var(--bg-card)',
            padding: '0.9rem 1.2rem',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="🔍 搜尋檔案名稱或 Alt Text..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '0.45rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="created_at">依上傳日期</option>
                <option value="file_size">依檔案大小</option>
                <option value="filename">依檔案名稱</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                title="切換升降冪排序"
                style={{
                  padding: '0.45rem 0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tag)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {sortOrder === 'desc' ? '⬇ 降冪' : '⬆ 升冪'}
              </button>

              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setViewLayout('grid')}
                  style={{
                    padding: '0.45rem 0.7rem',
                    border: 'none',
                    background: viewLayout === 'grid' ? 'var(--primary)' : 'var(--bg-card)',
                    color: viewLayout === 'grid' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="網格檢視"
                >
                  🔲 網格
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  style={{
                    padding: '0.45rem 0.7rem',
                    border: 'none',
                    background: viewLayout === 'list' ? 'var(--primary)' : 'var(--bg-card)',
                    color: viewLayout === 'list' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="列表檢視"
                >
                  📄 列表
                </button>
              </div>
            </div>
          </div>

          {/* 載入中狀態 */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              ⏳ 正在載入資產...
            </div>
          )}

          {/* 無資料狀態 */}
          {!loading && assets.length === 0 && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              padding: '4rem 2rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🖼️</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                查無任何媒體資產
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                上方可直接拖曳圖檔進行轉碼上傳
              </div>
            </div>
          )}

          {/* 網格檢視模式 (Grid View) */}
          {!loading && viewLayout === 'grid' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1.2rem'
            }}>
              {assets.map(asset => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedAssetId(asset.id);
                    e.dataTransfer.setData('text/plain', String(asset.id));
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'grab'
                  }}
                >
                  {/* 縮圖預覽 */}
                  <div
                    onClick={() => openInspector(asset)}
                    style={{
                      height: '170px',
                      background: 'var(--bg-tag)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                  >
                    <img
                      src={`${BACKEND_BASE}${asset.thumb_url || asset.webp_url}`}
                      alt={asset.alt_text || asset.filename}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                    
                    {/* 標籤徽章 */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      <span style={{
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        WebP
                      </span>
                      {asset.compression_ratio > 0 && (
                        <span style={{
                          background: '#10b981',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          -{asset.compression_ratio}%
                        </span>
                      )}
                    </div>

                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.72rem'
                    }}>
                      {asset.width} × {asset.height}
                    </div>
                  </div>

                  {/* 檔案資訊 */}
                  <div style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    <div
                      title={asset.filename}
                      style={{
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {asset.filename}
                    </div>

                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{formatBytes(asset.file_size)}</span>
                      <span>{asset.folder_name ? `📁 ${asset.folder_name}` : '未分類'}</span>
                    </div>

                    {asset.alt_text && (
                      <div
                        title={`Alt: ${asset.alt_text}`}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          background: 'var(--warm-peach)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        Alt: {asset.alt_text}
                      </div>
                    )}

                    {/* 操作快捷鍵 */}
                    <div style={{
                      display: 'flex',
                      gap: '0.4rem',
                      marginTop: 'auto',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid var(--border)'
                    }}>
                      <button
                        onClick={() => openInspector(asset)}
                        style={{
                          flex: 1,
                          padding: '0.35rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-tag)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🔍 編輯
                      </button>
                      <button
                        onClick={() => copyToClipboard(asset.webp_url, 'WebP URL')}
                        title="複製完整圖片 URL"
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-tag)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.filename)}
                        title="刪除"
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #fee2e2',
                          background: '#fff5f5',
                          color: '#ef4444',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 列表檢視模式 (List View) */}
          {!loading && viewLayout === 'list' && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              overflowX: 'auto',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tag)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left', width: '80px' }}>預覽</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>檔案名稱</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>所屬資料夾</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>原始 / WebP 大小</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>尺寸</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Alt 屬性描述</th>
                    <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => (
                    <tr
                      key={asset.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedAssetId(asset.id);
                        e.dataTransfer.setData('text/plain', String(asset.id));
                      }}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    >
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <img
                          src={`${BACKEND_BASE}${asset.thumb_url || asset.webp_url}`}
                          alt={asset.alt_text}
                          onClick={() => openInspector(asset)}
                          style={{
                            width: '48px',
                            height: '48px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {asset.filename}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                        {asset.folder_name ? `📁 ${asset.folder_name}` : '未分類'}
                      </td>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <div>{formatBytes(asset.file_size)}</div>
                        <div style={{ fontSize: '0.74rem', color: '#10b981' }}>
                          省 {asset.compression_ratio}%
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                        {asset.width} × {asset.height}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.alt_text || '—'}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openInspector(asset)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-tag)',
                              cursor: 'pointer',
                              fontSize: '0.78rem'
                            }}
                          >
                            🔍 編輯
                          </button>
                          <button
                            onClick={() => copyToClipboard(asset.webp_url, 'WebP URL')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-tag)',
                              cursor: 'pointer',
                              fontSize: '0.78rem'
                            }}
                          >
                            📋 複製
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset.id, asset.filename)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              background: '#fff5f5',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '0.78rem'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* 4. 圖片檢查器與輕量編輯彈窗 (Inspector & Lightweight Editor Modal) */}
      {inspectingAsset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            maxWidth: '1000px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)'
          }}>
            {/* 彈窗標題列 */}
            <div style={{
              padding: '1.2rem 1.8rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                  媒體資產檢視與輕量編輯器
                </span>
              </div>
              <button
                onClick={() => setInspectingAsset(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* 彈窗主體 (左側圖片預覽 + 右側編輯面板) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 1.2fr) 1fr',
              overflowY: 'auto',
              flex: 1
            }}>
              {/* 左側大圖預覽與變換按鈕 */}
              <div style={{
                padding: '1.5rem',
                background: 'var(--bg-tag)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                borderRight: '1px solid var(--border)'
              }}>
                <div style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  background: '#000'
                }}>
                  <img
                    src={`${BACKEND_BASE}${inspectingAsset.medium_url || inspectingAsset.webp_url}`}
                    alt={inspectingAsset.alt_text}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain'
                    }}
                  />
                </div>

                {/* 快捷變換工具列 */}
                <div style={{
                  display: 'flex',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  width: '100%'
                }}>
                  <button
                    disabled={transforming}
                    onClick={() => handleTransformImage(90, null)}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 順時針旋轉 90°
                  </button>

                  <button
                    disabled={transforming}
                    onClick={() => handleTransformImage(0, '1:1')}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ✂️ 1:1 正方形裁切
                  </button>

                  <button
                    disabled={transforming}
                    onClick={() => handleTransformImage(0, '16:9')}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ✂️ 16:9 寬螢幕裁切
                  </button>
                </div>
                {transforming && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                    ⏳ 正在轉換並重新產製衍生圖...
                  </div>
                )}
              </div>

              {/* 右側資訊與 Metadata 編輯 */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                    檔案名稱 (Filename)
                  </label>
                  <input
                    type="text"
                    value={editFilename}
                    onChange={(e) => setEditFilename(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                    SEO 替代文字 (Alt Text) ⚡
                  </label>
                  <textarea
                    rows={3}
                    value={editAltText}
                    onChange={(e) => setEditAltText(e.target.value)}
                    placeholder="輸入對無障礙瀏覽與搜尋引擎友善的 Alt Text..."
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    填寫具備語意之 Alt 描述有助於提升文章 SEO 分數
                  </div>
                </div>

                {/* 儲存 Metadata 按鈕 */}
                <button
                  onClick={handleSaveAssetMetadata}
                  style={{
                    background: 'var(--primary-gradient)',
                    color: '#fff',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  💾 儲存資訊修改
                </button>

                {/* 規格詳細資料 */}
                <div style={{
                  background: 'var(--bg-tag)',
                  padding: '1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  marginTop: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>原始尺寸：</span>
                    <span style={{ fontWeight: 600 }}>{inspectingAsset.width} × {inspectingAsset.height} px</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>壓縮效益：</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>
                      {formatBytes(inspectingAsset.original_size)} → {formatBytes(inspectingAsset.file_size)} (-{inspectingAsset.compression_ratio}%)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>MIME 類型：</span>
                    <span style={{ fontWeight: 600 }}>{inspectingAsset.mime_type}</span>
                  </div>
                </div>

                {/* 三種衍生尺寸網址與複製快捷 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    🔗 衍生尺寸即時存取網址：
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', width: '70px', color: 'var(--text-muted)' }}>Full WebP:</span>
                    <button
                      onClick={() => copyToClipboard(inspectingAsset.webp_url, 'Full WebP URL')}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📋 複製主圖 URL
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', width: '70px', color: 'var(--text-muted)' }}>Medium (1200):</span>
                    <button
                      onClick={() => copyToClipboard(inspectingAsset.medium_url, 'Medium 1200px URL')}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📋 複製中圖 1200px URL
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', width: '70px', color: 'var(--text-muted)' }}>Thumb (400):</span>
                    <button
                      onClick={() => copyToClipboard(inspectingAsset.thumb_url, 'Thumbnail 400px URL')}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📋 複製縮圖 400px URL
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
