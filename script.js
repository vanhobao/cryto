// Khai báo các constructor chỉ báo từ thư viện
const { SMA, EMA, BollingerBands, Stochastic, WilliamsR, RSI, CCI, OBV, ADL } = technicalindicators;

// Biến cho biểu đồ và series
let mainChart = null, candleSeries = null;
let maSeries1 = null, maSeries2 = null, bbSeries = { upper: null, middle: null, lower: null };

let indicatorPane1 = null, stochSeriesK = null, stochSeriesD = null, wpr14PaneSeries = null, wpr50PaneSeries = null;
let indicatorPane2 = null, cci1PaneSeries = null, obvPaneSeries = null, adlPaneSeries = null;
let indicatorPane3 = null, cci2PaneSeries = null, rsiPaneSeries = null;

let currentKlineData = []; // Dữ liệu nến hiện tại
let currentIndicatorParams = {}; // Thông số chỉ báo hiện tại, sẽ được load từ default

// DOM Elements
const symbolSelect = document.getElementById('symbol-select');
const intervalSelect = document.getElementById('interval-select');
const refreshButton = document.getElementById('refresh-chart');
const loadingIndicator = document.getElementById('loading-indicator');
const dataStatusElement = document.getElementById('data-status');
const marketWatchListEl = document.getElementById('market-watch-list');
const marketWatchSearchEl = document.getElementById('market-watch-search');

const indicatorSettingsButton = document.getElementById('indicator-settings-button');
const indicatorSettingsModal = document.getElementById('indicator-settings-modal');
const closeSettingsModalButton = document.getElementById('close-settings-modal');
const applyIndicatorSettingsButton = document.getElementById('apply-indicator-settings');
const resetIndicatorSettingsButton = document.getElementById('reset-indicator-settings');
const indicatorParamsForm = document.getElementById('indicator-params-form');

// Thông số chỉ báo mặc định
const defaultIndicatorParams = {
    ma1: { name: 'Moving Average 1', enabled: true, period: 20, type: 'SMA', color: '#22c55e' }, // Xanh lá
    ma2: { name: 'Moving Average 2', enabled: true, period: 50, type: 'SMA', color: '#ef4444' }, // Đỏ
    bb: { name: 'Bollinger Bands', enabled: true, period: 20, stdDev: 2, upperColor: '#3b82f6', middleColor: '#fbbf24', lowerColor: '#3b82f6' },
    stochastic: { name: 'Stochastic (K,D,Slowing)', enabled: true, kPeriod: 4, dPeriod: 2, slowingPeriod: 2, kColor: '#38bdf8', dColor: '#f43f5e' },
    wpr14: { name: 'Williams %R (14)', enabled: true, period: 14, color: '#a78bfa' },
    wpr50: { name: 'Williams %R (50)', enabled: true, period: 50, color: '#facc15' },
    cci1: { name: 'CCI (Cửa sổ 2)', enabled: true, period: 20, color: '#10b981' },
    obv: { name: 'On Balance Volume', enabled: true, color: '#60a5fa' },
    adl: { name: 'Accumulation/Distribution', enabled: true, color: '#f97316' },
    cci2: { name: 'CCI (Cửa sổ 3)', enabled: true, period: 14, color: '#8b5cf6' },
    rsi: { name: 'Relative Strength Index', enabled: true, period: 14, color: '#ec4899' }
};

function initializeIndicatorParams() {
    // Load từ localStorage nếu có, nếu không thì dùng default
    const savedParams = localStorage.getItem('cryptoChartIndicatorParams');
    if (savedParams) {
        currentIndicatorParams = JSON.parse(savedParams);
        // Đảm bảo tất cả các key từ default đều có, phòng trường hợp thêm chỉ báo mới
        for (const key in defaultIndicatorParams) {
            if (!currentIndicatorParams[key]) {
                currentIndicatorParams[key] = JSON.parse(JSON.stringify(defaultIndicatorParams[key]));
            }
             // Đảm bảo tất cả các thuộc tính của default có trong current, phòng trường hợp thêm thuộc tính mới vào default
            for (const propKey in defaultIndicatorParams[key]) {
                if (currentIndicatorParams[key][propKey] === undefined) {
                    currentIndicatorParams[key][propKey] = defaultIndicatorParams[key][propKey];
                }
            }
        }
    } else {
        currentIndicatorParams = JSON.parse(JSON.stringify(defaultIndicatorParams)); // Deep copy
    }
}

function saveIndicatorParams() {
    localStorage.setItem('cryptoChartIndicatorParams', JSON.stringify(currentIndicatorParams));
}

const chartBaseProperties = {
    layout: { background: { type: 'solid', color: '#111827' }, textColor: '#D1D5DB' },
    grid: { vertLines: { color: '#2d3748' }, horzLines: { color: '#2d3748' } }, // Màu lưới xám hơn
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    priceScale: { borderColor: '#4A5568', autoScale: true, },
    timeScale: { borderColor: '#4A5568', timeVisible: true, secondsVisible: false, rightOffset: 12, barSpacing: 10 }
};

function addIndicatorNameOverlay(paneElement, text) {
    let overlay = paneElement.querySelector('.indicator-name-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'indicator-name-overlay';
        paneElement.appendChild(overlay);
    }
    overlay.textContent = text;
}

function createCharts() {
    const mainChartContainer = document.getElementById('chart-container');
    mainChart = LightweightCharts.createChart(mainChartContainer, { ...chartBaseProperties, width: mainChartContainer.clientWidth, height: mainChartContainer.clientHeight });
    candleSeries = mainChart.addCandlestickSeries({ upColor: '#10B981', downColor: '#F43F5E', borderDownColor: '#F43F5E', borderUpColor: '#10B981', wickDownColor: '#F43F5E', wickUpColor: '#10B981' });

    const indicatorPaneEl1 = document.getElementById('indicator-pane-1');
    indicatorPane1 = LightweightCharts.createChart(indicatorPaneEl1, { ...chartBaseProperties, width: indicatorPaneEl1.clientWidth, height: indicatorPaneEl1.clientHeight, timeScale: { visible: false } });
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if(indicatorPane1 && range) indicatorPane1.timeScale().setVisibleLogicalRange(range); });

    const indicatorPaneEl2 = document.getElementById('indicator-pane-2');
    indicatorPane2 = LightweightCharts.createChart(indicatorPaneEl2, { ...chartBaseProperties, width: indicatorPaneEl2.clientWidth, height: indicatorPaneEl2.clientHeight, timeScale: { visible: false } });
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if(indicatorPane2 && range) indicatorPane2.timeScale().setVisibleLogicalRange(range); });
    
    const indicatorPaneEl3 = document.getElementById('indicator-pane-3');
    indicatorPane3 = LightweightCharts.createChart(indicatorPaneEl3, { ...chartBaseProperties, width: indicatorPaneEl3.clientWidth, height: indicatorPaneEl3.clientHeight, timeScale: { visible: false } });
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if(indicatorPane3 && range) indicatorPane3.timeScale().setVisibleLogicalRange(range); });
}

async function fetchCandlestickData(symbol, interval) {
    loadingIndicator.classList.remove('hidden');
    dataStatusElement.textContent = `Đang tải ${symbol}...`;
    try {
        const endTime = Date.now();
        const startTime = endTime - (2000 * intervalToMilliseconds(interval)); // Lấy nhiều nến hơn
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
        if (!response.ok) throw new Error(`Lỗi API Binance: ${response.status} (${response.statusText})`);
        const data = await response.json();
        currentKlineData = data.map(d => ({ time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]) }));
        dataStatusElement.textContent = `Đã tải ${currentKlineData.length} nến cho ${symbol} (${interval})`;
        return currentKlineData;
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu nến:", error);
        dataStatusElement.textContent = `Lỗi tải ${symbol}: ${error.message}`;
        // alert(`Không thể tải dữ liệu cho ${symbol}: ${error.message}`);
        return [];
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function intervalToMilliseconds(interval) { // Hàm trợ giúp
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    if (unit === 'w') return value * 7 * 24 * 60 * 60 * 1000;
    if (unit === 'M') return value * 30 * 24 * 60 * 60 * 1000; // Ước lượng
    return 15 * 60 * 1000; // Mặc định 15m
}


function calculateAndDrawIndicators(klineData) {
    if (!klineData || klineData.length === 0) return;
    const closes = klineData.map(d => d.close);
    const highs = klineData.map(d => d.high);
    const lows = klineData.map(d => d.low);
    const opens = klineData.map(d => d.open);
    const volumes = klineData.map(d => d.volume);

    // Clear existing series
    [maSeries1, maSeries2, bbSeries.upper, bbSeries.middle, bbSeries.lower, 
     stochSeriesK, stochSeriesD, wpr14PaneSeries, wpr50PaneSeries,
     cci1PaneSeries, obvPaneSeries, adlPaneSeries,
     cci2PaneSeries, rsiPaneSeries].forEach(series => {
        if (series) {
            if (series.chart) series.chart().removeSeries(series); // Lightweight Charts v3+
            else if (series.priceScale) series.priceScale().chart().removeSeries(series); // Older or different access
        }
    });
    maSeries1 = null; maSeries2 = null; bbSeries = {}; 
    stochSeriesK = null; stochSeriesD = null; wpr14PaneSeries = null; wpr50PaneSeries = null;
    cci1PaneSeries = null; obvPaneSeries = null; adlPaneSeries = null;
    cci2PaneSeries = null; rsiPaneSeries = null;


    // MA1
    const pMa1 = currentIndicatorParams.ma1;
    if (pMa1.enabled && closes.length >= pMa1.period) {
        maSeries1 = mainChart.addLineSeries({ color: pMa1.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const ma1Input = { period: pMa1.period, values: closes };
        const ma1Data = (pMa1.type === 'EMA' ? EMA.calculate(ma1Input) : SMA.calculate(ma1Input))
                        .map((value, index) => ({ time: klineData[index + ma1Input.period - 1]?.time, value }))
                        .filter(d => d.time && typeof d.value === 'number');
        if (ma1Data.length > 0) maSeries1.setData(ma1Data);
    }

    // MA2
    const pMa2 = currentIndicatorParams.ma2;
    if (pMa2.enabled && closes.length >= pMa2.period) {
        maSeries2 = mainChart.addLineSeries({ color: pMa2.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const ma2Input = { period: pMa2.period, values: closes };
        const ma2Data = (pMa2.type === 'EMA' ? EMA.calculate(ma2Input) : SMA.calculate(ma2Input))
                        .map((value, index) => ({ time: klineData[index + ma2Input.period - 1]?.time, value }))
                        .filter(d => d.time && typeof d.value === 'number');
        if (ma2Data.length > 0) maSeries2.setData(ma2Data);
    }

    // Bollinger Bands
    const pBb = currentIndicatorParams.bb;
    if (pBb.enabled && closes.length >= pBb.period) {
        bbSeries.upper = mainChart.addLineSeries({ color: pBb.upperColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: LightweightCharts.LineStyle.Dashed });
        bbSeries.middle = mainChart.addLineSeries({ color: pBb.middleColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: LightweightCharts.LineStyle.Dotted });
        bbSeries.lower = mainChart.addLineSeries({ color: pBb.lowerColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: LightweightCharts.LineStyle.Dashed });
        const bbInput = { period: pBb.period, values: closes, stdDev: pBb.stdDev };
        const bbData = BollingerBands.calculate(bbInput);
        const bbOffset = klineData.length - bbData.length;
        bbSeries.upper.setData(bbData.map((d, i) => ({ time: klineData[i + bbOffset]?.time, value: d.upper })).filter(d=>d.time && typeof d.value === 'number'));
        bbSeries.middle.setData(bbData.map((d, i) => ({ time: klineData[i + bbOffset]?.time, value: d.middle })).filter(d=>d.time && typeof d.value === 'number'));
        bbSeries.lower.setData(bbData.map((d, i) => ({ time: klineData[i + bbOffset]?.time, value: d.lower })).filter(d=>d.time && typeof d.value === 'number'));
    }
    
    // Pane 1: Stochastic & WPRs
    addIndicatorNameOverlay(document.getElementById('indicator-pane-1'), 
        `${pStoch.enabled ? `Stoch(${pStoch.kPeriod},${pStoch.dPeriod},${pStoch.slowingPeriod})` : ''} ${pWpr14.enabled ? `WPR(${pWpr14.period})` : ''} ${pWpr50.enabled ? `WPR(${pWpr50.period})` : ''}`.trim());
    const pStoch = currentIndicatorParams.stochastic;
    if (pStoch.enabled && highs.length >= pStoch.kPeriod + pStoch.slowingPeriod + pStoch.dPeriod - 2) { // Cần đủ dữ liệu
        stochSeriesK = indicatorPane1.addLineSeries({ color: pStoch.kColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        stochSeriesD = indicatorPane1.addLineSeries({ color: pStoch.dColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        
        let stochInputFastK = { high: highs, low: lows, close: closes, period: pStoch.kPeriod, signalPeriod: 1 }; // Fast %K
        let fastKValues = Stochastic.calculate(stochInputFastK).map(d => d.k).filter(v => typeof v === 'number');
        
        let slowKInput = { period: pStoch.slowingPeriod, values: fastKValues };
        let slowKValues = SMA.calculate(slowKInput).filter(v => typeof v === 'number');
        
        let slowDInput = { period: pStoch.dPeriod, values: slowKValues };
        let slowDValues = SMA.calculate(slowDInput).filter(v => typeof v === 'number');

        // Căn chỉnh thời gian (đây là phần phức tạp nhất)
        const finalLength = slowDValues.length;
        const kOffset = klineData.length - finalLength;

        stochSeriesK.setData(slowKValues.slice(slowKValues.length - finalLength).map((value, index) => ({ time: klineData[index + kOffset]?.time, value })).filter(d=>d.time));
        stochSeriesD.setData(slowDValues.map((value, index) => ({ time: klineData[index + kOffset]?.time, value })).filter(d=>d.time));
    }

    const pWpr14 = currentIndicatorParams.wpr14;
    if (pWpr14.enabled && highs.length >= pWpr14.period) {
        wpr14PaneSeries = indicatorPane1.addLineSeries({ color: pWpr14.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const wpr14Input = { high: highs, low: lows, close: closes, period: pWpr14.period };
        const wpr14Data = WilliamsR.calculate(wpr14Input);
        const wpr14Offset = klineData.length - wpr14Data.length;
        wpr14PaneSeries.setData(wpr14Data.map((value, index) => ({ time: klineData[index + wpr14Offset]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }
    const pWpr50 = currentIndicatorParams.wpr50;
    if (pWpr50.enabled && highs.length >= pWpr50.period) {
        wpr50PaneSeries = indicatorPane1.addLineSeries({ color: pWpr50.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const wpr50Input = { high: highs, low: lows, close: closes, period: pWpr50.period };
        const wpr50Data = WilliamsR.calculate(wpr50Input);
        const wpr50Offset = klineData.length - wpr50Data.length;
        wpr50PaneSeries.setData(wpr50Data.map((value, index) => ({ time: klineData[index + wpr50Offset]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }

    // Pane 2: CCI, OBV, ADL
    const pCci1 = currentIndicatorParams.cci1;
    const pObv = currentIndicatorParams.obv;
    const pAdl = currentIndicatorParams.adl;
    addIndicatorNameOverlay(document.getElementById('indicator-pane-2'), 
        `${pCci1.enabled ? `CCI(${pCci1.period})` : ''} ${pObv.enabled ? `OBV` : ''} ${pAdl.enabled ? `A/D` : ''}`.trim());
    if (pCci1.enabled && highs.length >= pCci1.period) {
        cci1PaneSeries = indicatorPane2.addLineSeries({ color: pCci1.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const cci1Input = { open: opens, high: highs, low: lows, close: closes, period: pCci1.period };
        const cci1Data = CCI.calculate(cci1Input);
        const cci1Offset = klineData.length - cci1Data.length;
        cci1PaneSeries.setData(cci1Data.map((value, index) => ({ time: klineData[index + cci1Offset]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }
    if (pObv.enabled && closes.length > 0 && volumes.length > 0) {
        obvPaneSeries = indicatorPane2.addLineSeries({ color: pObv.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const obvInput = { close: closes, volume: volumes };
        const obvData = OBV.calculate(obvInput);
        obvPaneSeries.setData(obvData.map((value, index) => ({ time: klineData[index]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }
    if (pAdl.enabled && highs.length > 0) {
        adlPaneSeries = indicatorPane2.addLineSeries({ color: pAdl.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const adlInput = { high: highs, low: lows, close: closes, volume: volumes };
        const adlData = ADL.calculate(adlInput);
        adlPaneSeries.setData(adlData.map((value, index) => ({ time: klineData[index]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }

    // Pane 3: CCI, RSI
    const pCci2 = currentIndicatorParams.cci2;
    const pRsi = currentIndicatorParams.rsi;
    addIndicatorNameOverlay(document.getElementById('indicator-pane-3'), 
        `${pCci2.enabled ? `CCI(${pCci2.period})` : ''} ${pRsi.enabled ? `RSI(${pRsi.period})` : ''}`.trim());
    if (pCci2.enabled && highs.length >= pCci2.period) {
        cci2PaneSeries = indicatorPane3.addLineSeries({ color: pCci2.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const cci2Input = { open: opens, high: highs, low: lows, close: closes, period: pCci2.period };
        const cci2Data = CCI.calculate(cci2Input);
        const cci2Offset = klineData.length - cci2Data.length;
        cci2PaneSeries.setData(cci2Data.map((value, index) => ({ time: klineData[index + cci2Offset]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }
    if (pRsi.enabled && closes.length > pRsi.period) {
        rsiPaneSeries = indicatorPane3.addLineSeries({ color: pRsi.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
        const rsiInput = { values: closes, period: pRsi.period };
        const rsiData = RSI.calculate(rsiInput);
        const rsiOffset = klineData.length - rsiData.length;
        rsiPaneSeries.setData(rsiData.map((value, index) => ({ time: klineData[index + rsiOffset]?.time, value })).filter(d=>d.time && typeof d.value === 'number'));
    }
}

async function updateChart() { /* giữ nguyên */ const symbol = symbolSelect.value; const interval = intervalSelect.value; const klineData = await fetchCandlestickData(symbol, interval); if (klineData && klineData.length > 0) { candleSeries.setData(klineData); calculateAndDrawIndicators(klineData); mainChart.timeScale().fitContent(); } }

async function populateMarketWatchAndSymbols() {
    loadingIndicator.classList.remove('hidden');
    dataStatusElement.textContent = 'Đang tải danh sách coin...';
    let symbols = [];
    try {
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        if (!response.ok) throw new Error('Không thể lấy thông tin exchange từ Binance');
        const data = await response.json();
        symbols = data.symbols
            .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && !s.symbol.endsWith('UPUSDT') && !s.symbol.endsWith('DOWNUSDT') && !s.symbol.endsWith('BULLUSDT') && !s.symbol.endsWith('BEARUSDT'))
            .map(s => s.symbol)
            .sort();
        dataStatusElement.textContent = `Đã tải ${symbols.length} cặp USDT.`;
    } catch (error) {
        console.error("Lỗi khi lấy danh sách symbols:", error);
        dataStatusElement.textContent = 'Lỗi tải danh sách coin.';
        symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "MATICUSDT", "DOTUSDT", "SHIBUSDT"]; // Fallback
    } finally {
        loadingIndicator.classList.add('hidden');
    }
    
    // Populate symbol select
    symbolSelect.innerHTML = '';
    const popularSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT"];
    popularSymbols.forEach(s => {
        if (symbols.includes(s)) { // Chỉ thêm nếu có trong danh sách lấy được
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s.replace('USDT', '/USDT');
            symbolSelect.appendChild(option);
        }
    });
    // Thêm các symbol còn lại nếu muốn, hoặc để người dùng tìm kiếm
    // For now, we'll just use popular ones in dropdown, and all in market watch

    // Populate market watch
    renderMarketWatchList(symbols);
}

function renderMarketWatchList(symbolsToRender) {
    marketWatchListEl.innerHTML = ''; 
    symbolsToRender.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'market-watch-item w-full text-left p-1 hover:bg-gray-700 rounded text-xs';
        btn.textContent = s.replace('USDT', '/USDT');
        if (s === symbolSelect.value) {
            btn.classList.add('active-symbol');
        }
        btn.onclick = () => {
            symbolSelect.value = s;
            document.querySelectorAll('#market-watch-list button').forEach(b => b.classList.remove('active-symbol'));
            btn.classList.add('active-symbol');
            updateChart();
        };
        marketWatchListEl.appendChild(btn);
    });
}


marketWatchSearchEl.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toUpperCase();
    // Cần có danh sách symbols gốc để filter, tạm thời sẽ filter trên các item đang hiển thị
    const allSymbolButtons = Array.from(marketWatchListEl.getElementsByTagName('button'));
    allSymbolButtons.forEach(btn => {
        if (btn.textContent.toUpperCase().includes(searchTerm.replace('/USDT',''))) {
            btn.style.display = '';
        } else {
            btn.style.display = 'none';
        }
    });
});


function createIndicatorSettingsForm() {
    indicatorParamsForm.innerHTML = ''; 
    for (const key in currentIndicatorParams) {
        const params = currentIndicatorParams[key];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'indicator-settings-group grid grid-cols-1 md:grid-cols-2 gap-4 items-center';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'md:col-span-2 flex items-center space-x-3';
        
        const enabledCheckbox = document.createElement('input');
        enabledCheckbox.type = 'checkbox';
        enabledCheckbox.id = `${key}-enabled`;
        enabledCheckbox.checked = params.enabled;
        enabledCheckbox.className = 'form-checkbox h-5 w-5 text-blue-600';
        titleDiv.appendChild(enabledCheckbox);

        const title = document.createElement('h5');
        title.textContent = params.name;
        titleDiv.appendChild(title);
        groupDiv.appendChild(titleDiv);

        for (const paramKey in params) {
            if (paramKey === 'enabled' || paramKey === 'name') continue;

            const paramRow = document.createElement('div');
            paramRow.className = 'param-row';
            
            const label = document.createElement('label');
            label.htmlFor = `${key}-${paramKey}`;
            label.textContent = paramKey.charAt(0).toUpperCase() + paramKey.slice(1).replace(/([A-Z])/g, ' $1').trim() + ':'; // "kPeriod" -> "K Period"
            paramRow.appendChild(label);

            if (paramKey.toLowerCase().includes('color')) {
                const input = document.createElement('input');
                input.type = 'color';
                input.id = `${key}-${paramKey}`;
                input.value = params[paramKey];
                paramRow.appendChild(input);
            } else if (paramKey === 'type' && (key ==='ma1' || key === 'ma2')) {
                const select = document.createElement('select');
                select.id = `${key}-${paramKey}`;
                ['SMA', 'EMA'].forEach(maType => {
                    const option = document.createElement('option');
                    option.value = maType;
                    option.textContent = maType;
                    if (params[paramKey] === maType) option.selected = true;
                    select.appendChild(option);
                });
                paramRow.appendChild(select);
            } else { // number input
                const input = document.createElement('input');
                input.type = 'number';
                input.id = `${key}-${paramKey}`;
                input.value = params[paramKey];
                if (paramKey.includes('stdDev')) input.step = '0.1';
                else if (paramKey.includes('Period') || paramKey.includes('slowing')) input.min = '1';
                paramRow.appendChild(input);
            }
            groupDiv.appendChild(paramRow);
        }
        indicatorParamsForm.appendChild(groupDiv);
    }
}

function applySettings() {
    for (const key in currentIndicatorParams) {
        const params = currentIndicatorParams[key];
        const enabledCheckbox = document.getElementById(`${key}-enabled`);
        if(enabledCheckbox) params.enabled = enabledCheckbox.checked;
        
        for (const paramKey in params) {
             if (paramKey === 'enabled' || paramKey === 'name') continue;
            const inputElement = document.getElementById(`${key}-${paramKey}`);
            if (inputElement) {
                if (inputElement.type === 'color' || inputElement.tagName === 'SELECT') {
                     params[paramKey] = inputElement.value;
                } else if (inputElement.type === 'number') {
                     params[paramKey] = parseFloat(inputElement.value);
                }
            }
        }
    }
    saveIndicatorParams(); // Lưu cài đặt mới
    console.log("Thông số mới đã áp dụng:", currentIndicatorParams);
    updateChart();
    closeSettingsModalButton.click(); 
}

function resetDefaultSettings() {
    if (confirm("Bạn có chắc muốn reset tất cả thông số chỉ báo về mặc định không?")) {
        currentIndicatorParams = JSON.parse(JSON.stringify(defaultIndicatorParams));
        saveIndicatorParams();
        createIndicatorSettingsForm(); // Tạo lại form với giá trị mặc định
        // Không tự động apply, người dùng cần nhấn Apply
    }
}


// Xử lý resize
function onResize() { /* giữ nguyên */ if (mainChart) mainChart.resize(document.getElementById('chart-container').clientWidth, document.getElementById('chart-container').clientHeight || 350); if (indicatorPane1) indicatorPane1.resize(document.getElementById('indicator-pane-1').clientWidth, document.getElementById('indicator-pane-1').clientHeight || 100); if (indicatorPane2) indicatorPane2.resize(document.getElementById('indicator-pane-2').clientWidth, document.getElementById('indicator-pane-2').clientHeight || 100); if (indicatorPane3) indicatorPane3.resize(document.getElementById('indicator-pane-3').clientWidth, document.getElementById('indicator-pane-3').clientHeight || 100); }

// Event Listeners
indicatorSettingsButton.addEventListener('click', () => { createIndicatorSettingsForm(); indicatorSettingsModal.classList.remove('hidden'); setTimeout(() => indicatorSettingsModal.classList.remove('opacity-0'), 10); setTimeout(() => document.querySelector('.modal-content').classList.remove('scale-95'), 10); });
closeSettingsModalButton.addEventListener('click', () => { indicatorSettingsModal.classList.add('opacity-0'); document.querySelector('.modal-content').classList.add('scale-95'); setTimeout(() => indicatorSettingsModal.classList.add('hidden'), 300); });
indicatorSettingsModal.addEventListener('click', (event) => { if (event.target === indicatorSettingsModal) closeSettingsModalButton.click(); });
applyIndicatorSettingsButton.addEventListener('click', applySettings);
resetIndicatorSettingsButton.addEventListener('click', resetDefaultSettings);

refreshButton.addEventListener('click', updateChart);
symbolSelect.addEventListener('change', () => {
    document.querySelectorAll('#market-watch-list button').forEach(b => b.classList.remove('active-symbol'));
    const activeBtn = Array.from(document.querySelectorAll('#market-watch-list button')).find(b => b.textContent.startsWith(symbolSelect.value.replace('USDT','')));
    if(activeBtn) activeBtn.classList.add('active-symbol');
    updateChart();
});
intervalSelect.addEventListener('change', updateChart);
window.addEventListener('resize', onResize);

// Khởi tạo
async function initializeApp() {
    initializeIndicatorParams();
    createCharts();
    await populateMarketWatchAndSymbols(); // Chờ tải symbols xong mới update chart
    updateChart(); 
}

initializeApp();

