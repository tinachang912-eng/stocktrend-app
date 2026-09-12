import React, { useEffect, useState } from 'react';

export default function ArticleDetail({ article, onBack, onSelectArticle, allArticles }) {
  const [claps, setClaps] = useState(18);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [article.id]);

  const currentIndex = allArticles.findIndex(a => a.id === article.id);
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  // 智慧關聯推薦演算法：根據相同分類與標籤匹配度排序
  const relatedArticles = allArticles
    .filter(a => a.id !== article.id)
    .map(a => {
      let score = 0;
      if (a.category === article.category) score += 3;
      const sharedTags = a.tags.filter(t => article.tags.includes(t));
      score += sharedTags.length;
      return { ...a, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 簡易將 markdown 轉譯為具備溫暖質感的 JSX
  const renderFormattedContent = (content) => {
    const lines = content.trim().split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 處理程式碼區塊
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLang = line.trim().replace('```', '') || 'text';
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <div key={`code-${i}`} style={{
              margin: '1.8rem 0',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#1d1816',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{
                background: '#151110',
                padding: '0.55rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #2e2622',
                fontSize: '0.78rem',
                color: '#d4c5b9',
                fontFamily: 'monospace'
              }}>
                <span>{codeLang.toUpperCase()}</span>
                <span>📋 Code Example</span>
              </div>
              <pre style={{
                padding: '1.2rem',
                margin: 0,
                color: '#fbeee2',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                overflowX: 'auto'
              }}>
                {codeBuffer.join('\n')}
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // 處理 H3 標題
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            margin: '2.4rem 0 1rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--border-highlight)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {line.replace('### ', '')}
          </h3>
        );
        continue;
      }

      // 處理 H4 標題
      if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={i} style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--warm-terracotta)',
            margin: '1.8rem 0 0.6rem'
          }}>
            {line.replace('#### ', '')}
          </h4>
        );
        continue;
      }

      // 處理 Alert 提醒框
      if (line.startsWith('> [!IMPORTANT]') || line.startsWith('> ')) {
        const quoteText = line.replace('> [!IMPORTANT]', '').replace('> ', '').trim();
        elements.push(
          <div key={i} style={{
            background: 'var(--warm-peach)',
            borderLeft: '4px solid var(--primary)',
            padding: '1.1rem 1.4rem',
            borderRadius: '0 10px 10px 0',
            margin: '1.6rem 0',
            color: 'var(--text-main)',
            fontSize: '0.95rem',
            lineHeight: 1.7,
            fontStyle: 'italic',
            border: '1px solid var(--border)',
            borderLeftWidth: '4px'
          }}>
            💡 {quoteText.replace(/\*\*(.*?)\*\*/g, '$1')}
          </div>
        );
        continue;
      }

      // 處理列表
      if (line.trim().startsWith('- ') || line.trim().startsWith('1. ') || line.trim().startsWith('2. ') || line.trim().startsWith('3. ')) {
        elements.push(
          <div key={i} style={{
            paddingLeft: '1.2rem',
            margin: '0.5rem 0',
            color: 'var(--text-main)',
            fontSize: '1rem',
            lineHeight: 1.7,
            position: 'relative'
          }}>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginRight: '0.5rem' }}>•</span>
            <span dangerouslySetInnerHTML={{
              __html: line.replace(/^[-*]\s+|\d+\.\s+/, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main);">$1</strong>')
            }} />
          </div>
        );
        continue;
      }

      // 處理分隔線
      if (line.trim() === '---') {
        elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '2rem 0' }} />);
        continue;
      }

      // 空白行
      if (!line.trim()) {
        continue;
      }

      // 一般段落
      elements.push(
        <p key={i} style={{
          fontSize: '1.05rem',
          color: 'var(--text-main)',
          lineHeight: 1.85,
          margin: '1rem 0'
        }} dangerouslySetInnerHTML={{
          __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>')
        }} />
      );
    }

    return elements;
  };

  return (
    <article style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 0 6rem' }}>
      {/* 頂部導航 & 返回按鈕 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-main)',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s'
          }}
        >
          ← 返回首頁文章列表
        </button>

        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button
            onClick={() => setClaps(claps + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: 'var(--warm-peach)',
              border: '1px solid var(--border-highlight)',
              color: 'var(--warm-terracotta)',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            👏 拍手 ({claps})
          </button>
          <button
            onClick={handleCopyLink}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}
          >
            {copied ? '✓ 已複製連結' : '🔗 分享'}
          </button>
        </div>
      </div>

      {/* 文章主體卡片 */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        padding: '3.5rem 3rem',
        boxShadow: 'var(--shadow-md)',
        transition: 'background-color 0.3s, border-color 0.3s'
      }}>
        {/* 分類與時間中繼資料 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          marginBottom: '1.2rem',
          flexWrap: 'wrap'
        }}>
          <span style={{
            background: 'var(--warm-peach)',
            color: 'var(--warm-terracotta)',
            border: '1px solid var(--border)',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            {article.categoryLabel}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📅 {article.date}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏱️ 預估閱讀 {article.readTime}</span>
        </div>

        {/* 標題 */}
        <h1 style={{
          fontSize: '2.4rem',
          fontWeight: 850,
          color: 'var(--text-main)',
          lineHeight: 1.3,
          marginBottom: '1.5rem',
          letterSpacing: '-0.02em'
        }}>
          {article.title}
        </h1>

        {/* 作者介紹條 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem',
          padding: '1rem 0 1.8rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '2.2rem'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'var(--bg-tag)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🧑‍💻
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Alex Chen (陳子揚)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>全端工程師 & AI 應用架構師 • 深入探索工程邊界</div>
          </div>
        </div>

        {/* 摘要重點框 */}
        <div style={{
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '1.4rem 1.6rem',
          marginBottom: '2.5rem'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--warm-terracotta)', marginBottom: '0.4rem' }}>
            📌 核心摘要 (Key Takeaway)
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
            {article.excerpt}
          </p>
        </div>

        {/* 內文正文渲染 */}
        <div className="article-body">
          {renderFormattedContent(article.content)}
        </div>

        {/* 文章標籤 */}
        <div style={{
          marginTop: '3.5rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>文章主題標籤：</span>
          {article.tags.map(tag => (
            <span
              key={tag}
              style={{
                background: 'var(--bg-tag)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                fontSize: '0.82rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontWeight: 500
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* 🌟 相關文章推薦專區 (Related Articles) */}
      <div style={{ marginTop: '4rem' }}>
        <div style={{ marginBottom: '1.8rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--warm-terracotta)',
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            RECOMMENDED READING
          </div>
          <h3 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginTop: '0.3rem'
          }}>
            📚 延伸閱讀與相關文章
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            根據您正在閱讀的主題，為您推薦相關聯的 AI 深度技術探討：
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          {relatedArticles.map(rel => (
            <div
              key={rel.id}
              onClick={() => onSelectArticle(rel.id)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '18px',
                padding: '1.6rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
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
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.8rem'
                }}>
                  <span style={{
                    background: 'var(--warm-peach)',
                    color: 'var(--warm-terracotta)',
                    border: '1px solid var(--border)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px'
                  }}>
                    {rel.categoryLabel}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ⏱️ {rel.readTime}
                  </span>
                </div>

                <h4 style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  lineHeight: 1.45,
                  marginBottom: '0.6rem'
                }}>
                  <span style={{ marginRight: '0.35rem' }}>{rel.coverIcon}</span>
                  {rel.title}
                </h4>

                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: '1rem'
                }}>
                  {rel.excerpt}
                </p>
              </div>

              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rel.date}</span>
                <span style={{
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}>
                  立即閱讀 →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部前後篇文章導航 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        marginTop: '2.5rem'
      }}>
        {prevArticle ? (
          <div
            onClick={() => onSelectArticle(prevArticle.id)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.4rem 1.6rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.2s'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>← 上一篇文章</span>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.3rem', color: 'var(--text-main)' }}>
              {prevArticle.title}
            </h4>
          </div>
        ) : <div />}

        {nextArticle && (
          <div
            onClick={() => onSelectArticle(nextArticle.id)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.4rem 1.6rem',
              cursor: 'pointer',
              textAlign: 'right',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.2s'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>下一篇文章 →</span>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.3rem', color: 'var(--text-main)' }}>
              {nextArticle.title}
            </h4>
          </div>
        )}
      </div>

      {/* 底部回到列表呼籲 */}
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.85rem 2.2rem',
            borderRadius: '12px',
            background: 'var(--primary-gradient)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.95rem',
            boxShadow: '0 4px 15px rgba(224, 86, 56, 0.3)'
          }}
        >
          瀏覽更多 AI 技術文章與心得
        </button>
      </div>
    </article>
  );
}
