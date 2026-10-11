/**
 * 台股趨勢分析小幫手 - 官方行情連線版 (app.js)
 * 100% 串接證交所 (TWSE) 與櫃買中心 (TPEx) 官方行情資料
 * 支援雙模架構：本地 Python 後端 API + GitHub Pages / 行動裝置無伺服器官方資料集
 */

const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000/api';
const STATIC_DATA_BASE_URL = './data';
const STORAGE_WATCHLIST_KEY = 'TW_STOCK_OFFICIAL_WATCHLIST_V3';

// 預設觀察股票代碼 (字串，嚴格保留前導 0)
const DEFAULT_SYMBOLS = ['2330', '2308', '2454'];

// 應用程式狀態管理
const AppState = {
  watchlist: [...DEFAULT_SYMBOLS],
  selectedSymbol: '2330',
  quotesMap: {},
  historyMap: {},
  marketCalendar: null,
  chartInstance: null,
  chipChartInstance: null,
  chartViewMode: 'both', // 'both' | 'price' | 'chip'
  isHistoryTableOpen: false,
  dataSourceMode: 'checking' // 'backend' | 'static' | 'offline'
};

// 工具函式：格式化金額
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) {
    return '無有效收盤價';
  }
  return Number(val).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatInt(val) {
  if (val === null || val === undefined || isNaN(val)) return '--';
  return Math.round(Number(val)).toLocaleString('zh-TW');
}

function formatLots(val, withSign = true) {
  if (val === null || val === undefined || isNaN(val)) return '--';
  const num = Math.round(Number(val));
  const formatted = Math.abs(num).toLocaleString('zh-TW');
  if (!withSign) return formatted;
  if (num > 0) return `+${formatted}`;
  if (num < 0) return `-${formatted}`;
  return '0';
}

// 帶超時的 fetch 封裝
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ==========================================================================
// 智慧雙模資料讀取（優先檢測本機後端，若在 GitHub Pages 或手機則無縫切換靜態官方集）
// ==========================================================================

// 1. 取得市場日曆
async function loadMarketCalendar() {
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // 若為本地環境，優先嘗試本地後端
  if (isLocalhost) {
    try {
      const res = await fetchWithTimeout(`${LOCAL_API_BASE_URL}/market/calendar`, {}, 2500);
      if (res.ok) {
        const data = await res.json();
        AppState.marketCalendar = data;
        AppState.dataSourceMode = 'backend';
        updateConnectionStatusUI(true, '本地後端 API 已連線');
        return data;
      }
    } catch (e) {
      console.log('[Mode] 本地後端未連線，切換為官方靜態資料集模式');
    }
  }

  // 嘗試讀取官方靜態日曆 (GitHub Pages / 手機行動端主要模式)
  try {
    const res = await fetchWithTimeout(`${STATIC_DATA_BASE_URL}/calendar.json`, {}, 4000);
    if (res.ok) {
      const data = await res.json();
      AppState.marketCalendar = data;
      AppState.dataSourceMode = 'static';
      updateConnectionStatusUI(true, '官方行情同步版 (GitHub Pages)');
      return data;
    }
  } catch (err) {
    console.warn('[Mode] 靜態日曆載入失敗:', err);
  }

  AppState.dataSourceMode = 'offline';
  updateConnectionStatusUI(false, '離線模式');
  return null;
}

// 2. 取得多檔行情
async function loadQuotesForWatchlist(symbols) {
  // A. 若在本地後端模式
  if (AppState.dataSourceMode === 'backend') {
    try {
      const symParam = symbols.join(',');
      const res = await fetchWithTimeout(`${LOCAL_API_BASE_URL}/stocks/batch?symbols=${encodeURIComponent(symParam)}`, {}, 6000);
      if (res.ok) {
        const result = await res.json();
        if (result && Array.isArray(result.data)) {
          result.data.forEach(q => {
            AppState.quotesMap[q.symbol] = q;
          });
          return result.data;
        }
      }
    } catch (e) {
      console.warn('[Quotes] 本地 API 批次失敗，降級使用靜態資料集');
    }
  }

  // B. 靜態資料集模式 (GitHub Pages / 手機)
  try {
    const res = await fetchWithTimeout(`${STATIC_DATA_BASE_URL}/quotes.json`, {}, 5000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.quotes) {
        symbols.forEach(sym => {
          // 1. 精確代碼匹配 (如 "2303")
          if (data.quotes[sym]) {
            AppState.quotesMap[sym] = data.quotes[sym];
          } else {
            // 2. 名稱反查 (如 "聯電", "鴻海")
            for (const item of Object.values(data.quotes)) {
              if (item.name === sym || (sym.length >= 2 && item.name && item.name.includes(sym))) {
                AppState.quotesMap[sym] = item;
                AppState.quotesMap[item.symbol] = item;
                break;
              }
            }
          }
        });
        return Object.values(AppState.quotesMap);
      }
    }
  } catch (err) {
    console.warn('[Quotes] 讀取靜態 quotes.json 失敗:', err);
  }

  return [];
}

// 3. 取得 30 天真實歷史行情
async function loadStockHistory(symbol) {
  if (AppState.historyMap[symbol]) {
    return AppState.historyMap[symbol];
  }

  // A. 本地 API 模式
  if (AppState.dataSourceMode === 'backend') {
    try {
      const res = await fetchWithTimeout(`${LOCAL_API_BASE_URL}/stock/history?symbol=${encodeURIComponent(symbol)}`, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        AppState.historyMap[symbol] = data;
        return data;
      }
    } catch (e) {
      console.warn(`[History] 本地 API 取得 ${symbol} 失敗，降級至靜態`);
    }
  }

  // B. 靜態資料集模式 (GitHub Pages / 手機)
  try {
    const res = await fetchWithTimeout(`${STATIC_DATA_BASE_URL}/history/${encodeURIComponent(symbol)}.json`, {}, 4000);
    if (res.ok) {
      const data = await res.json();
      AppState.historyMap[symbol] = data;
      return data;
    }
  } catch (err) {
    console.warn(`[History] 讀取靜態歷史 ${symbol} 失敗:`, err);
  }

  return null;
}

// ==========================================================================
// UI 渲染函式群
// ==========================================================================

function updateConnectionStatusUI(isConnected, message) {
  const dot = document.getElementById('serverStatusDot');
  const text = document.getElementById('serverStatusText');
  const expectedDateBadge = document.getElementById('expectedTradeDateBadge');

  if (isConnected) {
    dot.className = 'live-dot';
    text.textContent = message || '官方 API 已連線';
    if (AppState.marketCalendar) {
      expectedDateBadge.textContent = `應有交易日: ${AppState.marketCalendar.latest_expected_trading_date}`;
    }
  } else {
    dot.className = 'live-dot dot-warning';
    text.textContent = message || '使用離線資料';
    expectedDateBadge.textContent = '應有交易日: --';
  }
}

// 渲染觀察清單卡片標籤
function renderWatchlistTabs() {
  const tabsContainer = document.getElementById('watchlistTabs');
  const counterEl = document.getElementById('stockCounter');
  const addBtn = document.getElementById('btnAddStock');

  tabsContainer.innerHTML = '';
  counterEl.textContent = `${AppState.watchlist.length} / 10 檔`;

  addBtn.disabled = AppState.watchlist.length >= 10;
  addBtn.title = AppState.watchlist.length >= 10 ? '已達上限 (最多 10 檔)' : '新增觀察股票';

  AppState.watchlist.forEach(symbol => {
    const quote = AppState.quotesMap[symbol] || {
      symbol: symbol,
      name: '官方行情載入中...',
      close_price: null,
      close_price_display: '載入中...',
      change: null
    };

    const isSelected = symbol === AppState.selectedSymbol;
    const isUp = quote.change > 0;
    const isDown = quote.change < 0;
    const sign = isUp ? '+' : '';

    const tab = document.createElement('div');
    tab.className = `stock-tab ${isSelected ? 'active' : ''}`;
    tab.dataset.symbol = symbol;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    tab.setAttribute('aria-label', `${quote.name || symbol}，代號 ${symbol}，最新收盤價 ${quote.close_price !== null ? quote.close_price : '無收盤價'}`);

    tab.innerHTML = `
      <div class="stock-tab-info">
        <div class="stock-tab-top">
          <span class="stock-tab-name">${quote.name || symbol}</span>
          <span class="stock-tab-code">${symbol}</span>
        </div>
        <div class="stock-tab-price">
          ${quote.close_price !== null ? `${formatCurrency(quote.close_price)} 元` : (quote.close_price_display || '無有效收盤價')}
          ${quote.change !== null ? `
            <span class="stock-tab-change ${isUp ? 'text-up' : (isDown ? 'text-down' : 'text-flat')}">
              ${sign}${formatCurrency(quote.change)}
            </span>
          ` : ''}
        </div>
      </div>
      <button class="btn-remove-stock" data-symbol="${symbol}" title="自名單移除 ${symbol}" aria-label="自觀察名單移除 ${quote.name || symbol}">
        &times;
      </button>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-stock')) return;
      selectStock(symbol);
    });

    tab.addEventListener('keydown', (e) => {
      if (e.target.closest('.btn-remove-stock')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectStock(symbol);
      }
    });

    const removeBtn = tab.querySelector('.btn-remove-stock');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeStock(symbol);
    });

    tabsContainer.appendChild(tab);
  });
}

// 渲染指標卡片
function renderMetricCards(quote, historyData) {
  if (!quote) return;

  // 1. 股票代號、名稱、市場標籤
  document.getElementById('currentStockSymbol').textContent = quote.symbol;
  document.getElementById('currentStockName').textContent = quote.name || quote.symbol;
  document.getElementById('currentStockMarket').textContent = quote.market || '官方證券市場';

  // 2. 最近交易日收盤價
  const priceEl = document.getElementById('metricStockPrice');
  const changeEl = document.getElementById('metricStockChange');

  if (quote.close_price !== null) {
    priceEl.textContent = formatCurrency(quote.close_price);
    const isUp = quote.change > 0;
    const isDown = quote.change < 0;
    const sign = isUp ? '+' : '';
    changeEl.textContent = `${sign}${formatCurrency(quote.change)} 元`;
    changeEl.className = 'change-tag ' + (isUp ? 'change-up' : (isDown ? 'change-down' : 'change-flat'));
  } else {
    priceEl.textContent = '無有效收盤價';
    changeEl.textContent = '缺少收盤行情';
    changeEl.className = 'change-tag change-flat';
  }

  // 3. 狀態指示膠囊
  const pill = document.getElementById('metricStatusPill');
  const statusText = document.getElementById('metricStatusText');
  statusText.textContent = quote.status_message || (quote.is_updated ? '資料已更新' : '官方資料尚未更新');

  if (quote.update_failed) {
    pill.className = 'status-alert-pill status-failed';
  } else if (quote.is_updated) {
    pill.className = 'status-alert-pill status-ok';
  } else {
    pill.className = 'status-alert-pill status-pending';
  }

  // 4. 交易日期、資料來源、抓取時間
  document.getElementById('metricTradeDate').textContent = quote.trade_date || '--';
  document.getElementById('metricDataSource').textContent = quote.data_source || '臺灣官方 OpenAPI';
  document.getElementById('metricFetchTime').textContent = quote.fetch_time || '--';

  // 5. 真實均線與指標渲染
  if (historyData && historyData.indicators) {
    const ind = historyData.indicators;
    document.getElementById('metricMA5').textContent = ind.ma5 ? `${formatCurrency(ind.ma5)} 元` : '--';
    document.getElementById('metricMA20').textContent = ind.ma20 ? `${formatCurrency(ind.ma20)} 元` : '--';
    document.getElementById('metricBias5').textContent = ind.bias_5 !== undefined ? `${ind.bias_5}%` : '--';
    document.getElementById('metricBias20').textContent = ind.bias_20 !== undefined ? `${ind.bias_20}%` : '--';
    document.getElementById('metricHigh30').textContent = ind.high_30 ? `${formatCurrency(ind.high_30)} 元` : '--';
    document.getElementById('metricLow30').textContent = ind.low_30 ? `${formatCurrency(ind.low_30)} 元` : '--';
    document.getElementById('metricHistoryCount').textContent = `${historyData.total_days} 個營業日`;

    renderPredictionSummary(quote, ind);
  } else {
    document.getElementById('metricMA5').textContent = '資料整理中...';
    document.getElementById('metricMA20').textContent = '資料整理中...';
    document.getElementById('metricBias5').textContent = '--';
    document.getElementById('metricBias20').textContent = '--';
    document.getElementById('metricHigh30').textContent = '--';
    document.getElementById('metricLow30').textContent = '--';
    document.getElementById('metricHistoryCount').textContent = '--';
    renderPredictionSummary(quote, {});
  }
}

// 根據真實數據渲染多空研判速覽
function renderPredictionSummary(quote, ind) {
  const latestPrice = quote.close_price;
  const badge = document.getElementById('quickPredictionBadge');

  if (!latestPrice || !ind.ma5 || !ind.ma20) {
    badge.textContent = '行情分析中';
    badge.className = 'prediction-pill pred-pill-neutral';
    document.getElementById('predOpenPrice').textContent = '--';
    document.getElementById('predSupportPrice').textContent = '--';
    document.getElementById('predResistancePrice').textContent = '--';
    document.getElementById('predMAStructure').textContent = '正依據官方最新成交紀錄計算均線架構';
    return;
  }

  const supportPrice = Number(Math.min(ind.ma5, latestPrice * 0.985).toFixed(2));
  const resistancePrice = Number(Math.max(ind.high_30, latestPrice * 1.018).toFixed(2));
  const estimatedOpen = Number(latestPrice.toFixed(2));

  document.getElementById('predOpenPrice').textContent = `${formatCurrency(estimatedOpen)} 元`;
  document.getElementById('predSupportPrice').textContent = `${formatCurrency(supportPrice)} 元`;
  document.getElementById('predResistancePrice').textContent = `${formatCurrency(resistancePrice)} 元`;

  let structureText = '';
  if (latestPrice >= ind.ma5 && ind.ma5 >= ind.ma20) {
    structureText = '多頭排列（收盤 > MA5 > MA20），短線具備多方動能';
    badge.textContent = '強勢多頭・逢低有撐';
    badge.className = 'prediction-pill pred-pill-bullish';
  } else if (latestPrice >= ind.ma20) {
    structureText = '守穩月線中多格局，短線處於均線震盪收斂';
    badge.textContent = '震盪偏多・守穩月線';
    badge.className = 'prediction-pill pred-pill-neutral';
  } else if (latestPrice < ind.ma5 && latestPrice < ind.ma20) {
    structureText = '跌破短期均線與月線，短線進入修正整理架構';
    badge.textContent = '弱勢防守・嚴控部位';
    badge.className = 'prediction-pill pred-pill-bearish';
  } else {
    structureText = '短期均線糾結整理，等待量能突破表態';
    badge.textContent = '區間整理・觀望因應';
    badge.className = 'prediction-pill pred-pill-neutral';
  }
  document.getElementById('predMAStructure').textContent = structureText;
}

// 計算或取得籌碼面綜合統計
function getInstitutionalSummary(symbol, historyData) {
  if (historyData && historyData.institutional) {
    return historyData.institutional;
  }
  if (!historyData || !historyData.history || historyData.history.length === 0) {
    return null;
  }
  const records = historyData.history;
  const f_30d = records.reduce((sum, r) => sum + (r.foreign_investors || 0), 0);
  const t_30d = records.reduce((sum, r) => sum + (r.investment_trust || 0), 0);
  const d_30d = records.reduce((sum, r) => sum + (r.dealers || 0), 0);
  const total_30d = records.reduce((sum, r) => sum + (r.institutional_total !== undefined ? r.institutional_total : ((r.foreign_investors || 0) + (r.investment_trust || 0) + (r.dealers || 0))), 0);

  const latest = records[records.length - 1] || {};
  const f_latest = latest.foreign_investors !== undefined ? latest.foreign_investors : 0;
  const t_latest = latest.investment_trust !== undefined ? latest.investment_trust : 0;
  const d_latest = latest.dealers !== undefined ? latest.dealers : 0;
  const total_latest = latest.institutional_total !== undefined ? latest.institutional_total : (f_latest + t_latest + d_latest);

  function calcStreak(field) {
    const rev = [...records].reverse();
    const first = rev[0] ? (rev[0][field] || 0) : 0;
    if (first === 0) return 0;
    const isBuy = first > 0;
    let streak = 0;
    for (const r of rev) {
      const val = r[field] || 0;
      if (isBuy && val > 0) streak++;
      else if (!isBuy && val < 0) streak--;
      else break;
    }
    return streak;
  }

  const f_streak = calcStreak('foreign_investors');
  const t_streak = calcStreak('investment_trust');
  const d_streak = calcStreak('dealers');

  let sentiment = '主力籌碼多空分歧（震盪洗盤）';
  if (f_latest > 0 && t_latest > 0 && d_latest > 0) sentiment = '三大法人同步買超（多方強烈共識）';
  else if (f_latest < 0 && t_latest < 0 && d_latest < 0) sentiment = '三大法人同步賣超（短線沉重調節）';
  else if (f_latest < 0 && t_latest > 0) sentiment = '土洋對作（投信積極護盤承接）';
  else if (f_latest > 0 && t_latest < 0) sentiment = '外資主導回補（投信高檔獲利調節）';
  else if (f_30d > 0 && t_30d > 0) sentiment = '波段主力持續偏多布局';
  else if (f_30d < 0 && t_30d < 0) sentiment = '波段主力籌碼持續外流';

  return {
    foreign_30d_net: f_30d,
    trust_30d_net: t_30d,
    dealers_30d_net: d_30d,
    total_30d_net: total_30d,
    foreign_consecutive_days: f_streak,
    trust_consecutive_days: t_streak,
    dealers_consecutive_days: d_streak,
    foreign_latest_net: f_latest,
    trust_latest_net: t_latest,
    dealers_latest_net: d_latest,
    total_latest_net: total_latest,
    institutional_sentiment: sentiment
  };
}

// 渲染三大法人 30 天籌碼指標卡片
function renderInstitutionalCard(quote, historyData) {
  const badgeEl = document.getElementById('chipSentimentBadge');
  const fStreakEl = document.getElementById('chipForeignStreak');
  const tStreakEl = document.getElementById('chipTrustStreak');
  const dStreakEl = document.getElementById('chipDealersStreak');
  const f30El = document.getElementById('chipForeign30');
  const t30El = document.getElementById('chipTrust30');
  const d30El = document.getElementById('chipDealers30');
  const tot30El = document.getElementById('chipTotal30');
  const fLatestEl = document.getElementById('chipForeignLatest');
  const tLatestEl = document.getElementById('chipTrustLatest');
  const totLatestEl = document.getElementById('chipTotalLatest');

  const summary = getInstitutionalSummary(quote ? quote.symbol : '', historyData);

  if (!summary) {
    if (badgeEl) badgeEl.textContent = '暫無籌碼數據';
    if (fStreakEl) fStreakEl.textContent = '--';
    if (tStreakEl) tStreakEl.textContent = '--';
    if (dStreakEl) dStreakEl.textContent = '--';
    if (f30El) f30El.textContent = '--';
    if (t30El) t30El.textContent = '--';
    if (d30El) d30El.textContent = '--';
    if (tot30El) tot30El.textContent = '--';
    if (fLatestEl) fLatestEl.textContent = '--';
    if (tLatestEl) tLatestEl.textContent = '--';
    if (totLatestEl) totLatestEl.textContent = '--';
    return;
  }

  function setStreakTag(el, streak) {
    if (!el) return;
    if (streak > 0) {
      el.textContent = `連 ${streak} 買`;
      el.className = 'chip-streak streak-buy';
    } else if (streak < 0) {
      el.textContent = `連 ${Math.abs(streak)} 賣`;
      el.className = 'chip-streak streak-sell';
    } else {
      el.textContent = '平';
      el.className = 'chip-streak';
    }
  }

  function setSignedText(el, val) {
    if (!el) return;
    el.textContent = `${formatLots(val)} 張`;
    if (val > 0) el.className = 'chip-num text-up';
    else if (val < 0) el.className = 'chip-num text-down';
    else el.className = 'chip-num text-flat';
  }

  function setSignedLatestText(el, val) {
    if (!el) return;
    el.textContent = `${formatLots(val)} 張`;
    if (val > 0) el.className = 'val text-up';
    else if (val < 0) el.className = 'val text-down';
    else el.className = 'val text-flat';
  }

  if (badgeEl) {
    badgeEl.textContent = summary.institutional_sentiment || '籌碼分析完成';
    if (summary.total_latest_net > 0) badgeEl.className = 'tag-status change-up';
    else if (summary.total_latest_net < 0) badgeEl.className = 'tag-status change-down';
    else badgeEl.className = 'tag-status';
  }

  setStreakTag(fStreakEl, summary.foreign_consecutive_days);
  setStreakTag(tStreakEl, summary.trust_consecutive_days);
  setStreakTag(dStreakEl, summary.dealers_consecutive_days);

  setSignedText(f30El, summary.foreign_30d_net);
  setSignedText(t30El, summary.trust_30d_net);
  setSignedText(d30El, summary.dealers_30d_net);
  setSignedText(tot30El, summary.total_30d_net);

  setSignedLatestText(fLatestEl, summary.foreign_latest_net);
  setSignedLatestText(tLatestEl, summary.trust_latest_net);
  setSignedLatestText(totLatestEl, summary.total_latest_net);
}

// 渲染 Chart.js 真實歷史走勢圖與均線
function renderTrendChart(symbol, historyData) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const subtitleEl = document.getElementById('chartSubtitleDesc');

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    if (AppState.chartInstance) {
      AppState.chartInstance.destroy();
      AppState.chartInstance = null;
    }
    if (subtitleEl) {
      subtitleEl.innerHTML = `<span style="color:#f59e0b;font-weight:600;">【提示】靜態展示版尚未收錄 [${symbol}] 之 30 天歷史走勢檔（僅呈現最新收盤行情）。</span><br><span style="color:#9ca3af;font-size:12px;">如需全市場任意股票即時 30 天歷史走勢，可在本機執行 <code>python backend/server.py</code> 即時查詢。</span>`;
    }
    return;
  }

  if (subtitleEl) {
    subtitleEl.textContent = '100% 串接證交所 (TWSE) 與櫃買中心 (TPEx) 官方真實成交紀錄，無任何 AI 編造';
  }

  const records = historyData.history;
  const labels = records.map(r => r.date);
  const prices = records.map(r => r.close_price);

  const ma5Series = [];
  const ma20Series = [];

  for (let i = 0; i < prices.length; i++) {
    if (i >= 4) {
      const slice5 = prices.slice(i - 4, i + 1);
      const avg5 = slice5.reduce((a, b) => a + b, 0) / 5;
      ma5Series.push(roundDec(avg5, 2));
    } else {
      ma5Series.push(null);
    }

    if (i >= 19) {
      const slice20 = prices.slice(i - 19, i + 1);
      const avg20 = slice20.reduce((a, b) => a + b, 0) / 20;
      ma20Series.push(roundDec(avg20, 2));
    } else {
      ma20Series.push(null);
    }
  }

  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
  }

  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${symbol} 官方收盤價`,
          data: prices,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.2
        },
        {
          label: '5日均線 (MA5)',
          data: ma5Series,
          borderColor: '#f59e0b',
          borderWidth: 1.8,
          pointRadius: 0,
          borderDash: [3, 3],
          fill: false,
          tension: 0.2
        },
        {
          label: '20日月均線 (MA20)',
          data: ma20Series,
          borderColor: '#a855f7',
          borderWidth: 1.8,
          pointRadius: 0,
          borderDash: [5, 4],
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#f3f4f6',
            font: { size: 12, weight: '500' },
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#93c5fd',
          bodyColor: '#f3f4f6',
          callbacks: {
            label: function(context) {
              if (context.parsed.y === null) return `${context.dataset.label}: --`;
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)} 元`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', maxRotation: 45, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#93c5fd',
            callback: value => `${value} 元`
          }
        }
      }
    }
  });
}

function roundDec(num, d = 2) {
  return Number(Math.round(num + 'e' + d) + 'e-' + d);
}

// 渲染三大法人 30 天每日買賣超柱狀圖
function renderInstitutionalChart(symbol, historyData) {
  const canvas = document.getElementById('chipChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    if (AppState.chipChartInstance) {
      AppState.chipChartInstance.destroy();
      AppState.chipChartInstance = null;
    }
    return;
  }

  const records = historyData.history;
  const labels = records.map(r => r.date);
  const foreignData = records.map(r => r.foreign_investors !== undefined ? r.foreign_investors : 0);
  const trustData = records.map(r => r.investment_trust !== undefined ? r.investment_trust : 0);
  const dealersData = records.map(r => r.dealers !== undefined ? r.dealers : 0);

  if (AppState.chipChartInstance) {
    AppState.chipChartInstance.destroy();
  }

  AppState.chipChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '外資 (張)',
          data: foreignData,
          backgroundColor: 'rgba(56, 189, 248, 0.75)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          borderRadius: 2
        },
        {
          label: '投信 (張)',
          data: trustData,
          backgroundColor: 'rgba(251, 146, 60, 0.75)',
          borderColor: '#fb923c',
          borderWidth: 1,
          borderRadius: 2
        },
        {
          label: '自營商 (張)',
          data: dealersData,
          backgroundColor: 'rgba(192, 132, 252, 0.75)',
          borderColor: '#c084fc',
          borderWidth: 1,
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#93c5fd',
          bodyColor: '#f3f4f6',
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              const sign = val > 0 ? '+' : '';
              return `${context.dataset.label}: ${sign}${val.toLocaleString('zh-TW')} 張`;
            },
            footer: function(tooltipItems) {
              let sum = 0;
              tooltipItems.forEach(item => { sum += item.parsed.y; });
              const sign = sum > 0 ? '+' : '';
              return `三大法人合計: ${sign}${sum.toLocaleString('zh-TW')} 張`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', maxRotation: 45, maxTicksLimit: 12 }
        },
        y: {
          grid: {
            color: context => context.tick.value === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            lineWidth: context => context.tick.value === 0 ? 1.5 : 1
          },
          ticks: {
            color: '#9ca3af',
            callback: value => `${value > 0 ? '+' : ''}${value.toLocaleString('zh-TW')} 張`
          }
        }
      }
    }
  });
}

// 切換圖表檢視模式
function updateChartView(mode) {
  AppState.chartViewMode = mode;
  const bothBtn = document.getElementById('btnViewBoth');
  const priceBtn = document.getElementById('btnViewPrice');
  const chipBtn = document.getElementById('btnViewChip');
  const priceBlock = document.getElementById('blockPriceChart');
  const chipBlock = document.getElementById('blockChipChart');

  [bothBtn, priceBtn, chipBtn].forEach(b => {
    if (b) b.classList.remove('active');
  });

  if (mode === 'both') {
    if (bothBtn) bothBtn.classList.add('active');
    if (priceBlock) priceBlock.classList.remove('is-hidden');
    if (chipBlock) chipBlock.classList.remove('is-hidden');
  } else if (mode === 'price') {
    if (priceBtn) priceBtn.classList.add('active');
    if (priceBlock) priceBlock.classList.remove('is-hidden');
    if (chipBlock) chipBlock.classList.add('is-hidden');
  } else if (mode === 'chip') {
    if (chipBtn) chipBtn.classList.add('active');
    if (priceBlock) priceBlock.classList.add('is-hidden');
    if (chipBlock) chipBlock.classList.remove('is-hidden');
  }

  setTimeout(() => {
    if (AppState.chartInstance) AppState.chartInstance.resize();
    if (AppState.chipChartInstance) AppState.chipChartInstance.resize();
  }, 50);
}

// 渲染 30 天歷史明細表格 (包含三大法人買賣超)
function renderHistoryTable(historyData) {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align:center;color:#9ca3af;padding:28px 16px;">尚無此檔 30 天歷史明細資料（可於本機執行後端服務即時抓取）</td>`;
    tbody.appendChild(tr);
    return;
  }

  const records = [...historyData.history].reverse();

  records.forEach(row => {
    const tr = document.createElement('tr');
    const isUp = row.change > 0;
    const isDown = row.change < 0;
    const sign = isUp ? '+' : '';

    const fLots = row.foreign_investors !== undefined ? row.foreign_investors : 0;
    const tLots = row.investment_trust !== undefined ? row.investment_trust : 0;
    const dLots = row.dealers !== undefined ? row.dealers : 0;
    const totLots = row.institutional_total !== undefined ? row.institutional_total : (fLots + tLots + dLots);

    function lotClass(val) {
      if (val > 0) return 'text-up';
      if (val < 0) return 'text-down';
      return 'text-flat';
    }

    tr.innerHTML = `
      <td><strong>${row.date}</strong></td>
      <td>${formatCurrency(row.close_price)} 元</td>
      <td class="${isUp ? 'text-up' : (isDown ? 'text-down' : 'text-flat')}">
        ${sign}${formatCurrency(row.change)} 元
      </td>
      <td>${formatInt(row.volume)}</td>
      <td class="${lotClass(fLots)}">${formatLots(fLots)}</td>
      <td class="${lotClass(tLots)}">${formatLots(tLots)}</td>
      <td class="${lotClass(dLots)}">${formatLots(dLots)}</td>
      <td class="${lotClass(totLots)}"><strong>${formatLots(totLots)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// 渲染次日走勢分析報告
function renderReport(quote, historyData) {
  if (!quote) return;

  document.getElementById('reportStockName').textContent = `${quote.name || quote.symbol} (${quote.symbol})`;
  document.getElementById('reportDataSourceName').textContent = quote.data_source || '臺灣官方行情';
  document.getElementById('reportTradeDate').textContent = quote.trade_date || '--';
  document.getElementById('reportFetchTime').textContent = quote.fetch_time || '--';

  const ind = historyData ? (historyData.indicators || {}) : {};
  const hasHistory = !!(historyData && historyData.indicators && ind.ma5);
  const ma5 = ind.ma5 || '--';
  const ma20 = ind.ma20 || '--';
  const bias5 = ind.bias_5 !== undefined ? ind.bias_5 : '--';
  const bias20 = ind.bias_20 !== undefined ? ind.bias_20 : '--';
  const closePrice = quote.close_price;

  // 1. 官方日曆判定
  const calendarBox = document.getElementById('reportCalendarAnalysis');
  const isUpToDate = quote.is_updated;
  calendarBox.innerHTML = `
    <p>
      • <strong>實際官方交易日：</strong> ${quote.trade_date} (${isUpToDate ? '已成功取得當日已完成交易' : '官方尚未產出最新交易報表'})<br>
      • <strong>系統應有交易日：</strong> ${quote.expected_trade_date || '依日曆推算'}<br>
      • <strong>時效驗證狀態：</strong> <span class="${isUpToDate ? 'text-up' : 'text-flat'}"><strong>${quote.status_message}</strong></span><br>
      • <strong>資料介接管線：</strong> 直連 ${quote.data_source}，並通過逗號清洗與無效價格防呆檢核。
    </p>
  `;

  // 2. 均線排列
  const techBox = document.getElementById('reportTechAnalysis');
  if (!hasHistory) {
    techBox.innerHTML = `
      <p style="color:#f59e0b;">
        • <strong>歷史數據狀態：</strong> 靜態展示版尚未收錄此檔 30 天歷史數據。<br>
        • <strong>均線與乖離率：</strong> 缺少足夠交易天數，暫無法計算 MA5 / MA20 / BIAS 指標。<br>
        • <strong>建議方案：</strong> 可於本機啟動 <code>python backend/server.py</code> 即時連線官方 OpenAPI 計算，或於後端匯出清單中擴充此檔股票。
      </p>
    `;
  } else {
    techBox.innerHTML = `
      <p>
        基於官方最近 30 個營業日真實成交紀錄量化計算：<br>
        • <strong>5日均線 (MA5)：</strong> ${formatCurrency(ma5)} 元<br>
        • <strong>20日月均線 (MA20)：</strong> ${formatCurrency(ma20)} 元<br>
        • <strong>5日乖離率 (BIAS)：</strong> ${bias5}% (${Math.abs(bias5) > 4 ? '短線乖離擴大，提防技術性修正' : '處於常態運行範圍'})<br>
        • <strong>20日乖離率 (BIAS)：</strong> ${bias20}%<br>
        • <strong>30日波動區間：</strong> 上檔峰值 ${formatCurrency(ind.high_30)} 元，下檔低點 ${formatCurrency(ind.low_30)} 元。
      </p>
    `;
  }

  // 3. 次日情境
  const scenarioBox = document.getElementById('reportScenarioAnalysis');
  const support = ind.ma5 ? Math.min(ind.ma5, closePrice * 0.985) : (closePrice * 0.98);
  const resistance = ind.high_30 ? Math.max(ind.high_30, closePrice * 1.018) : (closePrice * 1.02);

  scenarioBox.innerHTML = `
    <p>
      • <strong>預估次日開盤參考價：</strong> 約合 <strong>${formatCurrency(closePrice)} 元</strong> 附近開出。<br>
      • <strong>下檔關鍵防守支撐：</strong> <strong>${formatCurrency(support)} 元</strong>（跌破將考驗月線防守）。<br>
      • <strong>上檔波段考驗壓力：</strong> <strong>${formatCurrency(resistance)} 元</strong>（逼近前波高點或整數關卡）。<br>
      • <strong>走勢推演：</strong> 若早盤開高不破 MA5 支撐，多方結構可望延續；若量能萎縮且開低破線，則需提防回測下檔支撐位。
    </p>
  `;

  // 4. 操作策略
  const strategyBox = document.getElementById('reportActionStrategy');
  strategyBox.innerHTML = `
    <p>
      • <strong>短線策略：</strong> 沿 5 日均線 (${formatCurrency(ma5)} 元) 偏多操作，若跌破且未能於當日收復宜先收回資金觀望。<br>
      • <strong>波段策略：</strong> 月線 (${formatCurrency(ma20)} 元) 未失守前維持中多看法，不盲目追高，等待拉回量縮測試支撐時布局。<br>
      • <strong>嚴守紀律：</strong> 建議停損防守線設定於 <strong>${formatCurrency(support * 0.985)} 元</strong>，嚴控曝險比率。
    </p>
  `;

  // 5. 三大法人籌碼分析
  const chipBox = document.getElementById('reportChipAnalysis');
  const chipSummary = getInstitutionalSummary(quote.symbol, historyData);

  if (!chipSummary || !historyData || !historyData.history || historyData.history.length === 0) {
    if (chipBox) {
      chipBox.innerHTML = `
        <p style="color:#f59e0b;">
          • <strong>籌碼資料狀態：</strong> 靜態展示版尚未收錄此檔 30 天三大法人買賣超數據。<br>
          • <strong>建議方案：</strong> 可於本機啟動 <code>py backend/server.py</code> 即時查詢官方三大法人籌碼歷史。
        </p>
      `;
    }
  } else if (chipBox) {
    const fAction = chipSummary.foreign_30d_net >= 0 ? '買超' : '賣超';
    const tAction = chipSummary.trust_30d_net >= 0 ? '買超' : '賣超';
    const totAction = chipSummary.total_30d_net >= 0 ? '買超' : '賣超';

    function streakText(streak) {
      if (streak > 0) return `連續 ${streak} 日買超`;
      if (streak < 0) return `連續 ${Math.abs(streak)} 日賣超`;
      return '單日買賣平衡';
    }

    chipBox.innerHTML = `
      <p>
        基於臺灣證券交易所 (TWSE) 與櫃買中心 (TPEx) 官方最近 30 個營業日真實籌碼數據量化綜判：<br>
        • <strong>外資動能現況：</strong> 30 日累計淨${fAction} <strong>${formatLots(Math.abs(chipSummary.foreign_30d_net), false)} 張</strong>，最新單日呈現 <strong>${streakText(chipSummary.foreign_consecutive_days)} (${formatLots(chipSummary.foreign_latest_net)} 張)</strong>。<br>
        • <strong>本土投信布局：</strong> 30 日累計淨${tAction} <strong>${formatLots(Math.abs(chipSummary.trust_30d_net), false)} 張</strong>，最新單日呈現 <strong>${streakText(chipSummary.trust_consecutive_days)} (${formatLots(chipSummary.trust_latest_net)} 張)</strong>。<br>
        • <strong>自營商操作態勢：</strong> 30 日累計淨額 <strong>${formatLots(chipSummary.dealers_30d_net)} 張</strong>，最新單日買賣超 <strong>${formatLots(chipSummary.dealers_latest_net)} 張</strong>。<br>
        • <strong>三大法人合計淨額：</strong> 30 日累計淨${totAction} <strong>${formatLots(Math.abs(chipSummary.total_30d_net), false)} 張</strong>，最新單日合計 <strong>${formatLots(chipSummary.total_latest_net)} 張</strong>。<br>
        • <strong>籌碼面多空綜判：</strong> <span class="${chipSummary.total_latest_net > 0 ? 'text-up' : (chipSummary.total_latest_net < 0 ? 'text-down' : 'text-flat')}"><strong>【${chipSummary.institutional_sentiment}】</strong></span><br>
        • <strong>量化籌碼解讀：</strong> ${chipSummary.analysis || '法人籌碼買賣互見，短線宜觀察均線支撐與量能配合狀況。'}
      </p>
    `;
  }
}

// 刷新當前個股畫面
async function refreshCurrentStockView() {
  const symbol = AppState.selectedSymbol;
  let quote = AppState.quotesMap[symbol];

  if (!quote) {
    await loadQuotesForWatchlist([symbol]);
    quote = AppState.quotesMap[symbol];
  }

  const historyData = await loadStockHistory(symbol);

  renderWatchlistTabs();
  renderMetricCards(quote, historyData);
  renderInstitutionalCard(quote, historyData);
  renderTrendChart(symbol, historyData);
  renderInstitutionalChart(symbol, historyData);
  renderHistoryTable(historyData);
  renderReport(quote, historyData);
}

// 選取指定股票
async function selectStock(symbol) {
  AppState.selectedSymbol = String(symbol).trim();
  await refreshCurrentStockView();
}

// 新增股票至觀察名單
async function addStock(inputVal) {
  const rawInput = (inputVal || '').trim();
  if (!rawInput) {
    showToast('請輸入股票代碼！', 'warn');
    return;
  }

  if (AppState.watchlist.length >= 10) {
    showToast('觀察名單上限為 10 檔，請先刪除既有名單再新增！', 'warn');
    return;
  }

  let symbol = '';
  const match = rawInput.match(/^[0-9A-Za-z]{4,6}/) || rawInput.match(/[0-9A-Za-z]{4,6}/);
  if (match) {
    symbol = match[0].toUpperCase();
  } else {
    symbol = rawInput.trim();
  }

  showToast(`正在查詢 [${rawInput}] 官方行情...`, 'info');

  // 嘗試載入行情
  await loadQuotesForWatchlist([symbol]);
  let qData = AppState.quotesMap[symbol];

  // 若以名稱搜尋成功，校正為該股票代碼
  if (qData && qData.symbol) {
    symbol = qData.symbol;
  }

  if (!qData) {
    showToast(`查無 [${rawInput}] 之官方收盤資料！`, 'error');
    return;
  }

  if (AppState.watchlist.includes(symbol)) {
    showToast(`股票 [${qData.name || symbol}] 已經在觀察名單中！`, 'warn');
    selectStock(symbol);
    return;
  }

  AppState.watchlist.push(symbol);
  AppState.selectedSymbol = symbol;
  saveWatchlistToStorage();

  await refreshCurrentStockView();
  showToast(`成功加入觀察名單：${qData.name} (${symbol})`, 'success');
  document.getElementById('stockInput').value = '';
}

// 移除觀察股票
function removeStock(symbol) {
  if (AppState.watchlist.length <= 1) {
    showToast('觀察名單至少需保留 1 檔股票！', 'warn');
    return;
  }

  AppState.watchlist = AppState.watchlist.filter(s => s !== symbol);
  delete AppState.quotesMap[symbol];
  delete AppState.historyMap[symbol];

  if (AppState.selectedSymbol === symbol) {
    AppState.selectedSymbol = AppState.watchlist[0];
  }

  saveWatchlistToStorage();
  refreshCurrentStockView();
  showToast(`已自名單移除 [${symbol}]`, 'info');
}

function saveWatchlistToStorage() {
  try {
    localStorage.setItem(STORAGE_WATCHLIST_KEY, JSON.stringify(AppState.watchlist));
  } catch (e) {
    console.error('儲存觀察名單失敗:', e);
  }
}

function loadWatchlistFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        AppState.watchlist = parsed.map(s => String(s).trim());
        AppState.selectedSymbol = AppState.watchlist[0];
        return;
      }
    }
  } catch (e) {
    console.warn('載入本地名單失敗:', e);
  }
  AppState.watchlist = [...DEFAULT_SYMBOLS];
  AppState.selectedSymbol = '2330';
}

function copyReportToClipboard() {
  const quote = AppState.quotesMap[AppState.selectedSymbol];
  const hist = AppState.historyMap[AppState.selectedSymbol];

  if (!quote) return;

  const ind = hist ? hist.indicators : {};
  const chipSum = getInstitutionalSummary(quote.symbol, hist);

  let chipSectionText = '';
  if (chipSum) {
    const fStreakStr = chipSum.foreign_consecutive_days > 0 ? `連 ${chipSum.foreign_consecutive_days} 買` : (chipSum.foreign_consecutive_days < 0 ? `連 ${Math.abs(chipSum.foreign_consecutive_days)} 賣` : '平');
    const tStreakStr = chipSum.trust_consecutive_days > 0 ? `連 ${chipSum.trust_consecutive_days} 買` : (chipSum.trust_consecutive_days < 0 ? `連 ${Math.abs(chipSum.trust_consecutive_days)} 賣` : '平');
    chipSectionText = `
【三大法人 30 天籌碼面深度解析】
外資 30 日累計：${formatLots(chipSum.foreign_30d_net)} 張 (${fStreakStr}，最新單日: ${formatLots(chipSum.foreign_latest_net)} 張)
投信 30 日累計：${formatLots(chipSum.trust_30d_net)} 張 (${tStreakStr}，最新單日: ${formatLots(chipSum.trust_latest_net)} 張)
自營商 30 日累計：${formatLots(chipSum.dealers_30d_net)} 張 (最新單日: ${formatLots(chipSum.dealers_latest_net)} 張)
三大法人 30 日合計：${formatLots(chipSum.total_30d_net)} 張 (最新單日合計: ${formatLots(chipSum.total_latest_net)} 張)
籌碼面多空綜評：${chipSum.institutional_sentiment}
主力動能深度解讀：${chipSum.analysis || '法人籌碼動態平穩。'}
`.trim();
  }

  const text = `
【台股趨勢分析小幫手 - 官方行情深度分析報告】
=========================================
股票代號：${quote.symbol}
股票名稱：${quote.name || quote.symbol}
市場別：${quote.market}
官方交易日期：${quote.trade_date}
最新交易日收盤價：${formatCurrency(quote.close_price)} 元 (${quote.change > 0 ? '+' : ''}${formatCurrency(quote.change)} 元)
官方資料來源：${quote.data_source}
資料抓取時間：${quote.fetch_time}
資料驗證狀態：${quote.status_message}
-----------------------------------------
【真實 30 天均線與技術架構】
5日短期均線 (MA5)：${formatCurrency(ind.ma5)} 元 (乖離率: ${ind.bias_5}%)
20日月均線 (MA20)：${formatCurrency(ind.ma20)} 元 (乖離率: ${ind.bias_20}%)
30日波段高低區間：${formatCurrency(ind.low_30)} ~ ${formatCurrency(ind.high_30)} 元
-----------------------------------------
【次一交易日客觀研判】
預估次日開盤參考：${formatCurrency(quote.close_price)} 元
下檔第一支撐位：${formatCurrency(ind.ma5 ? Math.min(ind.ma5, quote.close_price * 0.985) : quote.close_price * 0.98)} 元
上檔第一壓力位：${formatCurrency(ind.high_30 ? Math.max(ind.high_30, quote.close_price * 1.018) : quote.close_price * 1.02)} 元
-----------------------------------------
${chipSectionText}
=========================================
本報告直接串接證交所 (TWSE) 與櫃買中心 (TPEx) 官方 OpenAPI，非投資買賣建議。
`.trim();

  const btn = document.getElementById('btnCopyReport');
  const originalHtml = btn ? btn.innerHTML : '';

  const onCopied = () => {
    showToast('已成功複製官方分析報告至剪貼簿！', 'success');
    if (btn) {
      btn.classList.add('btn-success-state');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        已複製報告！
      `;
      setTimeout(() => {
        btn.classList.remove('btn-success-state');
        btn.innerHTML = originalHtml;
      }, 2000);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onCopied).catch(() => {
      fallbackCopy(text);
      onCopied();
    });
  } else {
    fallbackCopy(text);
    onCopied();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 應用程式初始化
async function initializeApp() {
  loadWatchlistFromStorage();

  // 1. 載入日曆
  await loadMarketCalendar();

  // 2. 載入名單行情
  await loadQuotesForWatchlist(AppState.watchlist);

  // 3. 渲染主畫面
  await refreshCurrentStockView();

  // 4. 事件綁定
  const btnAdd = document.getElementById('btnAddStock');
  const stockInput = document.getElementById('stockInput');

  btnAdd.addEventListener('click', () => {
    addStock(stockInput.value);
  });

  stockInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addStock(stockInput.value);
    }
  });

  const refreshBtn = document.getElementById('btnRefreshData');
  refreshBtn.addEventListener('click', async () => {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    refreshBtn.classList.add('btn-spinning');
    showToast('正在重新整理最新官方行情...', 'info');
    try {
      await loadMarketCalendar();
      await loadQuotesForWatchlist(AppState.watchlist);
      await refreshCurrentStockView();
      showToast('官方行情已重新整理！', 'success');
    } catch (e) {
      showToast('行情重新整理失敗，請稍候再試', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('btn-spinning');
    }
  });

  document.getElementById('btnResetDefault').addEventListener('click', async () => {
    if (confirm('確定要還原為預設 3 檔官方觀察名單 (台積電、台達電、聯發科) 嗎？')) {
      AppState.watchlist = [...DEFAULT_SYMBOLS];
      AppState.selectedSymbol = '2330';
      saveWatchlistToStorage();
      await loadQuotesForWatchlist(AppState.watchlist);
      await refreshCurrentStockView();
      showToast('已還原為官方預設 3 檔股票！', 'success');
    }
  });

  const btnToggleTable = document.getElementById('btnToggleTable');
  const drawer = document.getElementById('historyTableDrawer');
  btnToggleTable.addEventListener('click', () => {
    AppState.isHistoryTableOpen = !AppState.isHistoryTableOpen;
    const tableIcon = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    `;
    if (AppState.isHistoryTableOpen) {
      drawer.classList.remove('collapsed');
      btnToggleTable.innerHTML = `${tableIcon} 收合 30 天官方歷史明細表`;
    } else {
      drawer.classList.add('collapsed');
      btnToggleTable.innerHTML = `${tableIcon} 檢視 30 天官方歷史明細表`;
    }
  });

  // 圖表檢視模式切換 (雙圖對照 / 僅股價 / 僅法人籌碼)
  const btnBoth = document.getElementById('btnViewBoth');
  const btnPrice = document.getElementById('btnViewPrice');
  const btnChip = document.getElementById('btnViewChip');

  if (btnBoth) btnBoth.addEventListener('click', () => updateChartView('both'));
  if (btnPrice) btnPrice.addEventListener('click', () => updateChartView('price'));
  if (btnChip) btnChip.addEventListener('click', () => updateChartView('chip'));

  document.getElementById('btnCopyReport').addEventListener('click', copyReportToClipboard);
}

document.addEventListener('DOMContentLoaded', initializeApp);
