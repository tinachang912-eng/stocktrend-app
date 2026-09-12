import React, { useState, useEffect } from 'react';
import MediaGallery from './MediaGallery';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export default function CmsPhase1({ onBackToPortfolio }) {
  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'categories' | 'tags' | 'rbac' | 'system'
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cms_access_token') || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 分類狀態
  const [categoriesTree, setCategoriesTree] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');

  // 標籤狀態
  const [tagsList, setTagsList] = useState([]);
  const [tagKeyword, setTagKeyword] = useState('');
  const [newTagName, setNewTagName] = useState('');

  // 權限測試結果
  const [testResult, setTestResult] = useState(null);

  // 系統概況
  const [systemSummary, setSystemSummary] = useState(null);

  // 初始載入與 Token 變更監聽
  useEffect(() => {
    if (token) {
      fetchMyProfile();
    } else {
      // 預設以超級管理員快速登入以便體驗
      quickLogin('admin@cms.example.com');
    }
    fetchCategories();
    fetchTags();
    fetchSystemSummary();
  }, [token]);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // 1. 登入 API
  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || '登入失敗');
      
      localStorage.setItem('cms_access_token', data.data.access_token);
      setToken(data.data.access_token);
      setCurrentUser(data.data.user);
      showToast(`登入成功！當前角色為 [${data.data.user.role}]`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email) => {
    handleLogin(email, 'password123');
  };

  const handleLogout = () => {
    localStorage.removeItem('cms_access_token');
    setToken('');
    setCurrentUser(null);
    showToast('已登出系統');
  };

  const fetchMyProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. 分類清單 API
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      if (res.ok) {
        setCategoriesTree(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName || !newCatSlug) return;
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCatName,
          slug: newCatSlug,
          parent_id: newCatParentId ? parseInt(newCatParentId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || '建立失敗');

      showToast(`分類「${newCatName}」建立成功！`);
      setNewCatName('');
      setNewCatSlug('');
      setNewCatParentId('');
      fetchCategories();
      fetchSystemSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (!window.confirm(`確定要刪除分類「${catName}」嗎？`)) return;
    try {
      const res = await fetch(`${API_BASE}/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || '刪除失敗');

      showToast(`分類「${catName}」已成功刪除`);
      fetchCategories();
      fetchSystemSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 3. 標籤清單 API
  const fetchTags = async (kw = '') => {
    try {
      const url = kw ? `${API_BASE}/tags?keyword=${encodeURIComponent(kw)}` : `${API_BASE}/tags`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTagsList(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName) return;
    try {
      const res = await fetch(`${API_BASE}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newTagName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || '標籤建立失敗');

      showToast(`標籤「${newTagName}」建立成功！`);
      setNewTagName('');
      fetchTags(tagKeyword);
      fetchSystemSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTag = async (tagId, tagName) => {
    if (!window.confirm(`確定要刪除標籤「${tagName}」嗎？`)) return;
    try {
      const res = await fetch(`${API_BASE}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || '刪除失敗');

      showToast(`標籤「${tagName}」已刪除`);
      fetchTags(tagKeyword);
      fetchSystemSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 4. RBAC 權限測試呼叫
  const testProtectedEndpoint = async (endpoint, allowedRoles, name) => {
    setTestResult({ loading: true, name });
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTestResult({
        name,
        status: res.status,
        ok: res.ok,
        data: data,
        allowedRoles
      });
    } catch (err) {
      setTestResult({
        name,
        status: 500,
        ok: false,
        data: { message: err.message },
        allowedRoles
      });
    }
  };

  // 5. 系統概況
  const fetchSystemSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/summary`);
      const data = await res.json();
      if (res.ok) setSystemSummary(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const roleColors = {
    super_admin: { bg: '#fee2e2', text: '#991b1b', label: '超級管理員 (Super Admin)' },
    editor: { bg: '#fef3c7', text: '#92400e', label: '總編輯 (Editor)' },
    author: { bg: '#e0e7ff', text: '#3730a3', label: '專欄作者 (Author)' },
    proofreader: { bg: '#f3e8ff', text: '#6b21a8', label: '校對員 (Proofreader)' }
  };

  return (
    <div style={{ padding: '2rem 0 6rem' }}>
      
      {/* 提示訊息 */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.85rem 1.4rem',
          borderRadius: '10px',
          background: message.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          color: message.type === 'error' ? '#991b1b' : '#065f46',
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          fontWeight: 600,
          fontSize: '0.92rem'
        }}>
          {message.text}
        </div>
      )}

      {/* 頂部導覽列 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '1.2rem 2rem',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <button
            onClick={onBackToPortfolio}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-tag)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            ← 返回個人網站
          </button>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ⚙️ CMS 後台管理平台 <span style={{ fontSize: '0.82rem', color: 'var(--primary)', background: 'var(--warm-peach)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>Phase 1 & 2: RBAC + 媒體管線</span>
          </div>
        </div>

        {/* 登入身分與快速切換 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{
                background: roleColors[currentUser.role]?.bg || '#f3f4f6',
                color: roleColors[currentUser.role]?.text || '#1f2937',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                {roleColors[currentUser.role]?.label || currentUser.role}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {currentUser.name}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline'
                }}
              >
                登出
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>未登入</span>
          )}
        </div>
      </div>

      {/* 4 角色一鍵測試快速切換列 */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '1rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          ⚡ 快速切換測試身份 (1-Click Switch)：
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {[
            { email: 'admin@cms.example.com', label: '👑 超級管理員', role: 'super_admin' },
            { email: 'editor@cms.example.com', label: '✍️ 總編輯', role: 'editor' },
            { email: 'author@cms.example.com', label: '📝 專欄作者', role: 'author' },
            { email: 'proofreader@cms.example.com', label: '🔍 校對員', role: 'proofreader' }
          ].map(r => (
            <button
              key={r.role}
              onClick={() => quickLogin(r.email)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: currentUser?.role === r.role ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: currentUser?.role === r.role ? 'var(--warm-peach)' : 'var(--bg-tag)',
                color: currentUser?.role === r.role ? 'var(--primary)' : 'var(--text-main)',
                transition: 'all 0.2s'
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 功能標籤切換 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '2.5rem',
        gap: '0.5rem'
      }}>
        {[
          { id: 'media', label: '🖼️ 媒體中心 (Phase 2)' },
          { id: 'categories', label: '📂 兩層級分類管理' },
          { id: 'tags', label: '🏷️ 標籤雲管理' },
          { id: 'rbac', label: '🛡️ RBAC 權限攔截測試' },
          { id: 'system', label: '📊 系統數據概況' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.8rem 1.4rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 0: 媒體管線與資產中心 (Phase 2) */}
      {activeTab === 'media' && (
        <MediaGallery
          token={token}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

      {/* Tab 1: 分類管理 */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
          {/* 左側：分類樹 */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              分類層級架構樹 (主分類 ➔ 子分類)
            </h3>

            {categoriesTree.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>尚無分類資料</div>
            ) : (
              <div style={{ display: 'grid', gap: '1.2rem' }}>
                {categoriesTree.map(parent => (
                  <div key={parent.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.2rem',
                    background: 'var(--bg-tag)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                          📁 {parent.name}
                        </span>
                        <span style={{ marginLeft: '0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          slug: {parent.slug}
                        </span>
                        <span style={{
                          marginLeft: '0.6rem',
                          fontSize: '0.75rem',
                          background: 'var(--warm-peach)',
                          color: 'var(--warm-terracotta)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px'
                        }}>
                          {parent.article_count} 篇
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteCategory(parent.id, parent.name)}
                        style={{
                          color: '#dc2626',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem'
                        }}
                      >
                        刪除
                      </button>
                    </div>

                    {/* 子分類清單 */}
                    {parent.children && parent.children.length > 0 && (
                      <div style={{ marginTop: '0.8rem', paddingLeft: '1.5rem', display: 'grid', gap: '0.4rem' }}>
                        {parent.children.map(child => (
                          <div key={child.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--bg-card)',
                            padding: '0.5rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                └ 📄 {child.name}
                              </span>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                ({child.slug})
                              </span>
                              <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.72rem',
                                background: '#f3f4f6',
                                color: '#4b5563',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px'
                              }}>
                                {child.article_count} 篇
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeleteCategory(child.id, child.name)}
                              style={{
                                color: '#dc2626',
                                fontSize: '0.75rem',
                                padding: '0.1rem 0.4rem'
                              }}
                            >
                              刪除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右側：建立新分類表單 (限 Super Admin / Editor) */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)',
            height: 'fit-content'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              ➕ 新增分類
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              限制權限：僅超級管理員與總編輯可建立。
            </p>

            <form onSubmit={handleCreateCategory} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  分類名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={e => {
                    setNewCatName(e.target.value);
                    if (!newCatSlug) {
                      setNewCatSlug(e.target.value.toLowerCase().replace(/[\s_]+/g, '-'));
                    }
                  }}
                  placeholder="例如：雲端運算 (Cloud)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  URL Slug (唯一英數字識別) *
                </label>
                <input
                  type="text"
                  required
                  value={newCatSlug}
                  onChange={e => setNewCatSlug(e.target.value)}
                  placeholder="例如：cloud-computing"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  父分類層級 (選填)
                </label>
                <select
                  value={newCatParentId}
                  onChange={e => setNewCatParentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem'
                  }}
                >
                  <option value="">-- 作為最頂層主分類 (Top-Level) --</option>
                  {categoriesTree.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      隸屬於主分類：{parent.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  * 系統嚴格限制為兩層級架構，無法選取子分類作為父層。
                </span>
              </div>

              <button
                type="submit"
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'var(--primary-gradient)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                建立分類 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: 標籤雲管理 */}
      {activeTab === 'tags' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
          {/* 左側：標籤雲列表 */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                標籤列表與使用計數
              </h3>
              <input
                type="text"
                value={tagKeyword}
                onChange={e => {
                  setTagKeyword(e.target.value);
                  fetchTags(e.target.value);
                }}
                placeholder="🔍 搜尋標籤..."
                style={{
                  padding: '0.45rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
              {tagsList.map(t => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--bg-tag)',
                    border: '1px solid var(--border)',
                    borderRadius: '9999px',
                    padding: '0.45rem 1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    #{t.name}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'var(--warm-peach)',
                    color: 'var(--warm-terracotta)',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '9999px',
                    fontWeight: 700
                  }}>
                    {t.usage_count}
                  </span>
                  <button
                    onClick={() => handleDeleteTag(t.id, t.name)}
                    style={{
                      color: '#9ca3af',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: 0
                    }}
                    onMouseEnter={e => e.target.style.color = '#ef4444'}
                    onMouseLeave={e => e.target.style.color = '#9ca3af'}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 右側：新增標籤 */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)',
            height: 'fit-content'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              ➕ 新增標籤
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              作者、總編輯與超級管理員皆可自由建立文章標籤。
            </p>

            <form onSubmit={handleCreateTag} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  標籤名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="例如：GraphRAG"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'var(--primary-gradient)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              >
                建立標籤 🏷️
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: RBAC 權限即時驗證器 */}
      {activeTab === 'rbac' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
          {/* 左側：當前使用者權限資訊 */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-main)' }}>
              當前登入者權限快照 (Auth Context)
            </h3>

            <div style={{ display: 'grid', gap: '0.8rem', fontSize: '0.92rem', color: 'var(--text-main)' }}>
              <div><strong>帳號 Email：</strong>{currentUser?.email}</div>
              <div><strong>姓名稱謂：</strong>{currentUser?.name}</div>
              <div>
                <strong>指派角色：</strong>
                <span style={{
                  background: roleColors[currentUser?.role]?.bg,
                  color: roleColors[currentUser?.role]?.text,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  marginLeft: '0.4rem'
                }}>
                  {currentUser?.role}
                </span>
              </div>
              <div>
                <strong>核准權限標籤清單：</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {currentUser?.permissions?.map(p => (
                    <span key={p} style={{
                      background: 'var(--bg-tag)',
                      border: '1px solid var(--border)',
                      fontSize: '0.78rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              💡 <strong>RBAC 設計說明：</strong><br />
              • <code>super_admin</code>：唯一能讀取全站會員與管理員清單。<br />
              • <code>editor</code>：可操作分類、全站文章發布。<br />
              • <code>author</code>：僅能存取自身稿件，無法建立分類或列出使用者。<br />
              • <code>proofreader</code>：僅具備審核標記權限。
            </div>
          </div>

          {/* 右側：權限測試按鈕區 */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              🛡️ RBAC 權限防護現場測試
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              點擊下列按鈕，後端 FastAPI 會根據您的 JWT 角色自動核對並觸發放行 (200) 或攔截 (403 Forbidden)：
            </p>

            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* 測試 1 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tag)', padding: '0.9rem 1.2rem', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>1. 存取全站使用者名單</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    GET /api/v1/admin/users (限 super_admin)
                  </div>
                </div>
                <button
                  onClick={() => testProtectedEndpoint('/admin/users', ['super_admin'], '查詢全站使用者列表')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.82rem'
                  }}
                >
                  發送測試請求
                </button>
              </div>

              {/* 測試 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tag)', padding: '0.9rem 1.2rem', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>2. 呼叫分類管理功能</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    POST /api/v1/categories (限 super_admin, editor)
                  </div>
                </div>
                <button
                  onClick={() => testProtectedEndpoint('/categories', ['super_admin', 'editor'], '建立新分類操作')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.82rem'
                  }}
                >
                  發送測試請求
                </button>
              </div>
            </div>

            {/* 即時測試回傳結果展示 */}
            {testResult && (
              <div style={{
                background: testResult.ok ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResult.ok ? '#86efac' : '#fca5a5'}`,
                borderRadius: '12px',
                padding: '1.2rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: testResult.ok ? '#166534' : '#991b1b', fontSize: '0.95rem' }}>
                    {testResult.ok ? '✔ 驗證成功 (200 OK / 授權放行)' : `✖ 攔截成功 (${testResult.status} Forbidden / 權限不足)`}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    測試端點：{testResult.name}
                  </span>
                </div>
                <pre style={{
                  background: '#18181b',
                  color: '#fafafa',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  margin: 0
                }}>
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: 系統概況 */}
      {activeTab === 'system' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-main)' }}>
            📊 CMS 後端服務與 SQLite 資料庫即時連線概況
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{ background: 'var(--bg-tag)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>後端運行狀態</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 850, color: '#16a34a', marginTop: '0.2rem' }}>
                ● {systemSummary?.status?.toUpperCase() || 'ONLINE'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tag)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>底層資料庫實體</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {systemSummary?.database || 'SQLite (cms.db)'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tag)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>全站使用者總數 (4 角色)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 850, color: 'var(--primary)', marginTop: '0.2rem' }}>
                {systemSummary?.users || 4}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tag)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>分類數 / 標籤數</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 850, color: 'var(--warm-amber)', marginTop: '0.2rem' }}>
                {systemSummary?.categories || 0} / {systemSummary?.tags || 0}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tag)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>媒體庫資產 / 資料夾 (Phase 2)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 850, color: '#10b981', marginTop: '0.2rem' }}>
                {systemSummary?.media_assets || 0} / {systemSummary?.media_folders || 0}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-tag)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-main)' }}>
              🔗 快速 API 文件與連線資訊
            </h4>
            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
              <li>• <strong>後端 FastAPI 服務位址：</strong><a href="http://127.0.0.1:8000" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>http://127.0.0.1:8000</a></li>
              <li>• <strong>互動式 Swagger API 文件 (OpenAPI)：</strong><a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>http://127.0.0.1:8000/docs</a></li>
              <li>• <strong>ReDoc 規格文件：</strong><a href="http://127.0.0.1:8000/redoc" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>http://127.0.0.1:8000/redoc</a></li>
              <li>• <strong>資料庫位置：</strong><code>practice/backend/cms.db</code></li>
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
