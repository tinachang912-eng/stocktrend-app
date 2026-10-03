/**
 * 台股趨勢分析小幫手 - 官方行情連線版 (app.js)
 * 100% 串接證交所 (TWSE) 與櫃買中心 (TPEx) 官方 OpenAPI
 * 絕無 AI 編造股價或隨機模擬資料
 */

const API_BASE_URL = 'http://127.0.0.1:8000/api';
const STORAGE_WATCHLIST_KEY = 'TW_STOCK_OFFICIAL_WATCHLIST_V3';

// 預設觀察股票代碼 (字串，嚴格保留前導 0)
const DEFAULT_SYMBOLS = ['2330', '2308', '2454'];

// 應用程式狀態管理
const AppState = {
  watchlist: [...DEFAULT_SYMBOLS], // 股票代碼陣列 (字串，最多 10 檔)
  selectedSymbol: '2330',          // 當前檢視之股票代號
  quotesMap: {},                   // { [symbol]: quoteData }
  historyMap: {},                  // { [symbol]: historyData }
  marketCalendar: null,            // 官方交易日曆與市場狀態
  chartInstance: null,             // Chart.js 實例
  isHistoryTableOpen: false,
  isBackendConnected: false
};

// 工具函式：格式化數值
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

// ==========================================================================
// 後端 API 通訊模組 (Fetch with Timeout & Retry)
// ==========================================================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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

// 取得大盤日曆與時區狀態
async function apiGetMarketCalendar() {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/market/calendar`, {}, 5000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    AppState.marketCalendar = data;
    AppState.isBackendConnected = true;
    updateConnectionStatusUI(true, '官方 API 已連線');
    return data;
  } catch (err) {
    console.warn('[API] 無法連線至後端市場日曆:', err);
    AppState.isBackendConnected = false;
    updateConnectionStatusUI(false, '後端服務未啟動 (請啟動 python backend/server.py)');
    return null;
  }
}

// 批次取得股票行情
async function apiGetBatchQuotes(symbols) {
  const symParam = symbols.join(',');
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/stocks/batch?symbols=${encodeURIComponent(symParam)}`, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (result && Array.isArray(result.data)) {
      result.data.forEach(q => {
        AppState.quotesMap[q.symbol] = q;
      });
    }
    return result.data;
  } catch (err) {
    console.error('[API] 取得批次行情失敗:', err);
    throw err;
  }
}

// 取得單一股票真實 30 天歷史成交資訊與均線
async function apiGetStockHistory(symbol) {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/stock/history?symbol=${encodeURIComponent(symbol)}`, {}, 10000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    AppState.historyMap[symbol] = data;
    return data;
  } catch (err) {
    console.error(`[API] 取得股票 ${symbol} 歷史資料失敗:`, err);
    throw err;
  }
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
    text.textContent = '官方 API 已連線';
    if (AppState.marketCalendar) {
      expectedDateBadge.textContent = `應有交易日: ${AppState.marketCalendar.latest_expected_trading_date}`;
    }
  } else {
    dot.className = 'live-dot dot-error';
    text.textContent = message || '後端離線';
    expectedDateBadge.textContent = '應有交易日: --';
  }
}

// 渲染觀察名單卡片標籤 (Watchlist Tabs)
function renderWatchlistTabs() {
  const tabsContainer = document.getElementById('watchlistTabs');
  const counterEl = document.getElementById('stockCounter');
  const addBtn = document.getElementById('btnAddStock');

  tabsContainer.innerHTML = '';
  counterEl.textContent = `${AppState.watchlist.length} / 10 檔`;

  addBtn.disabled = AppState.watchlist.length >= 10;
  if (AppState.watchlist.length >= 10) {
    addBtn.title = '已達上限 (最多 10 檔)';
  } else {
    addBtn.title = '新增觀察股票';
  }

  AppState.watchlist.forEach(symbol => {
    const quote = AppState.quotesMap[symbol] || {
      symbol: symbol,
      name: '載入中...',
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
      <button class="btn-remove-stock" data-symbol="${symbol}" title="自名單移除 ${symbol}">
        &times;
      </button>
    `;

    // 點選切換個股
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-stock')) return;
      selectStock(symbol);
    });

    // 刪除按鈕
    const removeBtn = tab.querySelector('.btn-remove-stock');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeStock(symbol);
    });

    tabsContainer.appendChild(tab);
  });
}

// 渲染核心指標卡片 (包含需求第7點之必要欄位)
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

  // 3. 狀態指示膠囊（資料已更新 / 官方資料尚未更新 / API 失敗）
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

  // 4. 畫面顯示必要資訊：交易日期、資料來源、抓取時間
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

    // 次日研判速覽
    renderPredictionSummary(quote, ind);
  } else {
    document.getElementById('metricMA5').textContent = '載入中...';
    document.getElementById('metricMA20').textContent = '載入中...';
    document.getElementById('metricBias5').textContent = '--';
    document.getElementById('metricBias20').textContent = '--';
    document.getElementById('metricHigh30').textContent = '--';
    document.getElementById('metricLow30').textContent = '--';
    document.getElementById('metricHistoryCount').textContent = '--';
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
    document.getElementById('predMAStructure').textContent = '資料不足以計算均線結構';
    return;
  }

  // 計算支撐與壓力
  const supportPrice = Number(Math.min(ind.ma5, latestPrice * 0.985).toFixed(2));
  const resistancePrice = Number(Math.max(ind.high_30, latestPrice * 1.018).toFixed(2));
  const estimatedOpen = Number(latestPrice.toFixed(2));

  document.getElementById('predOpenPrice').textContent = `${formatCurrency(estimatedOpen)} 元`;
  document.getElementById('predSupportPrice').textContent = `${formatCurrency(supportPrice)} 元`;
  document.getElementById('predResistancePrice').textContent = `${formatCurrency(resistancePrice)} 元`;

  // 判定均線多空結構
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

// 渲染 Chart.js 真實歷史走勢圖與均線
function renderTrendChart(symbol, historyData) {
  const ctx = document.getElementById('trendChart').getContext('2d');

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    return;
  }

  const records = historyData.history;
  const labels = records.map(r => r.date);
  const prices = records.map(r => r.close_price);

  // 動態計算 5日與 20日均線序列
  const ma5Series = [];
  const ma20Series = [];

  for (let i = 0; i < prices.length; i++) {
    // MA5
    if (i >= 4) {
      const slice5 = prices.slice(i - 4, i + 1);
      const avg5 = slice5.reduce((a, b) => a + b, 0) / 5;
      ma5Series.push(roundDec(avg5, 2));
    } else {
      ma5Series.push(null);
    }

    // MA20
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

// 渲染 30 天歷史明細表格
function renderHistoryTable(historyData) {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  if (!historyData || !historyData.history) return;

  // 由新到舊排序
  const records = [...historyData.history].reverse();

  records.forEach(row => {
    const tr = document.createElement('tr');
    const isUp = row.change > 0;
    const isDown = row.change < 0;
    const sign = isUp ? '+' : '';

    tr.innerHTML = `
      <td><strong>${row.date}</strong></td>
      <td>${formatCurrency(row.close_price)} 元</td>
      <td class="${isUp ? 'text-up' : (isDown ? 'text-down' : 'text-flat')}">
        ${sign}${formatCurrency(row.change)} 元
      </td>
      <td>${formatInt(row.volume)}</td>
      <td><span class="status-indicator-dot" style="display:inline-block;margin-right:4px;"></span> 官方驗證成交</td>
    `;
    tbody.appendChild(tr);
  });
}

// 渲染次日走勢分析報告
function renderReport(quote, historyData) {
  if (!quote) return;

  document.getElementById('reportStockName').textContent = `${quote.name || quote.symbol} (${quote.symbol})`;
  document.getElementById('reportDataSourceName').textContent = quote.data_source || '臺灣證券交易所官方行情';
  document.getElementById('reportTradeDate').textContent = quote.trade_date || '--';
  document.getElementById('reportFetchTime').textContent = quote.fetch_time || '--';

  const ind = historyData ? historyData.indicators : {};
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
      • <strong>資料介接管線：</strong> 由後端直連 ${quote.data_source}，並通過逗號清洗與無效價格防呆檢核。
    </p>
  `;

  // 2. 均線排列
  const techBox = document.getElementById('reportTechAnalysis');
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
}

// 全面更新當前畫面
async function refreshCurrentStockView() {
  const symbol = AppState.selectedSymbol;
  let quote = AppState.quotesMap[symbol];

  // 若尚未取得 quote，嘗試從後端抓取
  if (!quote) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/stock/quote?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        quote = await res.json();
        AppState.quotesMap[symbol] = quote;
      }
    } catch (e) {
      console.warn(`[Quote] 抓取單檔 ${symbol} 失敗:`, e);
    }
  }

  // 抓取真實 30 天歷史數據
  let historyData = AppState.historyMap[symbol];
  if (!historyData) {
    try {
      historyData = await apiGetStockHistory(symbol);
    } catch (e) {
      console.warn(`[History] 抓取歷史行情 ${symbol} 失敗:`, e);
    }
  }

  renderWatchlistTabs();
  renderMetricCards(quote, historyData);
  renderTrendChart(symbol, historyData);
  renderHistoryTable(historyData);
  renderReport(quote, historyData);
}

// 選取指定股票
async function selectStock(symbol) {
  AppState.selectedSymbol = String(symbol).trim();
  await refreshCurrentStockView();
}

// 新增股票至觀察清單
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

  // 提取股票代碼（支援純代號或 0050 元大台灣50，嚴格保留字串與前導0）
  let symbol = '';
  const match = rawInput.match(/^[0-9A-Za-z]{4,6}/) || rawInput.match(/[0-9A-Za-z]{4,6}/);
  if (match) {
    symbol = match[0].toUpperCase();
  } else {
    symbol = rawInput.split(' ')[0].trim().toUpperCase();
  }

  if (AppState.watchlist.includes(symbol)) {
    showToast(`股票 [${symbol}] 已經在觀察名單中！`, 'warn');
    selectStock(symbol);
    return;
  }

  // 嘗試向官方後端驗證此代號是否存在
  showToast(`正在向官方查詢 [${symbol}] 行情...`, 'info');
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/stock/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) {
      showToast(`在證交所與櫃買中心官方資料中查無代號 [${symbol}]！`, 'error');
      return;
    }
    const qData = await res.json();
    AppState.quotesMap[symbol] = qData;
    AppState.watchlist.push(symbol);
    AppState.selectedSymbol = symbol;

    saveWatchlistToStorage();
    await refreshCurrentStockView();
    showToast(`成功加入觀察名單：${qData.name} (${symbol})`, 'success');
    document.getElementById('stockInput').value = '';
  } catch (err) {
    showToast(`連線驗證失敗：${err.message}`, 'error');
  }
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

// 儲存觀察名單至 localStorage
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

// 複製完整分析報告
function copyReportToClipboard() {
  const quote = AppState.quotesMap[AppState.selectedSymbol];
  const hist = AppState.historyMap[AppState.selectedSymbol];

  if (!quote) return;

  const ind = hist ? hist.indicators : {};

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
=========================================
本報告直接串接證交所 (TWSE) 與櫃買中心 (TPEx) 官方 OpenAPI，非投資買賣建議。
`.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已成功複製官方分析報告至剪貼簿！', 'success');
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('已成功複製官方分析報告至剪貼簿！', 'success');
}

// Toast 提示
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

// ==========================================================================
// 應用程式初始化與事件監聽
// ==========================================================================

async function initializeApp() {
  loadWatchlistFromStorage();

  // 1. 先確認後端市場日曆與時區
  await apiGetMarketCalendar();

  // 2. 抓取觀察名單批次行情
  try {
    await apiGetBatchQuotes(AppState.watchlist);
  } catch (err) {
    console.warn('[Init] 批次載入失敗，將個別嘗試');
  }

  // 3. 渲染主畫面
  await refreshCurrentStockView();

  // 4. 事件綁定：新增股票按鈕與 Enter 鍵
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

  // 5. 事件綁定：手動重新整理
  document.getElementById('btnRefreshData').addEventListener('click', async () => {
    showToast('正在向官方重新整理最新行情...', 'info');
    await apiGetMarketCalendar();
    try {
      await apiGetBatchQuotes(AppState.watchlist);
      await refreshCurrentStockView();
      showToast('官方行情資料已全面更新！', 'success');
    } catch (e) {
      showToast(`重新整理失敗: ${e.message}`, 'error');
    }
  });

  // 6. 事件綁定：還原預設
  document.getElementById('btnResetDefault').addEventListener('click', async () => {
    if (confirm('確定要還原為預設 3 檔官方觀察名單 (台積電、台達電、聯發科) 嗎？')) {
      AppState.watchlist = [...DEFAULT_SYMBOLS];
      AppState.selectedSymbol = '2330';
      saveWatchlistToStorage();
      await apiGetBatchQuotes(AppState.watchlist);
      await refreshCurrentStockView();
      showToast('已還原為官方預設 3 檔股票！', 'success');
    }
  });

  // 7. 事件綁定：收合 30 天詳細數據表
  const btnToggleTable = document.getElementById('btnToggleTable');
  const drawer = document.getElementById('historyTableDrawer');

  btnToggleTable.addEventListener('click', () => {
    AppState.isHistoryTableOpen = !AppState.isHistoryTableOpen;
    if (AppState.isHistoryTableOpen) {
      drawer.classList.remove('collapsed');
      btnToggleTable.innerHTML = '收合 30 天官方歷史明細表';
    } else {
      drawer.classList.add('collapsed');
      btnToggleTable.innerHTML = '檢視 30 天官方歷史明細表';
    }
  });

  // 8. 事件綁定：複製報告
  document.getElementById('btnCopyReport').addEventListener('click', copyReportToClipboard);
}

document.addEventListener('DOMContentLoaded', initializeApp);
