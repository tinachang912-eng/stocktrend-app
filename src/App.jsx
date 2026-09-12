import React, { useState, useEffect } from 'react';
import { articles } from './data/articles';
import ArticleDetail from './components/ArticleDetail';
import CmsPhase1 from './components/CmsPhase1';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('portfolio-theme') || 'light';
  });
  const [viewMode, setViewMode] = useState('portfolio'); // 'portfolio' | 'cms'
  const [activeProjectTab, setActiveProjectTab] = useState('all');
  const [activeArticleTab, setActiveArticleTab] = useState('all');
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // 主題切換監聽與持久化
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('portfolio-theme', theme);
  }, [theme]);

  // 當切換文章時滾動至頂部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedArticleId]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const skills = {
    frontend: [
      { name: 'React', level: '熟練' },
      { name: 'Next.js', level: '熟練' },
      { name: 'TypeScript', level: '常用' },
      { name: 'Tailwind CSS', level: '熟練' },
      { name: 'JavaScript (ES6+)', level: '精通' },
      { name: 'Redux / Zustand', level: '常用' }
    ],
    backend: [
      { name: 'Node.js', level: '熟練' },
      { name: 'Python (FastAPI)', level: '常用' },
      { name: 'PostgreSQL', level: '熟練' },
      { name: 'Redis', level: '常用' },
      { name: 'RESTful API / GraphQL', level: '熟練' }
    ],
    ai_cloud: [
      { name: 'LangChain & RAG', level: '深入研究' },
      { name: 'OpenAI / Claude API', level: '整合經驗' },
      { name: 'Docker 容器化', level: '日常使用' },
      { name: 'AWS 雲端部署', level: '基礎建設' },
      { name: 'Git & CI/CD', level: '敏捷開發' }
    ]
  };

  const projects = [
    {
      id: 1,
      category: 'ai',
      title: 'AI 智慧企業知識庫 (RAG 系統)',
      desc: '基於 LangChain 與向量資料庫建立的企業私有文檔檢索增強系統，提供秒級高精準度問答與來源追溯。',
      tags: ['React', 'FastAPI', 'LangChain', 'OpenAI API', 'ChromaDB'],
      icon: '💡',
      stars: '4.9 ★'
    },
    {
      id: 2,
      category: 'fullstack',
      title: '即時多團隊協同看板平台',
      desc: '高互動拖拽式任務看板，支援 WebSocket 多人即時同步編輯、自動化工時提醒與視覺化統計報表。',
      tags: ['React', 'TypeScript', 'Node.js', 'Socket.io', 'PostgreSQL'],
      icon: '📋',
      stars: '4.8 ★'
    },
    {
      id: 3,
      category: 'frontend',
      title: 'FinTech 智能財務分析儀表板',
      desc: '高負載財務數據視覺化應用，整合動態走勢圖表、資產配置建議與客製化報表匯出功能。',
      tags: ['Next.js', 'Tailwind CSS', 'Recharts', 'Zustand'],
      icon: '📈',
      stars: '5.0 ★'
    },
    {
      id: 4,
      category: 'ai',
      title: '多語系 AI 程式代碼審查助手',
      desc: '結合 GitHub Webhook 的自動化程式碼 Review 工具，針對安全性漏洞與效能瓶頸提供溫和易讀的修正建議。',
      tags: ['React', 'Python', 'Claude 3.5 API', 'Docker'],
      icon: '🔍',
      stars: '4.9 ★'
    }
  ];

  const experiences = [
    {
      period: '2023 - 至今',
      role: '資深全端工程師 (Senior Full-Stack Engineer)',
      company: 'TechNova 創峰科技',
      desc: '主導企業級 AI 應用平台之前端架構重組，縮短載入時間 45%，並負責多智能體系統與直覺化介面的落地打磨。'
    },
    {
      period: '2021 - 2023',
      role: '前端工程師 (Frontend Engineer)',
      company: 'CloudSoft 數智軟體',
      desc: '負責 SaaS 產品核心元件模組開發，與設計師及後端團隊緊密合作，維護超過 10 萬日活躍用戶的商業系統。'
    },
    {
      period: '2019 - 2021',
      role: 'Web 軟體工程師 (Junior Web Developer)',
      company: 'InnoLab 創新實驗室',
      desc: '參與電商與企業形象網站開發，建立共用溫暖風格 UI 元件庫，提昇團隊 30% 開發效率。'
    }
  ];

  const filteredProjects = activeProjectTab === 'all' 
    ? projects 
    : projects.filter(p => p.category === activeProjectTab);

  const filteredArticles = activeArticleTab === 'all'
    ? articles
    : articles.filter(a => a.category === activeArticleTab);

  const currentArticle = articles.find(a => a.id === selectedArticleId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setFormSubmitted(true);
    setTimeout(() => {
      setFormData({ name: '', email: '', message: '' });
      setFormSubmitted(false);
    }, 4000);
  };

  const handleNavClick = (anchor) => {
    if (selectedArticleId) {
      setSelectedArticleId(null);
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 1.5rem' }}>
      
      {/* 頂部導覽列 */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.2rem 0',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--navbar-bg)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
        transition: 'background-color 0.3s, border-color 0.3s'
      }}>
        <div 
          onClick={() => setSelectedArticleId(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--primary-gradient)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 850,
            fontSize: '1.15rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            AC
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Alex Chen</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>全端工程師 & AI 開發</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '1.6rem', alignItems: 'center' }}>
          <a 
            href="#about" 
            onClick={() => handleNavClick('about')}
            style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 500 }}
          >
            關於我
          </a>
          <a 
            href="#articles" 
            onClick={() => handleNavClick('articles')}
            style={{ 
              fontSize: '0.92rem', 
              color: selectedArticleId ? 'var(--primary)' : 'var(--text-muted)', 
              fontWeight: 600 
            }}
          >
            ✍️ AI 文章專欄
          </a>
          <a 
            href="#projects" 
            onClick={() => handleNavClick('projects')}
            style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 500 }}
          >
            作品集
          </a>
          <a 
            href="#skills" 
            onClick={() => handleNavClick('skills')}
            style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 500 }}
          >
            專業技能
          </a>
          
          {/* 主題切換按鈕 (Dark / Light Mode Toggle) */}
          <button
            onClick={toggleTheme}
            aria-label="切換主題色彩"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              background: 'var(--bg-tag)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.25s ease'
            }}
          >
            {theme === 'light' ? (
              <>
                <span style={{ fontSize: '1.05rem' }}>🌙</span>
                <span>深色</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.05rem' }}>☀️</span>
                <span>亮色</span>
              </>
            )}
          </button>

          {/* CMS 後台管理入口 (Phase 1) */}
          <button
            onClick={() => setViewMode(prev => prev === 'cms' ? 'portfolio' : 'cms')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              background: viewMode === 'cms' ? 'var(--primary)' : 'var(--bg-tag)',
              color: viewMode === 'cms' ? '#ffffff' : 'var(--text-main)',
              border: '1px solid var(--border)',
              fontWeight: 700,
              fontSize: '0.84rem',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
          >
            {viewMode === 'cms' ? '🌿 返回作品集' : '⚙️ CMS 後台 (Phase 1 & 2)'}
          </button>

          <a 
            href="#contact" 
            onClick={() => handleNavClick('contact')}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '9999px',
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: '0 4px 14px rgba(224, 86, 56, 0.3)'
            }}
          >
            與我聯繫 ☕
          </a>
        </nav>
      </header>

      {/* 判斷畫面：CMS 後台 (Phase 1) 或 文章頁面 / 個人網站首頁 */}
      {viewMode === 'cms' ? (
        <CmsPhase1 onBackToPortfolio={() => setViewMode('portfolio')} />
      ) : selectedArticleId && currentArticle ? (
        <ArticleDetail 
          article={currentArticle} 
          onBack={() => setSelectedArticleId(null)}
          onSelectArticle={(id) => setSelectedArticleId(id)}
          allArticles={articles}
        />
      ) : (
        <>
          {/* Hero 個人介紹主視覺 */}
          <section id="about" style={{ padding: '5rem 0 4rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: '3.5rem',
              alignItems: 'center'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  background: 'var(--warm-peach)',
                  border: '1px solid var(--border)',
                  padding: '0.4rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  color: 'var(--warm-terracotta)',
                  fontWeight: 600,
                  marginBottom: '1.5rem'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    boxShadow: '0 0 8px var(--primary)'
                  }} />
                  目前開放合作與自由接案 (Open for Opportunities)
                </div>

                <h1 style={{
                  fontSize: '3.1rem',
                  fontWeight: 850,
                  lineHeight: 1.2,
                  marginBottom: '1.4rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)'
                }}>
                  你好，我是 <span style={{
                    background: 'var(--primary-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>陳子揚 (Alex)</span> 🌿
                </h1>

                <p style={{
                  fontSize: '1.15rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.8,
                  marginBottom: '2.2rem'
                }}>
                  我是一名熱愛生活與技術的<strong>資深全端工程師</strong>，擅長透過 React 打造溫暖、友善且易於使用的產品介面，並專注將<strong>生成式 AI (LLM / RAG / 智能代理)</strong> 轉化為能切實解決問題的日常工具。
                  下方整理了我近期關於 <strong>RAG、Prompt 工程、Vibe Coding 與 RPA</strong> 的深度技術思考。
                </p>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <a 
                    href="#articles" 
                    style={{
                      padding: '0.8rem 1.8rem',
                      borderRadius: '12px',
                      background: 'var(--primary-gradient)',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      boxShadow: '0 6px 18px rgba(224, 86, 56, 0.28)'
                    }}
                  >
                    閱讀 AI 文章專欄 ↓
                  </a>
                  <a 
                    href="#projects" 
                    style={{
                      padding: '0.8rem 1.6rem',
                      borderRadius: '12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    瀏覽精選專案
                  </a>
                </div>
              </div>

              {/* 個人名片卡 */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '2.5rem',
                boxShadow: 'var(--shadow-md)',
                transition: 'background-color 0.3s, border-color 0.3s'
              }}>
                <div style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '22px',
                  background: 'var(--bg-tag)',
                  border: '2px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  🧑‍💻
                </div>
                
                <h3 style={{ fontSize: '1.4rem', marginBottom: '0.3rem', color: 'var(--text-main)', fontWeight: 800 }}>
                  陳子揚 / Alex Chen
                </h3>
                <p style={{ color: 'var(--warm-terracotta)', fontSize: '0.92rem', marginBottom: '1.6rem', fontWeight: 600 }}>
                  Full-Stack & AI Solutions Developer
                </p>

                <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span>📍 常駐地點</span>
                    <strong style={{ color: 'var(--text-main)' }}>台灣・台北 (支援遠端)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span>💼 累計經驗</span>
                    <strong style={{ color: 'var(--text-main)' }}>5+ 年全端產品開發</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span>✍️ 原創文章</span>
                    <strong style={{ color: 'var(--text-main)' }}>6 篇 AI 前沿實戰深度解析</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
                    <span>🌿 理念</span>
                    <strong style={{ color: 'var(--text-main)' }}>結合極致技術與人文溫度</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 文章列表區塊 Articles Section */}
          <section id="articles" style={{ padding: '4.5rem 0 5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: '2.8rem',
              flexWrap: 'wrap',
              gap: '1.2rem'
            }}>
              <div>
                <span style={{ color: 'var(--warm-terracotta)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>
                  AI INSIGHTS & ESSAYS
                </span>
                <h2 style={{ fontSize: '2.3rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-main)' }}>
                  AI 探索專欄與技術文章
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem' }}>
                  涵蓋 RAG 知識庫、Prompt 工程、Vibe Coding 心流與 Agentic RPA 實務思考
                </p>
              </div>

              {/* 文章分類切換按鈕 */}
              <div style={{
                display: 'flex',
                background: 'var(--bg-card)',
                padding: '0.35rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                gap: '0.3rem',
                boxShadow: 'var(--shadow-sm)',
                flexWrap: 'wrap'
              }}>
                {[
                  { id: 'all', label: '全部文章 (6)' },
                  { id: 'rag', label: 'RAG' },
                  { id: 'prompt', label: 'Prompt' },
                  { id: 'vibe-coding', label: 'Vibe Coding' },
                  { id: 'rpa', label: 'RPA & 自動化' },
                  { id: 'agent', label: 'Multi-Agent' },
                  { id: 'slm', label: 'SLM 邊緣' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveArticleTab(tab.id)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: activeArticleTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                      backgroundColor: activeArticleTab === tab.id ? 'var(--primary)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文章列表網格 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2rem'
            }}>
              {filteredArticles.map(article => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticleId(article.id)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '2.2rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.borderColor = 'var(--border-highlight)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div>
                    {/* 文章小標頭 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem'
                    }}>
                      <span style={{
                        background: 'var(--warm-peach)',
                        color: 'var(--warm-terracotta)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        border: '1px solid var(--border)'
                      }}>
                        {article.categoryLabel}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ⏱️ {article.readTime}
                      </span>
                    </div>

                    {/* 文章標題 */}
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: 'var(--text-main)',
                      lineHeight: 1.4,
                      marginBottom: '0.85rem'
                    }}>
                      <span style={{ marginRight: '0.4rem' }}>{article.coverIcon}</span>
                      {article.title}
                    </h3>

                    {/* 文章摘要 */}
                    <p style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      marginBottom: '1.5rem'
                    }}>
                      {article.excerpt}
                    </p>
                  </div>

                  <div>
                    {/* 標籤 */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      marginBottom: '1.4rem'
                    }}>
                      {article.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          style={{
                            background: 'var(--bg-tag)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px'
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* 閱讀全文行動條 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '1rem'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📅 {article.date}</span>
                      <span style={{
                        color: 'var(--primary)',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}>
                        閱讀全文 →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 精選作品集 Section */}
          <section id="projects" style={{ padding: '4rem 0' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: '2.8rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <span style={{ color: 'var(--warm-terracotta)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>PORTFOLIO</span>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-main)' }}>精選專案展示</h2>
              </div>

              {/* 專案切換按鈕 */}
              <div style={{
                display: 'flex',
                background: 'var(--bg-card)',
                padding: '0.35rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {[
                  { id: 'all', label: '全部專案' },
                  { id: 'ai', label: 'AI 應用' },
                  { id: 'fullstack', label: '全端系統' },
                  { id: 'frontend', label: '介面設計' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveProjectTab(tab.id)}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: activeProjectTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                      backgroundColor: activeProjectTab === tab.id ? 'var(--primary)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '2rem' }}>
              {filteredProjects.map(project => (
                <div 
                  key={project.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '2.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                      <span style={{ fontSize: '2.2rem' }}>{project.icon}</span>
                      <span style={{
                        fontSize: '0.82rem',
                        color: 'var(--warm-terracotta)',
                        background: 'var(--warm-peach)',
                        border: '1px solid var(--border)',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '9999px'
                      }}>
                        {project.stars}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {project.title}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.93rem', lineHeight: 1.65, marginBottom: '1.6rem' }}>
                      {project.desc}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.4rem' }}>
                      {project.tags.map(t => (
                        <span 
                          key={t} 
                          style={{
                            background: 'var(--bg-tag)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            fontSize: '0.78rem',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '6px',
                            fontWeight: 500
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <button 
                      onClick={() => alert(`正在開啟「${project.title}」專案架構！`)}
                      style={{
                        color: 'var(--primary)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      探索專案細節 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 技能專長 Section */}
          <section id="skills" style={{ padding: '4rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span style={{ color: 'var(--warm-terracotta)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>EXPERTISE</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-main)' }}>
                核心技能與技術版圖
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '2.2rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🎨</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', color: 'var(--warm-terracotta)', fontWeight: 700 }}>
                  前端體驗工程 (Frontend)
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {skills.frontend.map(s => (
                    <span 
                      key={s.name} 
                      style={{
                        background: 'var(--warm-peach)',
                        color: 'var(--warm-terracotta)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        fontWeight: 500
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '2.2rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>⚙️</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', color: 'var(--warm-amber)', fontWeight: 700 }}>
                  後端與數據架構 (Backend)
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {skills.backend.map(s => (
                    <span 
                      key={s.name} 
                      style={{
                        background: 'var(--bg-tag)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        fontWeight: 500
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '2.2rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🧠</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', color: 'var(--primary)', fontWeight: 700 }}>
                  生成式 AI 與運維 (AI & Cloud)
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {skills.ai_cloud.map(s => (
                    <span 
                      key={s.name} 
                      style={{
                        background: 'var(--warm-peach)',
                        color: 'var(--primary)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        fontWeight: 500
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 工作經歷 Section */}
          <section id="experience" style={{ padding: '4rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <span style={{ color: 'var(--warm-terracotta)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>MILESTONES</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-main)' }}>
                工作歷程與成長軌跡
              </h2>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gap: '1.8rem' }}>
              {experiences.map((exp, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '170px 1fr',
                    gap: '2rem',
                    background: 'var(--bg-card)',
                    padding: '2rem 2.2rem',
                    borderRadius: '18px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem' }}>{exp.period}</span>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>{exp.company}</div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{exp.role}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.65 }}>{exp.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 聯絡與諮詢 Section */}
          <section id="contact" style={{ padding: '4rem 0 6rem' }}>
            <div style={{
              background: 'linear-gradient(145deg, var(--bg-card), var(--bg-card-subtle))',
              border: '1px solid var(--border-highlight)',
              borderRadius: '24px',
              padding: '3.5rem 3rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1.25fr',
              gap: '3.5rem',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div>
                <span style={{ color: 'var(--warm-terracotta)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>GET IN TOUCH</span>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 850, marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                  歡迎交流與合作！
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2.2rem', lineHeight: 1.8 }}>
                  無論是有新專案想要討論、希望尋求技術顧問諮詢，或是單純想聊聊前端與 AI 的發展，都非常歡迎隨時來信。
                </p>

                <div style={{ display: 'grid', gap: '1.2rem', fontSize: '0.95rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '1.3rem' }}>📮</span>
                    <span>alex.chen.dev@example.com</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '1.3rem' }}>☕</span>
                    <span>台北市大安區 / 遠端協作</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '1.3rem' }}>🐙</span>
                    <span>github.com/alexchen-dev</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.2rem' }}>
                {formSubmitted && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    padding: '1rem',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}>
                    ✓ 感謝您的來信！訊息已順利送達，我會在 24 小時內與您聯繫。
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    您的姓名 / 稱呼 *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="例如：林專案經理 / David"
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    電子郵件地址 *
                  </label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="david@company.com"
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    想聊聊的內容或需求
                  </label>
                  <textarea 
                    rows="4"
                    value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                    placeholder="請簡述您的專案背景、預期目標，或是任何想交流的想法..."
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>

                <button 
                  type="submit"
                  style={{
                    padding: '0.9rem',
                    borderRadius: '10px',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(224, 86, 56, 0.35)',
                    transition: 'opacity 0.2s'
                  }}
                >
                  傳送訊息 💌
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      {/* 頁尾 Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '2.5rem 0',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.88rem',
        transition: 'border-color 0.3s'
      }}>
        © 2026 Alex Chen. Designed with Warmth, Built with React & Vite. All rights reserved.
      </footer>

    </div>
  );
}
