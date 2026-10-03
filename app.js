/**
 * 台股趨勢分析小幫手 (Taiwan Stock Trend Analyzer)
 * 具備 30 天歷史紀錄、台指期夜盤連動比對、次日走勢預測報告與最多 10 檔股票管理
 */

// 常用台股基礎字典庫 (提供代碼、名稱與基準參考價格)
const STOCK_DICTIONARY = {
  '2330': { name: '台積電', basePrice: 980, beta: 1.35, category: '半導體權值股' },
  '2308': { name: '台達電', basePrice: 395, beta: 1.15, category: '電源散熱權值股' },
  '2454': { name: '聯發科', basePrice: 1260, beta: 1.25, category: 'IC設計權值股' },
  '2317': { name: '鴻海', basePrice: 182, beta: 1.10, category: '電子代工權值股' },
  '2603': { name: '長榮', basePrice: 192, beta: 0.85, category: '航運指標股' },
  '2382': { name: '廣達', basePrice: 275, beta: 1.30, category: 'AI伺服器指標股' },
  '2881': { name: '富邦金', basePrice: 88, beta: 0.75, category: '金融權值股' },
  '2882': { name: '國泰金', basePrice: 65, beta: 0.72, category: '金融權值股' },
  '3008': { name: '大立光', basePrice: 2480, beta: 0.95, category: '光學元件指標股' },
  '2357': { name: '華碩', basePrice: 585, beta: 1.05, category: '品牌電腦權值股' },
  '3231': { name: '緯創', basePrice: 112, beta: 1.20, category: 'AI伺服器概念股' },
  '2609': { name: '陽明', basePrice: 66, beta: 0.90, category: '航運概念股' },
  '0050': { name: '元大台灣50', basePrice: 185, beta: 1.00, category: '大盤指數型ETF' }
};

// 儲存鍵名
const STORAGE_KEY = 'TW_STOCK_ANALYSIS_STOCKS_V2';
const STORAGE_NIGHT_KEY = 'TW_STOCK_NIGHT_FUTURES_V2';

// 應用程式狀態管理
const AppState = {
  stocks: [], // 股票清單陣列 (最多 10 檔)
  selectedSymbol: '2330', // 當前選中股票代號
  nightFutures: null, // 最新台指期夜盤資訊 { price, change, changePercent, dayClose }
  chartInstance: null, // Chart.js 物件
  chartMode: 'dual', // 'dual' 雙軸價格 或 'percent' 漲跌幅對比
  isHistoryTableOpen: false
};

// 工具函式：格式化數字
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toLocaleString('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatInt(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Math.round(Number(num)).toLocaleString('zh-TW');
}

// 產生最近 30 個營業日日期清單 (由舊到新)
function generateBusinessDays(count = 30) {
  const dates = [];
  let d = new Date();
  
  // 若今天是週末，往前調
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }

  while (dates.length < count) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.unshift(`${year}/${month}/${day}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

// 產生初始的 30 天台指期與夜盤數據
function generateFuturesHistory(dates) {
  let basePoints = 23000;
  const history = [];

  for (let i = 0; i < dates.length; i++) {
    const isLatest = i === dates.length - 1;
    // 每日波動約 -180 ~ +180 點
    const dayChange = (Math.random() - 0.48) * 160;
    basePoints = Math.round(basePoints + dayChange);

    // 夜盤通常在日盤收盤後繼續交易，微幅波動
    const nightFluctuation = (Math.random() - 0.47) * 110;
    const nightPrice = Math.round(basePoints + nightFluctuation);
    const nightChange = Math.round(nightFluctuation);
    const nightChangePercent = Number(((nightChange / basePoints) * 100).toFixed(2));

    history.push({
      date: dates[i],
      dayClose: basePoints,
      nightPrice: nightPrice,
      nightChange: nightChange,
      nightChangePercent: nightChangePercent
    });
  }
  return history;
}

// 產生單一股票的 30 天歷史數據
function generateSingleStockHistory(symbol, stockInfo, dates, futuresHistory) {
  const basePrice = stockInfo.basePrice || 100;
  const beta = stockInfo.beta || 1.0;
  let currentPrice = basePrice * 0.94; // 從約一個月前價格起算
  const records = [];

  for (let i = 0; i < dates.length; i++) {
    const fut = futuresHistory[i];
    // 個股波動 = 大盤連動部分 + 個股自發性波動
    const marketEffectPct = (fut.nightChangePercent / 100) * beta;
    const idiosyncraticEffectPct = (Math.random() - 0.49) * 0.025;
    const totalChangePct = marketEffectPct + idiosyncraticEffectPct;

    const prevPrice = i === 0 ? basePrice * 0.93 : records[i - 1].closePrice;
    let close = prevPrice * (1 + totalChangePct);
    
    // 台股依股價規模有跳動單位，四捨五入到合理小數
    close = close > 100 ? Math.round(close) : Number(close.toFixed(2));
    const change = Number((close - prevPrice).toFixed(2));
    const changePercent = Number(((change / prevPrice) * 100).toFixed(2));
    const volume = Math.round((Math.random() * 25000 + 8000) * (close > 500 ? 0.3 : 1));

    records.push({
      date: dates[i],
      closePrice: close,
      change: change,
      changePercent: changePercent,
      volume: volume,
      nightFuturesPrice: fut.nightPrice,
      nightFuturesChange: fut.nightChange,
      nightFuturesChangePercent: fut.nightChangePercent
    });
  }

  return {
    symbol: symbol,
    name: stockInfo.name || `股票 ${symbol}`,
    beta: beta,
    category: stockInfo.category || '自選觀察股',
    history: records
  };
}

// 初始化預設 3 檔股票 (台積電、台達電、聯發科)
function initDefaultStocks() {
  const dates = generateBusinessDays(30);
  const futuresHistory = generateFuturesHistory(dates);

  const defaultSymbols = ['2330', '2308', '2454'];
  const stocks = defaultSymbols.map(sym => {
    const info = STOCK_DICTIONARY[sym];
    return generateSingleStockHistory(sym, info, dates, futuresHistory);
  });

  const latestFutures = futuresHistory[futuresHistory.length - 1];

  AppState.stocks = stocks;
  AppState.selectedSymbol = '2330';
  AppState.nightFutures = {
    price: latestFutures.nightPrice,
    change: latestFutures.nightChange,
    changePercent: latestFutures.nightChangePercent,
    dayClose: latestFutures.dayClose,
    dates: dates,
    futuresHistory: futuresHistory
  };

  saveToStorage();
}

// 儲存至 LocalStorage
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.stocks));
    localStorage.setItem(STORAGE_NIGHT_KEY, JSON.stringify(AppState.nightFutures));
  } catch (e) {
    console.error('儲存至 localStorage 失敗:', e);
  }
}

// 從 LocalStorage 載入
function loadFromStorage() {
  try {
    const rawStocks = localStorage.getItem(STORAGE_KEY);
    const rawNight = localStorage.getItem(STORAGE_NIGHT_KEY);

    if (rawStocks && rawNight) {
      const stocks = JSON.parse(rawStocks);
      const night = JSON.parse(rawNight);

      if (Array.isArray(stocks) && stocks.length > 0 && night && night.futuresHistory) {
        AppState.stocks = stocks;
        AppState.nightFutures = night;
        AppState.selectedSymbol = stocks[0].symbol;
        return true;
      }
    }
  } catch (e) {
    console.warn('載入快取失敗，將重新初始化:', e);
  }
  return false;
}

// 取得當前選取的股票資料
function getSelectedStock() {
  return AppState.stocks.find(s => s.symbol === AppState.selectedSymbol) || AppState.stocks[0];
}

// ==========================================================================
// 趨勢預測演算法核心 (次日走勢預測模型)
// ==========================================================================
function generatePredictionAnalysis(stock, nightFutures) {
  const history = stock.history;
  const len = history.length;
  const latest = history[len - 1];

  // 1. 計算均線：5日 MA (短線強弱)、20日 MA (月線防守)
  const last5 = history.slice(Math.max(0, len - 5));
  const ma5 = last5.reduce((sum, item) => sum + item.closePrice, 0) / last5.length;

  const last20 = history.slice(Math.max(0, len - 20));
  const ma20 = last20.reduce((sum, item) => sum + item.closePrice, 0) / last20.length;

  // 2. 計算 30 日最高價、最低價
  const prices = history.map(h => h.closePrice);
  const high30 = Math.max(...prices);
  const low30 = Math.min(...prices);

  // 3. 夜盤連動推算
  const nightChangePct = nightFutures.changePercent; // 例如 +0.54%
  const beta = stock.beta || 1.1;
  // 預估大盤連動造成的開盤跳空幅度
  const estimatedGapPct = (nightChangePct * beta);
  const estimatedOpenPrice = Number((latest.closePrice * (1 + estimatedGapPct / 100)).toFixed(2));

  // 4. 乖離率 BIAS 計算
  const bias5 = Number((((latest.closePrice - ma5) / ma5) * 100).toFixed(2));
  const bias20 = Number((((latest.closePrice - ma20) / ma20) * 100).toFixed(2));

  // 5. 支撐位與壓力位估算
  // 支撐位：取 MA5 或 最近 5 日最低點之防守位
  const recent5Min = Math.min(...last5.map(d => d.closePrice));
  const supportPrice = Number(Math.min(ma5, recent5Min * 0.995).toFixed(2));

  // 壓力位：取近期波段高點或預估開高衝刺區
  const recent5Max = Math.max(...last5.map(d => d.closePrice));
  const resistancePrice = Number(Math.max(recent5Max * 1.015, high30 * 0.99).toFixed(2));

  // 6. 綜合多空信心評分 (0 ~ 100)
  let score = 50; // 中性基準
  // 夜盤影響 (權重 40%)
  score += (nightChangePct * 15 * (beta >= 1.2 ? 1.2 : 1.0));
  // 均線排列 (權重 30%)
  if (latest.closePrice > ma5) score += 12; else score -= 12;
  if (latest.closePrice > ma20) score += 8; else score -= 8;
  // 短線乖離是否過熱
  if (bias5 > 4.5) score -= 8; // 過熱回檔風險
  if (bias5 < -4.5) score += 8; // 超跌反彈機會

  // 限制分數區間
  score = Math.max(10, Math.min(95, Math.round(score)));

  // 走勢類別研判
  let trendType = '';
  let trendPillClass = '';
  let trendSummary = '';

  if (score >= 75) {
    trendType = '強勢看多・開高挑戰壓力';
    trendPillClass = 'pred-pill-bullish';
    trendSummary = '受台指期夜盤顯著走揚帶動，加上短線技術均線呈現強勢多頭排列，次日早盤極高機率開高表態，若開盤量能放大有望強勢向上挑戰上檔壓力位。';
  } else if (score >= 58) {
    trendType = '震盪偏多・逢低有撐';
    trendPillClass = 'pred-pill-bullish';
    trendSummary = '夜盤行情偏暖或處於正向價差，提供早盤多頭信心支撐。預估次日將呈現平高開出後之震盪攻堅行情，下檔 5 日線具備穩健支撐力道。';
  } else if (score >= 42) {
    trendType = '箱型整理・高出低進';
    trendPillClass = 'pred-pill-neutral';
    trendSummary = '夜盤呈現小幅震盪膠著，個股股價與短期均線緊密糾結。預期次一個交易日多空雙方將在預估支撐與壓力區間內進行籌碼換手洗盤。';
  } else if (score >= 26) {
    trendType = '震盪拉回・回測支撐';
    trendPillClass = 'pred-pill-bearish';
    trendSummary = '受夜盤拉回或短線乖離率修正影響，開盤可能面臨賣壓測試。建議留意回測支撐價位時之量能萎縮狀況，不宜躁進追價。';
  } else {
    trendType = '弱勢避險・防守觀望';
    trendPillClass = 'pred-pill-bearish';
    trendSummary = '夜盤重挫或期貨逆價差擴大，市場避險情緒升溫。次日開盤恐跳空開低，短線技術指標偏弱，操作宜嚴守停損點並保持防禦性思維。';
  }

  return {
    ma5,
    ma20,
    high30,
    low30,
    bias5,
    bias20,
    supportPrice,
    resistancePrice,
    estimatedOpenPrice,
    estimatedGapPct,
    score,
    trendType,
    trendPillClass,
    trendSummary,
    latest,
    nightChangePct,
    beta
  };
}

// ==========================================================================
// UI 渲染函式群
// ==========================================================================

// 更新頂部夜盤列
function renderHeaderNightBar() {
  const nf = AppState.nightFutures;
  if (!nf) return;

  const priceEl = document.getElementById('headerNightPrice');
  const changeEl = document.getElementById('headerNightChange');

  priceEl.textContent = formatInt(nf.price);
  
  const sign = nf.change > 0 ? '+' : '';
  changeEl.textContent = `${sign}${formatInt(nf.change)} (${sign}${nf.changePercent}%)`;
  
  changeEl.className = 'night-change ' + (nf.change > 0 ? 'change-up' : (nf.change < 0 ? 'change-down' : 'change-flat'));
}

// 渲染觀察名單卡片標籤 (Watchlist Tabs)
function renderWatchlistTabs() {
  const tabsContainer = document.getElementById('watchlistTabs');
  const counterEl = document.getElementById('stockCounter');
  const addBtn = document.getElementById('btnAddStock');

  tabsContainer.innerHTML = '';
  counterEl.textContent = `${AppState.stocks.length} / 10 檔`;

  if (AppState.stocks.length >= 10) {
    addBtn.disabled = true;
    addBtn.title = '已達觀察名單上限 (最多 10 檔)';
  } else {
    addBtn.disabled = false;
    addBtn.title = '新增觀察股票';
  }

  AppState.stocks.forEach(stock => {
    const latest = stock.history[stock.history.length - 1];
    const isSelected = stock.symbol === AppState.selectedSymbol;
    const isUp = latest.change > 0;
    const isDown = latest.change < 0;
    const sign = isUp ? '+' : '';

    const tab = document.createElement('div');
    tab.className = `stock-tab ${isSelected ? 'active' : ''}`;
    tab.dataset.symbol = stock.symbol;

    tab.innerHTML = `
      <div class="stock-tab-info">
        <div class="stock-tab-top">
          <span class="stock-tab-name">${stock.name}</span>
          <span class="stock-tab-code">${stock.symbol}</span>
        </div>
        <div class="stock-tab-price">
          ${formatNumber(latest.closePrice)}
          <span class="stock-tab-change ${isUp ? 'text-up' : (isDown ? 'text-down' : 'text-flat')}">
            ${sign}${formatNumber(latest.change)} (${sign}${latest.changePercent}%)
          </span>
        </div>
      </div>
      <button class="btn-remove-stock" data-symbol="${stock.symbol}" title="自觀察名單移除 ${stock.name}">
        &times;
      </button>
    `;

    // 點選切換個股
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-stock')) return;
      selectStock(stock.symbol);
    });

    // 刪除按鈕
    const removeBtn = tab.querySelector('.btn-remove-stock');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeStock(stock.symbol);
    });

    tabsContainer.appendChild(tab);
  });
}

// 渲染核心數據指標卡片 (Metric Cards)
function renderMetricCards(stock, pred) {
  const latest = pred.latest;
  const nf = AppState.nightFutures;

  // 卡片 1：個股收盤
  document.getElementById('currentStockSymbol').textContent = stock.symbol;
  document.getElementById('currentStockName').textContent = stock.name;
  document.getElementById('metricStockPrice').textContent = formatNumber(latest.closePrice);

  const isUp = latest.change > 0;
  const isDown = latest.change < 0;
  const sign = isUp ? '+' : '';
  const changeEl = document.getElementById('metricStockChange');
  changeEl.textContent = `${sign}${formatNumber(latest.change)} (${sign}${latest.changePercent}%)`;
  changeEl.className = 'change-tag ' + (isUp ? 'change-up' : (isDown ? 'change-down' : 'change-flat'));

  document.getElementById('metricStockHigh').textContent = formatNumber(pred.high30);
  document.getElementById('metricStockLow').textContent = formatNumber(pred.low30);
  document.getElementById('metricStockVol').textContent = `${formatInt(latest.volume)} 張`;

  // 卡片 2：夜盤比對
  document.getElementById('metricNightPrice').textContent = formatInt(nf.price);
  const nSign = nf.change > 0 ? '+' : '';
  const nChangeEl = document.getElementById('metricNightChange');
  nChangeEl.textContent = `${nSign}${formatInt(nf.change)} 點 (${nSign}${nf.changePercent}%)`;
  nChangeEl.className = 'change-tag ' + (nf.change > 0 ? 'change-up' : (nf.change < 0 ? 'change-down' : 'change-flat'));

  document.getElementById('metricDayClose').textContent = `${formatInt(nf.dayClose)} 點`;
  const spread = nf.price - nf.dayClose;
  const spreadSign = spread > 0 ? '+' : '';
  document.getElementById('metricFuturesSpread').textContent = `${spreadSign}${formatInt(spread)} 點 (${spread >= 0 ? '正價差' : '逆價差'})`;
  document.getElementById('metricStockBeta').textContent = `${stock.beta.toFixed(2)} (${stock.beta >= 1.2 ? '高連動' : '穩健防禦'})`;

  // 卡片 3：次日走勢研判速覽
  const badge = document.getElementById('quickPredictionBadge');
  badge.textContent = pred.trendType;
  badge.className = `prediction-pill ${pred.trendPillClass}`;

  document.getElementById('predOpenPrice').textContent = `${formatNumber(pred.estimatedOpenPrice)} 元`;
  document.getElementById('predSupportPrice').textContent = `${formatNumber(pred.supportPrice)} 元`;
  document.getElementById('predResistancePrice').textContent = `${formatNumber(pred.resistancePrice)} 元`;

  const sentimentBar = document.getElementById('sentimentBar');
  const sentimentText = document.getElementById('sentimentText');
  sentimentBar.style.width = `${pred.score}%`;
  sentimentText.textContent = `${pred.score}分 (${pred.score >= 60 ? '偏多' : (pred.score <= 40 ? '偏空' : '中性')})`;
}

// 渲染 Chart.js 趨勢圖表
function renderTrendChart(stock) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const history = stock.history;
  const labels = history.map(h => h.date);

  const stockPrices = history.map(h => h.closePrice);
  const nightPoints = history.map(h => h.nightFuturesPrice);

  // 若為百分比對比模式，以 30 天前作為基準 (0%)
  const baseStock = stockPrices[0];
  const baseNight = nightPoints[0];
  const stockPercents = stockPrices.map(p => Number((((p - baseStock) / baseStock) * 100).toFixed(2)));
  const nightPercents = nightPoints.map(p => Number((((p - baseNight) / baseNight) * 100).toFixed(2)));

  const isDual = AppState.chartMode === 'dual';

  document.getElementById('chartSubtitleDesc').textContent = isDual
    ? `左軸：${stock.name} 收盤股價 (TWD)；右軸：台指期夜盤點數 (點) — 30天雙軸趨勢`
    : `以 30 個交易日前為基準 0%，比對 ${stock.name} 與台指期夜盤之累積漲跌幅 (%)`;

  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
  }

  const datasets = isDual ? [
    {
      label: `${stock.name} (${stock.symbol}) 收盤價`,
      data: stockPrices,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.25,
      yAxisID: 'y'
    },
    {
      label: '台指期夜盤指數',
      data: nightPoints,
      borderColor: '#a855f7',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 2.5,
      pointHoverRadius: 5,
      tension: 0.25,
      yAxisID: 'y1'
    }
  ] : [
    {
      label: `${stock.name} 相對漲跌幅 (%)`,
      data: stockPercents,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      borderWidth: 2.5,
      pointRadius: 3,
      fill: true,
      tension: 0.25,
      yAxisID: 'y'
    },
    {
      label: '台指期夜盤 相對漲跌幅 (%)',
      data: nightPercents,
      borderColor: '#a855f7',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 2.5,
      tension: 0.25,
      yAxisID: 'y'
    }
  ];

  const scalesConfig = isDual ? {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: {
        color: '#9ca3af',
        maxRotation: 45,
        autoSkip: true,
        maxTicksLimit: 12
      }
    },
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: `${stock.name} 股價 (TWD)`,
        color: '#60a5fa'
      },
      grid: { color: 'rgba(255, 255, 255, 0.06)' },
      ticks: { color: '#93c5fd' }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: '台指期夜盤點數 (Pts)',
        color: '#c084fc'
      },
      grid: { drawOnChartArea: false },
      ticks: { color: '#c084fc' }
    }
  } : {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#9ca3af', maxTicksLimit: 12 }
    },
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: '累積報酬率 / 相對漲跌幅 (%)',
        color: '#e5e7eb'
      },
      grid: { color: 'rgba(255, 255, 255, 0.06)' },
      ticks: {
        color: '#e5e7eb',
        callback: value => `${value}%`
      }
    }
  };

  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
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
              const unit = isDual ? (context.datasetIndex === 0 ? ' 元' : ' 點') : ' %';
              return `${context.dataset.label}: ${context.parsed.y}${unit}`;
            }
          }
        }
      },
      scales: scalesConfig
    }
  });
}

// 渲染 30 天詳細數據表格
function renderHistoryTable(stock) {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  // 遞減排序 (最新日期在最上方)
  const reversed = [...stock.history].reverse();

  reversed.forEach(row => {
    const tr = document.createElement('tr');
    const isUp = row.change > 0;
    const isDown = row.change < 0;
    const sign = isUp ? '+' : '';

    const futSign = row.nightFuturesChange > 0 ? '+' : '';
    const futClass = row.nightFuturesChange > 0 ? 'text-up' : (row.nightFuturesChange < 0 ? 'text-down' : 'text-flat');

    // 價差粗估
    const spread = row.nightFuturesPrice - (row.nightFuturesPrice - row.nightFuturesChange);

    tr.innerHTML = `
      <td><strong>${row.date}</strong></td>
      <td>${formatNumber(row.closePrice)} 元</td>
      <td class="${isUp ? 'text-up' : (isDown ? 'text-down' : 'text-flat')}">
        ${sign}${formatNumber(row.change)} (${sign}${row.changePercent}%)
      </td>
      <td>${formatInt(row.nightFuturesPrice)} 點</td>
      <td class="${futClass}">
        ${futSign}${formatInt(row.nightFuturesChange)} (${futSign}${row.nightFuturesChangePercent}%)
      </td>
      <td>${futSign}${formatInt(spread)} 點</td>
      <td>${formatInt(row.volume)} 張</td>
    `;
    tbody.appendChild(tr);
  });
}

// 渲染次日預測分析報告
function renderReport(stock, pred) {
  const nf = AppState.nightFutures;
  const latest = pred.latest;

  document.getElementById('reportStockName').textContent = `${stock.name} (${stock.symbol})`;
  document.getElementById('reportGenDate').textContent = latest.date;

  // 1. 夜盤連動分析
  const nSign = nf.change > 0 ? '+' : '';
  const gapDir = nf.change > 0 ? '正面提振' : (nf.change < 0 ? '承壓拉回' : '持平觀望');
  const pointDiff = (latest.closePrice * (pred.estimatedGapPct / 100)).toFixed(1);

  document.getElementById('reportNightAnalysis').innerHTML = `
    <p>
      最新台指期夜盤報價收在 <strong>${formatInt(nf.price)} 點</strong>，較日盤變動 
      <span class="${nf.change > 0 ? 'text-up' : 'text-down'}">${nSign}${formatInt(nf.change)} 點 (${nSign}${nf.changePercent}%)</span>。
      依據個股市場敏感度係數（Beta = <strong>${stock.beta.toFixed(2)}</strong>）換算：
    </p>
    <ul style="margin: 0.6rem 0 0.6rem 1.2rem;">
      <li>夜盤對 ${stock.name} 之預估開盤跳空貢獻度約為 <strong>${nSign}${pred.estimatedGapPct.toFixed(2)}%</strong>（約合 <strong>${nSign}${pointDiff} 元</strong>）。</li>
      <li>市場多空結構呈現<strong>${gapDir}</strong>態勢，期現貨價差維持在合理區間，提供次日早盤開盤定錨效應。</li>
    </ul>
  `;

  // 2. 30日技術型態
  const maState = latest.closePrice >= pred.ma5 ? '站上 5 日均線 (短多格局)' : '跌破 5 日均線 (短線整理)';
  const ma20State = latest.closePrice >= pred.ma20 ? '月線 (MA20) 之上中多延續' : '月線 (MA20) 之下進入防守';

  document.getElementById('reportTechAnalysis').innerHTML = `
    <p>
      截至最近交易日收盤價 <strong>${formatNumber(latest.closePrice)} 元</strong>，關鍵技術指標解析如下：
    </p>
    <ul style="margin: 0.6rem 0 0.6rem 1.2rem;">
      <li><strong>5日短期均線 (MA5)：</strong> ${formatNumber(pred.ma5)} 元 — 股價現況為 <em>${maState}</em>。</li>
      <li><strong>20日月均線 (MA20)：</strong> ${formatNumber(pred.ma20)} 元 — <em>${ma20State}</em>。</li>
      <li><strong>短線乖離率 (BIAS)：</strong> 5日乖離為 <strong>${pred.bias5}%</strong>；20日乖離為 <strong>${pred.bias20}%</strong>${Math.abs(pred.bias5) > 4 ? '，留意短線技術性收斂' : '，處於健康運行軌道'}。</li>
      <li><strong>30天區間界限：</strong> 波段高點 <strong>${formatNumber(pred.high30)} 元</strong>，下檔鐵板 <strong>${formatNumber(pred.low30)} 元</strong>。</li>
    </ul>
  `;

  // 3. 次日情境推演
  document.getElementById('reportScenarioAnalysis').innerHTML = `
    <p style="margin-bottom: 0.5rem;">
      <strong>預測評等：</strong> <span class="report-highlight-pill ${pred.trendPillClass}">${pred.trendType}</span>
    </p>
    <p style="margin-bottom: 0.6rem;">${pred.trendSummary}</p>
    <div style="background: rgba(0,0,0,0.25); padding: 0.6rem 0.8rem; border-radius: 6px;">
      <div>• <strong>預估次日開盤區間：</strong> ${formatNumber(pred.estimatedOpenPrice * 0.997)} ~ ${formatNumber(pred.estimatedOpenPrice * 1.003)} 元 (中值 ${formatNumber(pred.estimatedOpenPrice)} 元)</div>
      <div>• <strong>上檔第一壓力價位：</strong> ${formatNumber(pred.resistancePrice)} 元 (前波高點或突破防守線)</div>
      <div>• <strong>下檔第一支撐價位：</strong> ${formatNumber(pred.supportPrice)} 元 (短期均線或整數防線)</div>
    </div>
  `;

  // 4. 操作策略建議
  let strategyText = '';
  if (pred.score >= 60) {
    strategyText = `
      短線積極型投資人可趁早盤若有小幅拉回測支撐（約 ${formatNumber(pred.supportPrice)} 元）不破時分批布局；
      波段持有者續抱，設定移動停利點於 5 日線 (${formatNumber(pred.ma5)} 元)；
      若早盤強行跳空直衝 ${formatNumber(pred.resistancePrice)} 元壓力區，不宜盲目過度追價，提防衝高爆量後之引線震盪。
    `;
  } else if (pred.score <= 40) {
    strategyText = `
      短線操作應以保守防禦為主，若持股部位較高可於開盤反彈無力時適度調節降低槓桿；
      密切觀察下檔支撐位 ${formatNumber(pred.supportPrice)} 元之防守力道，若跌破且量能擴大應嚴格執行停損防守紀律；
      空手者建議靜待夜盤落底信號出現與回測均線有撐後再行評估。
    `;
  } else {
    strategyText = `
      當前多空力量呈現拉鋸整理，建議採取「箱型區間操作」策略；
      區間下緣 ${formatNumber(pred.supportPrice)} 元附近分批低接，逼近上緣 ${formatNumber(pred.resistancePrice)} 元時調節分批獲利了結；
      部位規模宜控制在 5 成以內，靜待台指期夜盤突破盤整區間方向確立。
    `;
  }

  document.getElementById('reportActionStrategy').innerHTML = `
    <p style="margin-bottom: 0.5rem;">${strategyText}</p>
    <div style="font-size: 0.78rem; color: #94a3b8; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem; margin-top: 0.5rem;">
      ★ 核心風控防線：<strong>${formatNumber(pred.supportPrice * 0.985)} 元</strong>（跌破建議果斷減碼退場）。
    </div>
  `;
}

// 刷新全介面渲染
function updateDashboard() {
  renderHeaderNightBar();
  renderWatchlistTabs();

  const stock = getSelectedStock();
  if (!stock) return;

  const pred = generatePredictionAnalysis(stock, AppState.nightFutures);

  renderMetricCards(stock, pred);
  renderTrendChart(stock);
  renderHistoryTable(stock);
  renderReport(stock, pred);
}

// 選取指定股票
function selectStock(symbol) {
  AppState.selectedSymbol = symbol;
  updateDashboard();
}

// 新增股票至觀察名單
function addStock(inputVal) {
  const query = (inputVal || '').trim();
  if (!query) {
    showToast('請輸入股票代碼或名稱！', 'warn');
    return;
  }

  if (AppState.stocks.length >= 10) {
    showToast('觀察名單上限為 10 檔，請先刪除既有名單再新增！', 'warn');
    return;
  }

  // 解析代號與名稱 (支援 "2317 鴻海" 或 "2317" 或 "鴻海")
  let symbol = '';
  let name = '';
  let basePrice = 150;
  let beta = 1.0;
  let category = '自選權值股';

  // 嘗試從字典中匹配
  for (const [code, info] of Object.entries(STOCK_DICTIONARY)) {
    if (query.includes(code) || query.includes(info.name)) {
      symbol = code;
      name = info.name;
      basePrice = info.basePrice;
      beta = info.beta;
      category = info.category;
      break;
    }
  }

  // 若不在預設字典中，嘗試提取數字代碼或自定義
  if (!symbol) {
    const codeMatch = query.match(/\d{4,6}/);
    if (codeMatch) {
      symbol = codeMatch[0];
      name = query.replace(symbol, '').trim() || `個股 ${symbol}`;
      basePrice = Math.floor(Math.random() * 200 + 50);
      beta = Number((Math.random() * 0.8 + 0.7).toFixed(2));
    } else {
      // 純文字名稱
      symbol = String(Math.floor(Math.random() * 8000 + 1000));
      name = query;
      basePrice = 120;
      beta = 1.05;
    }
  }

  // 檢查是否已存在
  const exists = AppState.stocks.some(s => s.symbol === symbol);
  if (exists) {
    showToast(`股票 ${name} (${symbol}) 已經在您的觀察名單中！`, 'warn');
    selectStock(symbol);
    return;
  }

  // 根據當前系統營業日與台指期夜盤歷史，生成該檔股票的 30 天數據
  const dates = AppState.nightFutures.dates || generateBusinessDays(30);
  const futuresHistory = AppState.nightFutures.futuresHistory;
  const newStockData = generateSingleStockHistory(symbol, { name, basePrice, beta, category }, dates, futuresHistory);

  AppState.stocks.push(newStockData);
  AppState.selectedSymbol = symbol;
  saveToStorage();
  updateDashboard();

  showToast(`已成功新增【${name} (${symbol})】至觀察名單！`, 'success');
  document.getElementById('stockInput').value = '';
}

// 自觀察名單移除股票
function removeStock(symbol) {
  if (AppState.stocks.length <= 1) {
    showToast('觀察名單至少需保留 1 檔股票！', 'warn');
    return;
  }

  const target = AppState.stocks.find(s => s.symbol === symbol);
  const targetName = target ? target.name : symbol;

  AppState.stocks = AppState.stocks.filter(s => s.symbol !== symbol);

  // 若刪除的是當前選取的股票，切換到第一檔
  if (AppState.selectedSymbol === symbol) {
    AppState.selectedSymbol = AppState.stocks[0].symbol;
  }

  saveToStorage();
  updateDashboard();
  showToast(`已自觀察名單移除【${targetName}】`, 'info');
}

// 模擬夜盤行情波動 (即時更新)
function simulateNightFuturesShift() {
  const nf = AppState.nightFutures;
  // 模擬波動 -150 ~ +150 點
  const deltaPoints = Math.round((Math.random() - 0.48) * 140);
  nf.price += deltaPoints;
  nf.change += deltaPoints;
  nf.changePercent = Number(((nf.change / nf.dayClose) * 100).toFixed(2));

  // 同步更新每檔股票最新一天的夜盤資料
  AppState.stocks.forEach(stk => {
    const last = stk.history[stk.history.length - 1];
    last.nightFuturesPrice = nf.price;
    last.nightFuturesChange = nf.change;
    last.nightFuturesChangePercent = nf.changePercent;
  });

  saveToStorage();
  updateDashboard();
  showToast(`台指期夜盤行情已即時模擬更新 (點數變動: ${deltaPoints > 0 ? '+' : ''}${deltaPoints})`, 'info');
}

// 複製完整分析報告至剪貼簿
function copyReportToClipboard() {
  const stock = getSelectedStock();
  const pred = generatePredictionAnalysis(stock, AppState.nightFutures);
  const nf = AppState.nightFutures;

  const text = `
【台股趨勢分析小幫手 - 智慧預測分析報告】
=========================================
觀察個股：${stock.name} (${stock.symbol})
分析日期：${pred.latest.date}
最新收盤：${formatNumber(pred.latest.closePrice)} 元 (${pred.latest.change > 0 ? '+' : ''}${pred.latest.change} 元 / ${pred.latest.changePercent}%)
台指期夜盤：${formatInt(nf.price)} 點 (${nf.change > 0 ? '+' : ''}${formatInt(nf.change)} 點 / ${nf.changePercent}%)
期現價差：${formatInt(nf.price - nf.dayClose)} 點 (Beta連動係數: ${stock.beta.toFixed(2)})
-----------------------------------------
【次一交易日預測速覽】
• 研判結論：${pred.trendType}
• 多空信心評分：${pred.score} 分
• 預估開盤參考價：${formatNumber(pred.estimatedOpenPrice)} 元
• 預估下檔支撐位：${formatNumber(pred.supportPrice)} 元
• 預估上檔壓力位：${formatNumber(pred.resistancePrice)} 元
-----------------------------------------
【技術面與情境簡析】
${pred.trendSummary}
5日均線: ${formatNumber(pred.ma5)} 元 | 20日月線: ${formatNumber(pred.ma20)} 元
-----------------------------------------
免責聲明：本報告為演算法量化模擬參考，非投資操作建議。
=========================================
`.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已複製分析報告至剪貼簿！', 'success');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast('已複製分析報告至剪貼簿！', 'success');
}

// 顯示 Toast 訊息
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ==========================================================================
// 事件監聽與應用程式啟動初始化
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. 載入資料或初始化預設三檔 (台積電、台達電、聯發科)
  const hasLoaded = loadFromStorage();
  if (!hasLoaded) {
    initDefaultStocks();
  }

  // 2. 初始畫面渲染
  updateDashboard();

  // 3. 事件綁定：新增股票按鈕與 Enter 鍵
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

  // 4. 事件綁定：還原預設股票清單
  document.getElementById('btnResetDefault').addEventListener('click', () => {
    if (confirm('確定要還原為預設名單 (台積電、台達電、聯發科) 嗎？')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_NIGHT_KEY);
      initDefaultStocks();
      updateDashboard();
      showToast('已成功還原為預設 3 檔股票！', 'success');
    }
  });

  // 5. 事件綁定：模擬夜盤行情按鈕
  document.getElementById('btnSimulateNight').addEventListener('click', () => {
    simulateNightFuturesShift();
  });

  // 6. 事件綁定：圖表模式切換 (雙軸價格 vs 漲跌幅百分比)
  const btnDual = document.getElementById('btnModeDual');
  const btnPercent = document.getElementById('btnModePercent');

  btnDual.addEventListener('click', () => {
    btnDual.classList.add('active');
    btnPercent.classList.remove('active');
    AppState.chartMode = 'dual';
    renderTrendChart(getSelectedStock());
  });

  btnPercent.addEventListener('click', () => {
    btnPercent.classList.add('active');
    btnDual.classList.remove('active');
    AppState.chartMode = 'percent';
    renderTrendChart(getSelectedStock());
  });

  // 7. 事件綁定：開關 30 天詳細數據表格抽屜
  const btnToggleTable = document.getElementById('btnToggleTable');
  const drawer = document.getElementById('historyTableDrawer');

  btnToggleTable.addEventListener('click', () => {
    AppState.isHistoryTableOpen = !AppState.isHistoryTableOpen;
    if (AppState.isHistoryTableOpen) {
      drawer.classList.remove('collapsed');
      btnToggleTable.classList.add('active');
      btnToggleTable.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        收合 30 天詳細數據表
      `;
    } else {
      drawer.classList.add('collapsed');
      btnToggleTable.classList.remove('active');
      btnToggleTable.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        檢視 30 天詳細數據表
      `;
    }
  });

  // 8. 事件綁定：複製報告按鈕
  document.getElementById('btnCopyReport').addEventListener('click', copyReportToClipboard);
});
