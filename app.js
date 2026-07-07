// ==================== CONFIG ====================
const SUPABASE_URL = 'https://qgasjpfbzjqlheexlouw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXNqcGZiempxbGhlZXhsb3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzc2OTgsImV4cCI6MjA5ODYxMzY5OH0.cdZFeiMTV8zoQxgXI9-mLWNxmj9-r2eVoRZt9vfyaSk';

let supabaseClient = null;
let allPriceData = [];
let allBillsData = [];
let displayedCount = 5;
const LOAD_MORE_AMOUNT = 10;
let currentFilterHours = 24;
let priceChart = null;
let billBreakdownChart = null;
let billRecordBreakdownChart = null;
let usageVsSpendChart = null;
let currentRecentReadings = [];
const BILL_TABLE_CANDIDATES = ['bill_with_price_insights', 'bills', 'comed_bills', 'bill_history'];
const BILL_DETAIL_TABLE_CANDIDATES = ['bill_details', 'bill_line_items', 'bills_details', 'bill_breakdown'];
const BILL_SEASONS = ['all', 'spring', 'summer', 'fall', 'winter'];
let activeBillSeasonFilter = 'all';
let currentFilteredPriceData = [];
let currentFilteredBills = [];
let currentLiveStatMeta = null;
let currentSummaryMeta = null;
let activeLiveDetailKey = null;
let activeBillsDetailKey = null;
let scorecardListenersBound = false;
let weatherInsightsLoaded = false;
let weatherInsightsLoading = false;
let weatherInsightsExpanded = true;
let weatherInsightsCache = null;
const WEATHER_LATITUDE = 41.6;
const WEATHER_LONGITUDE = -88.2;
const WEATHER_TIMEZONE = 'America/Chicago';
const WEATHER_TEMP_BINS = [
    { key: 'cool', label: 'Cool days (<75°F)', min: -Infinity, max: 75 },
    { key: 'mild', label: 'Mild days (75–85°F)', min: 75, max: 85.000001 },
    { key: 'hot', label: 'Hot days (>85°F)', min: 85.000001, max: Infinity }
];

// ==================== SIMPLE SLOT MACHINE ====================
function animateSlotNumber(element, targetValue, duration = 800) {
    if (!element) return;
    element.innerHTML = '';
    element.style.fontVariantNumeric = 'tabular-nums';
    const isCompactStatCard = ['avg-price', 'high-price', 'low-price'].includes(element.id);
    const isBillsSummaryCard = ['total-bills', 'total-spent', 'avg-effective-rate', 'avg-vs-market'].includes(element.id);
    const digitHeightEm = (isCompactStatCard || isBillsSummaryCard) ? 1.06 : 1.08;
    const digitWidthEm = isCompactStatCard ? 0.58 : (isBillsSummaryCard ? 0.56 : 0.54);

    const finalStr = String(targetValue);
    const container = document.createElement('span');
    container.className = 'slot-number';
    let animatedDigitIndex = 0;

    finalStr.split('').forEach((char) => {
        if (!/\d/.test(char)) {
            const staticChar = document.createElement('span');
            staticChar.className = char === '.' ? 'slot-decimal' : 'slot-static';
            staticChar.textContent = char;
            container.appendChild(staticChar);
            return;
        }

        const reelWrapper = document.createElement('span');
        reelWrapper.className = 'slot-reel-wrapper';
        reelWrapper.style.overflow = 'hidden';
        reelWrapper.style.display = 'inline-block';
        reelWrapper.style.height = `${digitHeightEm}em`;
        reelWrapper.style.width = `${digitWidthEm}em`;
        reelWrapper.style.position = 'relative';

        const reel = document.createElement('div');
        reel.className = 'slot-reel';
        reel.style.position = 'absolute';
        reel.style.top = '0';
        reel.style.left = '0';
        reel.style.transition = `transform ${duration}ms ease-out`;

        let stripHTML = '';
        for (let s = 0; s < 3; s++) {
            for (let d = 0; d <= 9; d++) {
                stripHTML += `<div style="height:${digitHeightEm}em; line-height:${digitHeightEm}em; text-align:center;">${d}</div>`;
            }
        }
        reel.innerHTML = stripHTML;
        reelWrapper.appendChild(reel);
        container.appendChild(reelWrapper);

        const digit = parseInt(char, 10);
        const totalDigits = 30;
        const finalTranslateY = -((totalDigits - 10 + digit) * digitHeightEm);

        reel.style.transform = `translateY(0)`;
        setTimeout(() => {
            reel.style.transform = `translateY(${finalTranslateY}em)`;
        }, 20 + (animatedDigitIndex * 40));

        animatedDigitIndex += 1;
    });

    element.appendChild(container);

    const shouldSettleToStatic = isCompactStatCard || isBillsSummaryCard || element.id === 'current-price';
    if (shouldSettleToStatic) {
        const settleDelay = duration + (animatedDigitIndex * 40) + 80;
        setTimeout(() => {
            if (element) {
                element.textContent = finalStr;
            }
        }, settleDelay);
    }
}

// ==================== TAB SWITCHING ====================
function switchTab(tab) {
    const liveContent = document.getElementById('live-tab-content');
    const billsContent = document.getElementById('bills-tab-content');
    const liveBtn = document.getElementById('tab-live');
    const billsBtn = document.getElementById('tab-bills');

    liveBtn.classList.remove('active');
    billsBtn.classList.remove('active');

    if (tab === 'live') {
        closeBillModal();
        hideBillsSummaryDetail();
        billsContent.style.transition = 'all 0.2s ease';
        billsContent.style.opacity = '0';

        setTimeout(() => {
            billsContent.classList.add('hidden');
            liveContent.classList.remove('hidden');
            liveContent.style.opacity = '0';
            liveBtn.classList.add('active');

            requestAnimationFrame(() => {
                liveContent.style.transition = 'all 0.25s ease';
                liveContent.style.opacity = '1';
            });
        }, 120);
    } else {
        hideLiveStatDetail();
        liveContent.style.transition = 'all 0.2s ease';
        liveContent.style.opacity = '0';

        setTimeout(() => {
            liveContent.classList.add('hidden');
            billsContent.classList.remove('hidden');
            billsContent.style.opacity = '0';
            billsBtn.classList.add('active');

            requestAnimationFrame(() => {
                billsContent.style.transition = 'all 0.25s ease';
                billsContent.style.opacity = '1';
            });
        }, 120);
    }
}

// ==================== SUPABASE ====================
function initializeSupabase() {
    closeBillModal();
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        loadData();
        loadBills();
    } else {
        setTimeout(initializeSupabase, 40);
    }
}

// ==================== PRICE DATA ====================
async function loadData(showLoading = true) {
    if (showLoading) showSkeleton();

    try {
        const { data, error } = await supabaseClient
            .from('comed_prices')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(2000);

        if (error) throw error;

        allPriceData = data || [];
        displayedCount = 5;
        filterData(currentFilterHours);
        markWeatherInsightsNeedsRefresh();
    } catch (err) {
        console.error('Price data error:', err);
    }
}

function filterData(hours) {
    currentFilterHours = hours;
    displayedCount = 5;
    updateFilterButtons(hours);
    updateStatsHeader(hours);
    hideLiveStatDetail();

    if (!allPriceData.length) return;

    const hoursInMs = hours * 60 * 60 * 1000;
    const now = new Date();
    const filtered = allPriceData.filter(row => (now - new Date(row.recorded_at)) <= hoursInMs);

    if (filtered.length === 0) {
        currentRecentReadings = [];
        renderRecentList([]);
        return;
    }

    currentRecentReadings = filtered;
    currentFilteredPriceData = filtered;

    const latest = allPriceData[0];
    const price = parseFloat(latest.price);
    animateSlotNumber(document.getElementById('current-price'), formatLivePrice(price));
    document.getElementById('current-emoji').innerHTML = getEmoji(price);
    document.getElementById('current-time').innerHTML = 
        `Updated ${new Date(latest.recorded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    const prices = filtered.map(r => parseFloat(r.price));
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const highRow = filtered.find(r => parseFloat(r.price) === high) || filtered[0];
    const lowRow = filtered.find(r => parseFloat(r.price) === low) || filtered[0];
    const earliestRow = filtered[filtered.length - 1];
    const latestRow = filtered[0];
    currentLiveStatMeta = {
        avg,
        high,
        low,
        highRow,
        lowRow,
        earliestRow,
        latestRow
    };

    animateSlotNumber(document.getElementById('avg-price'), formatLivePrice(avg));
    animateSlotNumber(document.getElementById('high-price'), formatLivePrice(high));
    animateSlotNumber(document.getElementById('low-price'), formatLivePrice(low));

    updateChart(filtered);
    renderRecentList(currentRecentReadings);
}

function updateFilterButtons(hours) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const isActive = Number(btn.dataset.hours) === Number(hours);
        btn.classList.toggle('active', isActive);
    });
}

function updateStatsHeader(hours) {
    const header = document.getElementById('stats-header');
    if (!header) return;
    if (hours < 24) {
        header.textContent = `LAST ${hours} HOURS`;
    } else if (hours === 24) {
        header.textContent = 'LAST 24 HOURS';
    } else if (hours === 168) {
        header.textContent = 'LAST 7 DAYS';
    } else if (hours === 720) {
        header.textContent = 'LAST 30 DAYS';
    } else {
        header.textContent = `LAST ${Math.round(hours / 24)} DAYS`;
    }
}

function getEmoji(price) {
    if (price <= 8) return '🟢';
    if (price <= 10) return '🟡';
    return '🔴';
}

function formatLivePrice(centsValue) {
    const cents = Number(centsValue);
    if (Math.abs(cents) >= 100) {
        return `$${(cents / 100).toFixed(2)}`;
    }
    return `${cents.toFixed(1)}¢`;
}

function toggleWeatherInsights() {
    const body = document.getElementById('weather-insights-body');
    const toggleBtn = document.getElementById('weather-insights-toggle-btn');
    if (!body || !toggleBtn) return;
    weatherInsightsExpanded = !weatherInsightsExpanded;
    body.classList.toggle('hidden', !weatherInsightsExpanded);
    toggleBtn.textContent = weatherInsightsExpanded ? 'Collapse' : 'Expand';
}

function setWeatherInsightsStatus(message, variant = '') {
    const statusEl = document.getElementById('weather-insights-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('error', 'loading');
    if (variant === 'error') {
        statusEl.classList.add('error');
    } else if (variant === 'loading') {
        statusEl.classList.add('loading');
    }
}

function updateWeatherInsightsActions() {
    const loadBtn = document.getElementById('weather-insights-load-btn');
    const refreshBtn = document.getElementById('weather-insights-refresh-btn');
    if (!loadBtn || !refreshBtn) return;

    loadBtn.disabled = weatherInsightsLoading;
    refreshBtn.disabled = weatherInsightsLoading;

    if (weatherInsightsLoading) {
        loadBtn.textContent = weatherInsightsLoaded ? 'Refreshing...' : 'Loading...';
    } else {
        loadBtn.textContent = weatherInsightsLoaded ? 'Loaded' : 'Load Insights';
    }

    loadBtn.classList.toggle('hidden', weatherInsightsLoaded);
    refreshBtn.classList.toggle('hidden', !weatherInsightsLoaded);
}

function markWeatherInsightsNeedsRefresh() {
    if (!weatherInsightsLoaded || weatherInsightsLoading) return;
    setWeatherInsightsStatus('Pricing data updated. Tap Refresh to recalculate weather insights.');
}

function getChicagoDateKey(rawDate) {
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: WEATHER_TIMEZONE }).format(date);
    const month = new Intl.DateTimeFormat('en-US', { month: '2-digit', timeZone: WEATHER_TIMEZONE }).format(date);
    const day = new Intl.DateTimeFormat('en-US', { day: '2-digit', timeZone: WEATHER_TIMEZONE }).format(date);
    return `${year}-${month}-${day}`;
}

function getDateKeyDaysAgo(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
}

function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if ([1, 2].includes(code)) return '🌤️';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌡️';
}

function getTempBinKey(tempF) {
    const temp = Number(tempF);
    if (!Number.isFinite(temp)) return null;
    const match = WEATHER_TEMP_BINS.find((bin) => temp >= bin.min && temp < bin.max);
    return match ? match.key : null;
}

function computeDailyAveragePrices() {
    const byDay = new Map();
    (allPriceData || []).forEach((row) => {
        const key = getChicagoDateKey(row.recorded_at);
        const price = Number(row.price);
        if (!key || !Number.isFinite(price)) return;
        if (!byDay.has(key)) byDay.set(key, { sum: 0, count: 0 });
        const day = byDay.get(key);
        day.sum += price;
        day.count += 1;
    });

    const dailyAverages = {};
    byDay.forEach((value, key) => {
        dailyAverages[key] = value.count ? (value.sum / value.count) : null;
    });
    return dailyAverages;
}

function buildWeatherInsightsModel(forecastPayload, historicalPayload, dailyPriceByDate) {
    const bins = WEATHER_TEMP_BINS.map((bin) => ({
        key: bin.key,
        label: bin.label,
        sum: 0,
        count: 0,
        avgPrice: null
    }));
    const binLookup = Object.fromEntries(bins.map((bin) => [bin.key, bin]));

    const historicalDays = historicalPayload?.daily?.time || [];
    const historicalMax = historicalPayload?.daily?.temperature_2m_max || [];
    const joinedDays = [];

    for (let i = 0; i < historicalDays.length; i += 1) {
        const date = historicalDays[i];
        const tempMax = Number(historicalMax[i]);
        const avgPrice = Number(dailyPriceByDate[date]);
        if (!date || !Number.isFinite(tempMax) || !Number.isFinite(avgPrice)) continue;

        joinedDays.push({ date, tempMax, avgPrice });
        const key = getTempBinKey(tempMax);
        if (!key) continue;
        const bucket = binLookup[key];
        bucket.sum += avgPrice;
        bucket.count += 1;
    }

    bins.forEach((bin) => {
        bin.avgPrice = bin.count ? (bin.sum / bin.count) : null;
    });

    const overallAvg = joinedDays.length
        ? joinedDays.reduce((sum, day) => sum + day.avgPrice, 0) / joinedDays.length
        : null;

    const forecastTime = forecastPayload?.daily?.time || [];
    const forecastMax = forecastPayload?.daily?.temperature_2m_max || [];
    const forecastMin = forecastPayload?.daily?.temperature_2m_min || [];
    const forecastCode = forecastPayload?.daily?.weathercode || [];
    const forecastPrecip = forecastPayload?.daily?.precipitation_probability_max || [];
    const forecastDays = [];
    const daysToRender = Math.min(5, forecastTime.length);

    for (let i = 0; i < daysToRender; i += 1) {
        const date = forecastTime[i];
        const high = Number(forecastMax[i]);
        const low = Number(forecastMin[i]);
        const weatherCode = Number(forecastCode[i]);
        const precipChance = Number(forecastPrecip[i]);
        if (!date || !Number.isFinite(high) || !Number.isFinite(low)) continue;

        const dateObj = new Date(`${date}T12:00:00`);
        const dayLabel = dateObj.toLocaleDateString([], { weekday: 'short' });
        const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const binKey = getTempBinKey(high);
        const selectedBin = binKey ? binLookup[binKey] : null;
        const hasBinData = Boolean(selectedBin && selectedBin.count > 0 && Number.isFinite(selectedBin.avgPrice));
        const projectedPrice = hasBinData ? selectedBin.avgPrice : overallAvg;
        const sampleCount = hasBinData ? selectedBin.count : joinedDays.length;
        const supportText = hasBinData
            ? `Based on ${selectedBin.count} similar days`
            : `Fallback to overall average (${joinedDays.length} days)`;

        forecastDays.push({
            dayLabel,
            dateLabel,
            high,
            low,
            weatherCode,
            precipChance: Number.isFinite(precipChance) ? precipChance : null,
            projectedPrice,
            sampleCount,
            supportText
        });
    }

    let callout = 'Collecting more history will improve forecast confidence.';
    const mildBin = binLookup.mild;
    const hotBin = binLookup.hot;
    if (mildBin?.count > 0 && hotBin?.count > 0 && Number.isFinite(mildBin.avgPrice) && mildBin.avgPrice !== 0) {
        const deltaPct = ((hotBin.avgPrice - mildBin.avgPrice) / mildBin.avgPrice) * 100;
        const direction = deltaPct >= 0 ? 'higher' : 'lower';
        callout = `In your history, hot days over 85°F average ${Math.abs(deltaPct).toFixed(1)}% ${direction} than mild days.`;
    } else if (joinedDays.length < 20) {
        callout = `Only ${joinedDays.length} matched weather/price days found so far, so estimates are still early.`;
    }

    return {
        bins,
        forecastDays,
        callout,
        overallAvg,
        matchedHistoryDays: joinedDays.length
    };
}

function renderWeatherInsights(model) {
    const cardsEl = document.getElementById('weather-forecast-cards');
    const binsEl = document.getElementById('weather-bin-stats');
    const calloutEl = document.getElementById('weather-insight-callout');
    if (!cardsEl || !binsEl || !calloutEl) return;

    cardsEl.innerHTML = model.forecastDays.map((day) => {
        const precip = Number.isFinite(day.precipChance) ? `<div class="weather-forecast-support">Rain chance: ${Math.round(day.precipChance)}%</div>` : '';
        const supportSuffix = day.sampleCount < 8 ? `${day.supportText} · Limited data` : day.supportText;
        return `
            <article class="weather-forecast-card">
                <div class="weather-forecast-day">
                    <span>${day.dayLabel}, ${day.dateLabel}</span>
                    <span>${getWeatherEmoji(day.weatherCode)}</span>
                </div>
                <div class="weather-forecast-temp">H ${Math.round(day.high)}°F · L ${Math.round(day.low)}°F</div>
                <div class="weather-forecast-price">${Number.isFinite(day.projectedPrice) ? formatLivePrice(day.projectedPrice) : 'N/A'}</div>
                <div class="weather-forecast-support">${supportSuffix}</div>
                ${precip}
            </article>
        `;
    }).join('');
    cardsEl.classList.remove('hidden');

    binsEl.innerHTML = model.bins.map((bin) => {
        const avgText = Number.isFinite(bin.avgPrice) ? formatLivePrice(bin.avgPrice) : 'N/A';
        return `
            <div class="weather-bin-row">
                <div class="weather-bin-label">${bin.label}</div>
                <div class="weather-bin-value">${avgText} avg</div>
                <div class="weather-bin-count">n=${bin.count}</div>
            </div>
        `;
    }).join('');
    binsEl.classList.remove('hidden');

    calloutEl.textContent = model.callout;
    calloutEl.classList.remove('hidden');
}

async function loadWeatherInsights(forceRefresh = false) {
    if (weatherInsightsLoading) return;
    if (!allPriceData.length) {
        setWeatherInsightsStatus('Price data is still loading. Try again in a moment.', 'error');
        return;
    }

    if (weatherInsightsCache && !forceRefresh) {
        weatherInsightsLoaded = true;
        renderWeatherInsights(weatherInsightsCache);
        updateWeatherInsightsActions();
        return;
    }

    const dailyPriceByDate = computeDailyAveragePrices();
    const dayKeys = Object.keys(dailyPriceByDate).sort();
    if (dayKeys.length === 0) {
        setWeatherInsightsStatus('No daily price history found yet.');
        return;
    }

    weatherInsightsLoading = true;
    updateWeatherInsightsActions();
    setWeatherInsightsStatus('Fetching weather history and forecast...', 'loading');

    try {
        const startDate = dayKeys[0];
        const maxHistoricalDate = getDateKeyDaysAgo(1);
        const endDate = dayKeys[dayKeys.length - 1] > maxHistoricalDate ? maxHistoricalDate : dayKeys[dayKeys.length - 1];
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LATITUDE}&longitude=${WEATHER_LONGITUDE}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=${WEATHER_TIMEZONE}&temperature_unit=fahrenheit&forecast_days=7`;
        const historyUrl = `https://archive-api.open-meteo.com/v1/era5?latitude=${WEATHER_LATITUDE}&longitude=${WEATHER_LONGITUDE}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max&timezone=${WEATHER_TIMEZONE}&temperature_unit=fahrenheit`;

        const [forecastResp, historyResp] = await Promise.all([
            fetch(forecastUrl),
            fetch(historyUrl)
        ]);

        if (!forecastResp.ok) throw new Error(`Forecast request failed (${forecastResp.status})`);
        if (!historyResp.ok) throw new Error(`Historical request failed (${historyResp.status})`);

        const [forecastData, historyData] = await Promise.all([
            forecastResp.json(),
            historyResp.json()
        ]);

        const model = buildWeatherInsightsModel(forecastData, historyData, dailyPriceByDate);
        if (!model.forecastDays.length || model.matchedHistoryDays === 0) {
            throw new Error('Not enough overlapping weather and price history to generate insights.');
        }

        weatherInsightsCache = model;
        weatherInsightsLoaded = true;
        renderWeatherInsights(model);
        setWeatherInsightsStatus(
            `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Matched ${model.matchedHistoryDays} weather/price days.`
        );
    } catch (err) {
        console.error('Weather insights error:', err);
        setWeatherInsightsStatus('Weather insights are unavailable right now. Please try refreshing.', 'error');
    } finally {
        weatherInsightsLoading = false;
        updateWeatherInsightsActions();
    }
}

function renderRecentList(filteredData) {
    const container = document.getElementById('recent-list');
    container.innerHTML = '';

    const toShow = filteredData.slice(0, displayedCount);

    toShow.forEach(row => {
        const p = parseFloat(row.price);
        const time = new Date(row.recorded_at);

        const el = document.createElement('div');
        el.className = `flex items-center justify-between px-4 py-[13px] bg-zinc-900/70 border border-zinc-800 rounded-2xl`;

        const dateStr = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        el.innerHTML = `
            <div class="flex items-center gap-3.5">
                <span class="text-3xl">${getEmoji(p)}</span>
                <div>
                    <div class="font-semibold text-xl tracking-tight">${formatLivePrice(p)}</div>
                    <div class="text-[10px] text-zinc-500 -mt-0.5">
                        ${dateStr} · ${timeStr}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(el);
    });

    document.getElementById('reading-count').innerHTML = `${filteredData.length} readings`;
    updateLoadMoreButton(filteredData.length);
}

function loadMore() {
    displayedCount += LOAD_MORE_AMOUNT;
    renderRecentList(currentRecentReadings);
}

function updateLoadMoreButton(totalReadings) {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;
    loadMoreBtn.classList.toggle('hidden', displayedCount >= totalReadings);
}

// ==================== CHART ====================
function updateChart(data) {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;

    if (priceChart) priceChart.destroy();

    const isLongRange = currentFilterHours > 24;

    let labels = [];
    let prices = [];

    if (isLongRange) {
        const dayCount = Math.max(2, Math.round(currentFilterHours / 24));
        const now = new Date();
        const dayKeys = [];
        for (let i = dayCount - 1; i >= 0; i--) {
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - i);
            dayKeys.push(day.toISOString().slice(0, 10));
        }

        const dayBuckets = new Map();
        data.forEach((row) => {
            const d = new Date(row.recorded_at);
            const key = d.toISOString().slice(0, 10);
            if (!dayBuckets.has(key)) {
                dayBuckets.set(key, { sum: 0, count: 0 });
            }
            const bucket = dayBuckets.get(key);
            bucket.sum += parseFloat(row.price);
            bucket.count += 1;
        });

        labels = dayKeys.map((key) => {
            const d = new Date(`${key}T00:00:00`);
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        });
        prices = dayKeys.map((key) => {
            const bucket = dayBuckets.get(key);
            return bucket ? (bucket.sum / bucket.count) : null;
        });
    } else {
        labels = data.slice().reverse().map(r => {
            const d = new Date(r.recorded_at);
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        });
        prices = data.slice().reverse().map(r => parseFloat(r.price));
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: prices,
                borderColor: '#22c55e',
                borderWidth: 2.5,
                tension: 0.3,
                pointRadius: 0,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    grid: { color: '#27272a' }, 
                    ticks: { color: '#a1a1aa', font: { size: 10 } } 
                },
                y: { 
                    grid: { color: '#27272a' }, 
                    ticks: { color: '#a1a1aa', font: { size: 10 } } 
                }
            }
        }
    });
}

// ==================== MY BILLS ====================
async function loadBills() {
    const billsList = document.getElementById('bills-list');
    const billCountEl = document.getElementById('bill-count');

    try {
        if (!supabaseClient) throw new Error('Supabase not ready');
        allBillsData = await fetchBillsData();
        renderSummaryStats(allBillsData);
        renderBillSeasonFilters();
        applyBillSeasonFilter();

        hydrateBillsWithDetails(allBillsData)
            .then((hydrated) => {
                allBillsData = hydrated;
                applyBillSeasonFilter();
            })
            .catch((detailErr) => {
                console.error('Bill detail hydration error:', detailErr);
            });

    } catch (err) {
        console.error('Bills loading error:', err?.message || err, err?.details || '', err?.hint || '');
        if (billsList) {
            billsList.innerHTML = `<div class="text-center py-6 text-red-400 text-sm">Failed to load bills. Please try again.</div>`;
        }
        if (billCountEl) billCountEl.innerHTML = 'Error';
    }
}

async function hydrateBillsWithDetails(bills) {
    return Promise.all((bills || []).map(async (bill) => {
        const parsed = normalizeBillRecord(bill);
        const missingBreakdown = parsed.supplyCost === 0 && parsed.deliveryCost === 0 && parsed.taxesFees === 0;
        const missingMarketDiff = parsed.marketDiff === 0;
        if (!missingBreakdown && !missingMarketDiff) return bill;

        const detail = await fetchBillDetailData(parsed);
        if (!detail) return bill;
        return { ...bill, ...detail };
    }));
}

async function fetchBillsData() {
    for (const table of BILL_TABLE_CANDIDATES) {
        const { data, error } = await supabaseClient
            .from(table)
            .select('*')
            .limit(500);

        if (!error) {
            return sortBillsNewestFirst(data || []);
        }
    }
    throw new Error('No readable bills table found');
}

function sortBillsNewestFirst(rows) {
    return rows.slice().sort((a, b) => {
        const aTime = getDateValue(a, ['service_start', 'period_start', 'start_date', 'bill_start'])?.getTime() || 0;
        const bTime = getDateValue(b, ['service_start', 'period_start', 'start_date', 'bill_start'])?.getTime() || 0;
        return bTime - aTime;
    });
}

function getFirstValue(record, keys) {
    for (const key of keys) {
        if (record && record[key] !== undefined && record[key] !== null && record[key] !== '') {
            return record[key];
        }
    }
    return null;
}

function getNumeric(record, keys, fallback = 0) {
    const raw = getFirstValue(record, keys);
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getOptionalNumeric(record, keys) {
    const raw = getFirstValue(record, keys);
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function getDateValue(record, keys) {
    const raw = getFirstValue(record, keys);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeBillRecord(bill) {
    const serviceStart = getDateValue(bill, ['service_start', 'period_start', 'start_date', 'bill_start']);
    const serviceEnd = getDateValue(bill, ['service_end', 'period_end', 'end_date', 'bill_end']);
    const days = getNumeric(bill, ['days', 'service_days', 'period_days']);
    const totalKwh = getNumeric(bill, ['total_kwh', 'kwh', 'usage_kwh']);
    const totalDue = getNumeric(bill, ['total_due', 'amount_due', 'bill_total', 'total']);
    const effectiveRate = getNumeric(bill, ['effective_rate', 'eff_rate', 'rate_paid']);
    const marketAvg = getNumeric(bill, ['market_avg_rate', 'market_rate', 'market_avg']);
    const marketDiffRaw = getOptionalNumeric(bill, ['market_vs_paid_diff', 'vs_market', 'market_diff']);
    const marketDiff = marketDiffRaw ?? (effectiveRate - marketAvg);
    const seasonRaw = getFirstValue(bill, ['season', 'billing_season']) || '';
    const season = normalizeSeason(seasonRaw) || deriveSeasonFromDate(serviceStart);
    const creditsRaw = getOptionalNumeric(bill, [
        'credits', 'credits_applied', 'credit_amount', 'credit_total', 'total_credits', 'bill_credit', 'adjustments'
    ]);
    const hasCreditsFlagRaw = getFirstValue(bill, ['has_credits']);
    const hasCreditsFlag = hasCreditsFlagRaw === true || String(hasCreditsFlagRaw || '').toLowerCase() === 'true';
    const supplyCost = getNumeric(bill, [
        'supply_cost', 'supply_total', 'energy_cost', 'supply_charge', 'supply_amount', 'energy_amount'
    ]);
    const supplyRate = getNumeric(bill, [
        'supply_rate', 'supply_rate_cents', 'energy_rate', 'supply_rate_per_kwh', 'energy_rate_per_kwh'
    ]);
    const deliveryCost = getNumeric(bill, [
        'delivery_cost', 'delivery_total', 'delivery_charge', 'wires_cost', 'wires_total', 'delivery_amount'
    ]);
    const deliveryRate = getNumeric(bill, [
        'delivery_rate', 'delivery_rate_cents', 'wires_rate', 'delivery_rate_per_kwh', 'wires_rate_per_kwh'
    ]);
    const taxesFeesRaw = getOptionalNumeric(bill, [
        'taxes_fees', 'taxes_and_fees', 'taxes', 'fees_total', 'taxes_and_fees_total', 'taxes_total',
        'tax_and_fees', 'fees', 'taxesfees', 'taxes_fees_amount', 'other_charges'
    ]);
    const { taxesFees, credits } = resolveBillAdjustments(totalDue, supplyCost, deliveryCost, taxesFeesRaw, creditsRaw);

    return {
        raw: bill,
        serviceStart,
        serviceEnd,
        days,
        totalKwh,
        totalDue,
        effectiveRate,
        marketAvg,
        marketDiff,
        season,
        hasCredits: hasCreditsFlag || Math.abs(credits) > 0.004,
        credits,
        supplyCost,
        supplyRate,
        deliveryCost,
        deliveryRate,
        taxesFees,
        avgPriceDuringPeriod: getNumeric(bill, ['avg_price_during_period', 'avg_market_price', 'average_price_during_period'], 0)
    };
}

function resolveBillAdjustments(totalDue, supplyCost, deliveryCost, taxesFeesRaw, creditsRaw) {
    let taxesFees = Number.isFinite(taxesFeesRaw) ? taxesFeesRaw : null;
    let credits = Number.isFinite(creditsRaw) ? creditsRaw : null;
    const baseCharges = supplyCost + deliveryCost;

    if (taxesFees === null && credits === null) {
        taxesFees = 0;
        credits = totalDue - baseCharges;
    } else if (taxesFees === null) {
        taxesFees = totalDue - baseCharges - credits;
    } else if (credits === null) {
        credits = totalDue - baseCharges - taxesFees;
    }

    if (!Number.isFinite(taxesFees)) taxesFees = 0;
    if (!Number.isFinite(credits)) credits = 0;

    if (Math.abs(taxesFees) < 0.005) taxesFees = 0;
    if (Math.abs(credits) < 0.005) credits = 0;

    return { taxesFees, credits };
}

function normalizeSeason(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw.includes('spring')) return 'spring';
    if (raw.includes('summer')) return 'summer';
    if (raw.includes('fall') || raw.includes('autumn')) return 'fall';
    if (raw.includes('winter')) return 'winter';
    return '';
}

function deriveSeasonFromDate(dateValue) {
    if (!dateValue || Number.isNaN(dateValue.getTime())) return '';
    const month = dateValue.getMonth(); // 0-11
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
}

function getSeasonForMonth(monthIndex) {
    if (monthIndex >= 2 && monthIndex <= 4) return 'spring';
    if (monthIndex >= 5 && monthIndex <= 7) return 'summer';
    if (monthIndex >= 8 && monthIndex <= 10) return 'fall';
    return 'winter';
}

function billOverlapsSeason(parsedBill, season) {
    if (!parsedBill || !season || season === 'all') return true;

    const start = parsedBill.serviceStart;
    const end = parsedBill.serviceEnd || parsedBill.serviceStart;

    if (!start || Number.isNaN(start.getTime())) {
        return parsedBill.season === season;
    }

    const periodEnd = end && !Number.isNaN(end.getTime()) ? end : start;
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    // Guard against malformed ranges; also caps iteration for very long spans.
    let steps = 0;
    while (cursor <= last && steps < 48) {
        if (getSeasonForMonth(cursor.getMonth()) === season) return true;
        cursor.setMonth(cursor.getMonth() + 1);
        steps += 1;
    }

    return parsedBill.season === season;
}

function renderBillSeasonFilters() {
    const container = document.getElementById('bill-season-filters');
    if (!container) return;
    container.innerHTML = BILL_SEASONS.map(season => {
        const label = season === 'all' ? 'All' : `${season.charAt(0).toUpperCase()}${season.slice(1)}`;
        const activeClass = season === activeBillSeasonFilter ? 'active' : '';
        return `<button type="button" class="bill-season-chip ${activeClass}" data-season="${season}" onclick="setBillSeasonFilter('${season}')">${label}</button>`;
    }).join('');
}

function applyBillSeasonFilter() {
    const filtered = activeBillSeasonFilter === 'all'
        ? allBillsData
        : allBillsData.filter((bill) => billOverlapsSeason(normalizeBillRecord(bill), activeBillSeasonFilter));
    currentFilteredBills = filtered;
    hideBillsSummaryDetail();
    renderSummaryStats(filtered);
    renderUsageVsSpendChart(filtered);
    renderBillsList(filtered);
    renderBillSeasonFilters();
}

function setBillSeasonFilter(season) {
    activeBillSeasonFilter = BILL_SEASONS.includes(season) ? season : 'all';
    applyBillSeasonFilter();
}

async function fetchBillDetailData(parsedBill) {
    if (!supabaseClient || !parsedBill || !parsedBill.raw) return null;

    const raw = parsedBill.raw;
    const idValue = getFirstValue(raw, ['id', 'bill_id', 'statement_id', 'record_id']);
    const startValue = getFirstValue(raw, ['service_start', 'period_start', 'start_date', 'bill_start']);
    const endValue = getFirstValue(raw, ['service_end', 'period_end', 'end_date', 'bill_end']);

    const idColumns = ['bill_id', 'statement_id', 'id', 'record_id'];
    const startColumns = ['service_start', 'period_start', 'start_date', 'bill_start'];
    const endColumns = ['service_end', 'period_end', 'end_date', 'bill_end'];

    for (const table of BILL_DETAIL_TABLE_CANDIDATES) {
        if (idValue !== null) {
            for (const idColumn of idColumns) {
                const row = await querySingleRow(table, [[idColumn, idValue]]);
                if (row) return row;
            }
        }

        if (startValue !== null) {
            for (const startColumn of startColumns) {
                const row = await querySingleRow(table, [[startColumn, startValue]]);
                if (row) return row;

                if (endValue !== null) {
                    for (const endColumn of endColumns) {
                        const withRange = await querySingleRow(table, [
                            [startColumn, startValue],
                            [endColumn, endValue]
                        ]);
                        if (withRange) return withRange;
                    }
                }
            }
        }
    }

    return null;
}

async function querySingleRow(table, filters) {
    try {
        let query = supabaseClient.from(table).select('*').limit(1);
        for (const [column, value] of filters) {
            query = query.eq(column, value);
        }
        const { data, error } = await query;
        if (error || !data || data.length === 0) return null;
        return data[0];
    } catch {
        return null;
    }
}

function renderBillsList(bills) {
    const container = document.getElementById('bills-list');
    container.innerHTML = '';

    if (!bills || bills.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-zinc-400 text-sm">No bills found yet.</div>`;
        document.getElementById('bill-count').innerHTML = '0 bills';
        return;
    }

    document.getElementById('bill-count').innerHTML = `${bills.length} bills`;

    bills.forEach(bill => {
        const parsed = normalizeBillRecord(bill);
        const el = document.createElement('div');
        el.className = 'bill-card glass border border-zinc-800 rounded-2xl p-4 cursor-pointer';
        el.onclick = () => showBillModal(parsed);

        const startText = parsed.serviceStart
            ? parsed.serviceStart.toLocaleDateString([], { month: 'short', year: 'numeric' })
            : 'Unknown';
        const endText = parsed.serviceEnd
            ? parsed.serviceEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })
            : 'Unknown';
        const diffColor = parsed.marketDiff > 0 ? 'text-red-400' : 'text-emerald-400';
        const seasonBadge = parsed.season
            ? `<button type="button" class="inline-flex px-3 py-1 rounded-full text-sm tracking-wide text-sky-300 bg-sky-500/10" onclick="event.stopPropagation(); setBillSeasonFilter('${parsed.season}')">${parsed.season}</button>`
            : '';
        const creditBadge = parsed.hasCredits
            ? `<span class="inline-flex px-3 py-1 rounded-full text-sm tracking-wide text-emerald-300 bg-emerald-500/10">Credits</span>`
            : '';

        el.innerHTML = `
            <div class="flex justify-between mb-3">
                <div>
                    <div class="font-semibold">${startText} — ${endText}</div>
                    <div class="text-xs text-zinc-400">${parsed.days} days • ${parsed.totalKwh} kWh</div>
                </div>
                <div class="text-right">
                    <div class="font-semibold text-3xl">${formatDollarAmount(parsed.totalDue)}</div>
                    <div class="text-xs text-zinc-500 mt-1">Total Due</div>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm">
                <div><div class="text-[10px] text-zinc-400">Effective Rate</div><div class="font-semibold">${formatCents(parsed.effectiveRate)}</div></div>
                <div><div class="text-[10px] text-zinc-400">Market Avg</div><div class="font-semibold">${formatCents(parsed.marketAvg)}</div></div>
                <div><div class="text-[10px] text-zinc-400">vs Market</div><div class="font-semibold ${diffColor}">${parsed.marketDiff > 0 ? '+' : ''}${parsed.marketDiff.toFixed(2)}¢</div></div>
            </div>
            <div class="mt-4 flex gap-2">${seasonBadge}${creditBadge}</div>
        `;
        container.appendChild(el);
    });
}

function renderSummaryStats(bills) {
    if (!bills || bills.length === 0) {
        currentSummaryMeta = null;
        document.getElementById('total-bills').textContent = '0';
        document.getElementById('total-spent').textContent = '$0.00';
        document.getElementById('avg-effective-rate').textContent = '--';
        document.getElementById('avg-vs-market').textContent = '--';
        updateBillsBreakdownChart({ supply: 0, delivery: 0, taxes: 0 });
        return;
    }

    const totalBills = bills.length;
    const normalized = bills.map(normalizeBillRecord);
    const totalSpent = normalized.reduce((sum, b) => sum + b.totalDue, 0);
    const avgRate = normalized.reduce((sum, b) => sum + b.effectiveRate, 0) / totalBills;
    const avgVsMarket = normalized.reduce((sum, b) => sum + b.marketDiff, 0) / totalBills;
    const totalSupplySpend = normalized.reduce((sum, b) => sum + b.supplyCost, 0);
    const totalDeliverySpend = normalized.reduce((sum, b) => sum + b.deliveryCost, 0);
    const totalTaxesFees = normalized.reduce((sum, b) => sum + b.taxesFees, 0);
    const totalCredits = normalized.reduce((sum, b) => sum + b.credits, 0);
    currentSummaryMeta = {
        totalBills,
        totalSpent,
        avgRate,
        avgVsMarket,
        totalSupplySpend,
        totalDeliverySpend,
        totalTaxesFees,
        totalCredits,
        activeSeason: activeBillSeasonFilter
    };

    animateSlotNumber(document.getElementById('total-bills'), totalBills);
    animateSlotNumber(document.getElementById('total-spent'), '$' + totalSpent.toFixed(2));
    animateSlotNumber(document.getElementById('avg-effective-rate'), avgRate.toFixed(2) + '¢');
    animateSlotNumber(document.getElementById('avg-vs-market'), `${avgVsMarket > 0 ? '+' : ''}${avgVsMarket.toFixed(2)}¢`);
    updateBillsBreakdownChart({
        supply: totalSupplySpend,
        delivery: totalDeliverySpend,
        taxes: totalTaxesFees,
        credits: totalCredits
    });
}

function formatPercentChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

function buildMonthlyUsageSpendSeries(bills) {
    const monthMap = new Map();
    bills.forEach((bill) => {
        const parsed = normalizeBillRecord(bill);
        const monthDate = parsed.serviceStart || parsed.serviceEnd;
        if (!monthDate || Number.isNaN(monthDate.getTime())) return;

        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const entry = monthMap.get(key) || {
            key,
            label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            timestamp: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime(),
            totalKwh: 0,
            totalDue: 0,
            weightedRateNumerator: 0,
            hasCredits: false
        };

        entry.totalKwh += parsed.totalKwh;
        entry.totalDue += parsed.totalDue;
        entry.weightedRateNumerator += parsed.effectiveRate * parsed.totalKwh;
        entry.hasCredits = entry.hasCredits || parsed.hasCredits;
        monthMap.set(key, entry);
    });

    return Array.from(monthMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((entry) => ({
            ...entry,
            effectiveRate: entry.totalKwh > 0 ? entry.weightedRateNumerator / entry.totalKwh : 0
        }));
}

function buildUsageInsight(series) {
    const insightEl = document.getElementById('usage-vs-spend-insight');
    if (!insightEl) return;

    if (!series || series.length === 0) {
        insightEl.textContent = 'No bill data available for this filter yet.';
        return;
    }

    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;

    if (!previous) {
        insightEl.textContent = `${latest.label}: ${Math.round(latest.totalKwh).toLocaleString()} kWh and $${latest.totalDue.toFixed(2)} total due (${latest.effectiveRate.toFixed(2)}¢/kWh).`;
        return;
    }

    const usagePct = formatPercentChange(latest.totalKwh, previous.totalKwh);
    const spendPct = formatPercentChange(latest.totalDue, previous.totalDue);
    const usageWord = usagePct === null ? 'shifted' : usagePct >= 0 ? 'increased' : 'decreased';
    const spendWord = spendPct === null ? 'shifted' : spendPct >= 0 ? 'increased' : 'decreased';
    const usagePart = usagePct === null ? '' : `usage ${usageWord} ${Math.abs(usagePct).toFixed(0)}%`;
    const spendPart = spendPct === null ? '' : `spend ${spendWord} ${Math.abs(spendPct).toFixed(0)}%`;
    const connector = usagePart && spendPart ? ' while ' : '';
    const creditNote = latest.hasCredits ? ' Credits were applied.' : '';

    insightEl.textContent = `In ${latest.label}, ${usagePart}${connector}${spendPart}. Effective rate was ${latest.effectiveRate.toFixed(2)}¢/kWh.${creditNote}`;
}

function renderUsageVsSpendChart(bills) {
    const canvas = document.getElementById('usage-vs-spend-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (!bills || bills.length === 0) {
        if (usageVsSpendChart) {
            usageVsSpendChart.destroy();
            usageVsSpendChart = null;
        }
        buildUsageInsight([]);
        return;
    }

    const monthlySeries = buildMonthlyUsageSpendSeries(bills);
    buildUsageInsight(monthlySeries);

    if (!monthlySeries.length) {
        if (usageVsSpendChart) {
            usageVsSpendChart.destroy();
            usageVsSpendChart = null;
        }
        return;
    }

    const labels = monthlySeries.map((row) => row.label);
    const kwhData = monthlySeries.map((row) => Number(row.totalKwh.toFixed(2)));
    const spendData = monthlySeries.map((row) => Number(row.totalDue.toFixed(2)));
    const rateData = monthlySeries.map((row) => Number(row.effectiveRate.toFixed(2)));
    const latestIndex = monthlySeries.length - 1;

    if (usageVsSpendChart) usageVsSpendChart.destroy();

    usageVsSpendChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Usage (kWh)',
                    data: kwhData,
                    yAxisID: 'yKwh',
                    borderRadius: 8,
                    maxBarThickness: 24,
                    backgroundColor: kwhData.map((_, idx) =>
                        idx === latestIndex ? 'rgba(16, 185, 129, 0.55)' : 'rgba(45, 212, 191, 0.22)'
                    ),
                    borderColor: kwhData.map((_, idx) =>
                        idx === latestIndex ? 'rgba(16, 185, 129, 0.95)' : 'rgba(45, 212, 191, 0.5)'
                    ),
                    borderWidth: 1
                },
                {
                    type: 'line',
                    label: 'Total Due ($)',
                    data: spendData,
                    yAxisID: 'ySpend',
                    borderColor: 'rgba(96, 165, 250, 0.95)',
                    backgroundColor: 'rgba(96, 165, 250, 0.15)',
                    pointBackgroundColor: spendData.map((_, idx) =>
                        idx === latestIndex ? 'rgba(37, 99, 235, 1)' : 'rgba(147, 197, 253, 0.9)'
                    ),
                    pointRadius: spendData.map((_, idx) => (idx === latestIndex ? 4 : 2.5)),
                    pointHoverRadius: 5,
                    borderWidth: 2.25,
                    tension: 0.3
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
                        color: '#d4d4d8',
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(9, 9, 11, 0.95)',
                    borderColor: 'rgba(63, 63, 70, 0.9)',
                    borderWidth: 1,
                    titleColor: '#fafafa',
                    bodyColor: '#e4e4e7',
                    callbacks: {
                        afterBody: (tooltipItems) => {
                            const index = tooltipItems?.[0]?.dataIndex ?? 0;
                            const row = monthlySeries[index];
                            if (!row) return [];
                            const notes = [`Effective Rate: ${rateData[index].toFixed(2)}¢/kWh`];
                            if (row.hasCredits) notes.push('Credits applied');
                            return notes;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(63, 63, 70, 0.2)'
                    },
                    ticks: {
                        color: '#a1a1aa'
                    }
                },
                yKwh: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(63, 63, 70, 0.24)'
                    },
                    ticks: {
                        color: '#99f6e4',
                        callback: (value) => `${Math.round(value).toLocaleString()}`
                    },
                    title: {
                        display: true,
                        text: 'kWh',
                        color: '#99f6e4'
                    }
                },
                ySpend: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: '#bfdbfe',
                        callback: (value) => `$${Number(value).toFixed(0)}`
                    },
                    title: {
                        display: true,
                        text: 'Total Due ($)',
                        color: '#bfdbfe'
                    }
                }
            }
        }
    });
}

function hideLiveStatDetail() {
    const panel = document.getElementById('live-stat-detail');
    hideScorecardDetailPanel(panel);
    document.querySelectorAll('[data-live-stat-detail]').forEach((card) => card.classList.remove('active-scorecard'));
    activeLiveDetailKey = null;
}

function hideBillsSummaryDetail() {
    const panel = document.getElementById('bills-summary-detail');
    hideScorecardDetailPanel(panel);
    document.querySelectorAll('[data-bills-summary-detail]').forEach((card) => card.classList.remove('active-scorecard'));
    activeBillsDetailKey = null;
}

function showScorecardDetailPanel(panel) {
    if (!panel) return;
    if (panel._hideTimer) {
        clearTimeout(panel._hideTimer);
        panel._hideTimer = null;
    }
    panel.classList.remove('hidden');
    panel.classList.remove('pop-out');
    panel.classList.remove('pop-in');
    requestAnimationFrame(() => panel.classList.add('pop-in'));
}

function hideScorecardDetailPanel(panel) {
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel._hideTimer) {
        clearTimeout(panel._hideTimer);
        panel._hideTimer = null;
    }
    panel.classList.remove('pop-in');
    panel.classList.add('pop-out');
    panel._hideTimer = setTimeout(() => {
        panel.classList.add('hidden');
        panel.classList.remove('pop-out');
        panel._hideTimer = null;
    }, 180);
}

function showLiveStatDetail(type) {
    const panel = document.getElementById('live-stat-detail');
    if (!panel) return;
    if (!currentLiveStatMeta) {
        panel.innerHTML = `<div class="scorecard-detail-content"><div class="scorecard-detail-title">Loading</div><div class="scorecard-detail-subtitle">Waiting for live pricing data to load.</div></div>`;
        showScorecardDetailPanel(panel);
        return;
    }
    if (activeLiveDetailKey === type && !panel.classList.contains('hidden')) {
        hideLiveStatDetail();
        return;
    }

    const hoursText = currentFilterHours < 24 ? `${currentFilterHours} hours` : `${Math.round(currentFilterHours / 24)} days`;
    let title = '';
    let value = '';
    let subtitle = '';

    if (type === 'avg') {
        title = `AVG PRICE (${hoursText})`;
        value = formatLivePrice(currentLiveStatMeta.avg);
        subtitle = formatDateRange(currentLiveStatMeta.earliestRow?.recorded_at, currentLiveStatMeta.latestRow?.recorded_at);
    } else if (type === 'high') {
        title = `HIGH PRICE (${hoursText})`;
        value = formatLivePrice(currentLiveStatMeta.high);
        subtitle = `Recorded ${formatFriendlyDateTime(currentLiveStatMeta.highRow?.recorded_at)}.`;
    } else {
        title = `LOW PRICE (${hoursText})`;
        value = formatLivePrice(currentLiveStatMeta.low);
        subtitle = `Recorded ${formatFriendlyDateTime(currentLiveStatMeta.lowRow?.recorded_at)}.`;
    }

    panel.innerHTML = `<div class="scorecard-detail-content"><div class="scorecard-detail-title">${title}</div><div class="scorecard-detail-value">${value}</div><div class="scorecard-detail-subtitle">${subtitle}</div></div>`;
    showScorecardDetailPanel(panel);
    document.querySelectorAll('[data-live-stat-detail]').forEach((card) => {
        card.classList.toggle('active-scorecard', card.dataset.liveStatDetail === type);
    });
    activeLiveDetailKey = type;
}

function showBillsSummaryDetail(key) {
    const panel = document.getElementById('bills-summary-detail');
    if (!panel) return;
    if (!currentSummaryMeta) {
        panel.innerHTML = `<div class="scorecard-detail-content"><div class="scorecard-detail-title">Loading</div><div class="scorecard-detail-subtitle">Waiting for bill summary data to load.</div></div>`;
        showScorecardDetailPanel(panel);
        return;
    }
    if (activeBillsDetailKey === key && !panel.classList.contains('hidden')) {
        hideBillsSummaryDetail();
        return;
    }

    const seasonText = currentSummaryMeta.activeSeason === 'all'
        ? 'all seasons'
        : currentSummaryMeta.activeSeason;
    const detailMap = {
        'total-bills': {
            title: 'Total Bills',
            value: String(currentSummaryMeta.totalBills),
            subtitle: `Number of bills in the ${seasonText} filter.`
        },
        'total-spent': {
            title: 'Total Spent',
            value: formatDollarAmount(currentSummaryMeta.totalSpent),
            subtitle: `Sum of total due across bills in the ${seasonText} filter.`
        },
        'avg-effective-rate': {
            title: 'Avg Effective Rate',
            value: formatCents(currentSummaryMeta.avgRate),
            subtitle: 'Average all-in electricity rate you paid per kWh.'
        },
        'avg-vs-market': {
            title: 'Avg vs Market',
            value: `${currentSummaryMeta.avgVsMarket > 0 ? '+' : ''}${currentSummaryMeta.avgVsMarket.toFixed(2)}¢`,
            subtitle: 'Average difference between your effective rate and market average rate.'
        }
    };
    const detail = detailMap[key];
    if (!detail) return;

    panel.innerHTML = `<div class="scorecard-detail-content"><div class="scorecard-detail-title">${detail.title}</div><div class="scorecard-detail-value">${detail.value}</div><div class="scorecard-detail-subtitle">${detail.subtitle}</div></div>`;
    showScorecardDetailPanel(panel);
    document.querySelectorAll('[data-bills-summary-detail]').forEach((card) => {
        card.classList.toggle('active-scorecard', card.dataset.billsSummaryDetail === key);
    });
    activeBillsDetailKey = key;
}

function updateBillsBreakdownChart(totals) {
    const chartEl = document.getElementById('bill-breakdown-chart');
    const captionEl = document.getElementById('bill-breakdown-caption');
    if (!chartEl) return;

    if (billBreakdownChart) {
        billBreakdownChart.destroy();
    }

    const supply = Number(totals?.supply || 0);
    const delivery = Number(totals?.delivery || 0);
    const taxes = Number(totals?.taxes || 0);
    const credits = Number(totals?.credits || 0);
    const hasCreditsSlice = Math.abs(credits) > 0.004;
    const labels = ['Supply', 'Delivery', 'Taxes & Fees'];
    const values = [supply, delivery, taxes];
    const backgroundColor = ['#22c55e', '#38bdf8', '#f59e0b'];
    const borderColor = ['#14532d', '#0c4a6e', '#78350f'];
    if (hasCreditsSlice) {
        labels.push('Credits Applied');
        values.push(Math.abs(credits));
        backgroundColor.push('#a78bfa');
        borderColor.push('#5b21b6');
    }
    const total = values.reduce((sum, val) => sum + val, 0);

    if (!total) {
        if (captionEl) captionEl.textContent = 'No bill breakdown data yet';
        billBreakdownChart = new Chart(chartEl, {
            type: 'pie',
            data: {
                labels: ['No data'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#3f3f46'],
                    borderColor: ['#52525b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#a1a1aa', boxWidth: 10, padding: 12 }
                    },
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    if (captionEl) {
        const creditsText = hasCreditsSlice ? ` • Credits ${credits < 0 ? '-' : ''}${formatDollarAmount(Math.abs(credits))}` : '';
        captionEl.textContent = `Supply ${formatDollarAmount(supply)} • Delivery ${formatDollarAmount(delivery)} • Taxes & Fees ${formatDollarAmount(taxes)}${creditsText}`;
    }
    billBreakdownChart = new Chart(chartEl, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor,
                borderColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e4e4e7', boxWidth: 11, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = Number(context.raw || 0);
                            const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatDollarAmount(value)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function bindScorecardInteractions() {
    if (scorecardListenersBound) return;
    scorecardListenersBound = true;

    document.addEventListener('click', (event) => {
        const liveCard = event.target.closest('[data-live-stat-detail]');
        if (liveCard) {
            event.preventDefault();
            showLiveStatDetail(liveCard.dataset.liveStatDetail);
            return;
        }

        const billsCard = event.target.closest('[data-bills-summary-detail]');
        if (billsCard) {
            event.preventDefault();
            showBillsSummaryDetail(billsCard.dataset.billsSummaryDetail);
        }
    });
}

// ==================== HELPERS ====================
function formatDollarAmount(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

function formatCents(rate) {
    return parseFloat(rate).toFixed(2) + '¢';
}

function formatCentsCompact(rate) {
    return parseFloat(rate).toFixed(1) + '¢';
}

function formatFriendlyDateTime(timestamp) {
    if (!timestamp) return 'Unknown time';
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return 'Unknown time';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDateRange(startTimestamp, endTimestamp) {
    const start = new Date(startTimestamp);
    const end = new Date(endTimestamp);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Date range unavailable';
    const opts = { month: 'long', day: 'numeric' };
    return `${start.toLocaleDateString([], opts)} - ${end.toLocaleDateString([], opts)}`;
}

function showSkeleton() {}

function renderBillModalContent(parsed) {
    const diffColor = parsed.marketDiff > 0 ? 'text-red-400' : 'text-emerald-400';
    const seasonText = parsed.season ? String(parsed.season).toLowerCase() : 'n/a';
    const supplyRateText = parsed.supplyRate > 0 ? ` (${formatCentsCompact(parsed.supplyRate)}/kWh)` : '';
    const deliveryRateText = parsed.deliveryRate > 0 ? ` (${formatCentsCompact(parsed.deliveryRate)}/kWh)` : '';
    const marketDiffText = `${parsed.marketDiff > 0 ? '+' : ''}${parsed.marketDiff.toFixed(2)}¢ vs market`;

    const creditsRow = parsed.hasCredits
        ? `<div class="flex justify-between items-baseline">
                <div class="text-zinc-400">Credits Applied</div>
                <div class="font-semibold ${parsed.credits < 0 ? 'text-emerald-400' : 'text-red-400'}">${parsed.credits < 0 ? '-' : ''}${formatDollarAmount(Math.abs(parsed.credits))}</div>
           </div>`
        : '';

    return `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <div class="text-zinc-400 text-sm">Total kWh</div>
                <div class="text-3xl font-semibold">${Math.round(parsed.totalKwh)} kWh</div>
            </div>
            <div class="text-right">
                <div class="text-zinc-400 text-sm">Total Due</div>
                <div class="text-3xl font-semibold">${formatDollarAmount(parsed.totalDue)}</div>
            </div>
        </div>
        <div class="border-t border-zinc-700/80 pt-4 space-y-3">
            <div class="flex justify-between items-baseline">
                <div class="text-zinc-400">Supply (Energy)</div>
                <div class="font-semibold">${formatDollarAmount(parsed.supplyCost)}${supplyRateText}</div>
            </div>
            <div class="flex justify-between items-baseline">
                <div class="text-zinc-400">Delivery (Wires)</div>
                <div class="font-semibold">${formatDollarAmount(parsed.deliveryCost)}${deliveryRateText}</div>
            </div>
            <div class="flex justify-between items-baseline">
                <div class="text-zinc-400">Taxes & Fees</div>
                <div class="font-semibold">${formatDollarAmount(parsed.taxesFees)}</div>
            </div>
            ${creditsRow}
        </div>
        <div class="border-t border-zinc-700/80 pt-4 space-y-2">
            <div class="flex justify-between items-baseline">
                <div class="text-zinc-400">Effective Rate</div>
                <div class="text-4xl font-semibold">${formatCentsCompact(parsed.effectiveRate)}</div>
            </div>
            <div class="text-xs text-zinc-500 -mt-1">All-in average paid per kWh (supply + delivery + taxes & fees).</div>
            <div class="flex justify-between items-baseline">
                <div class="text-zinc-400">vs Market Average</div>
                <div class="text-3xl font-semibold ${diffColor}">${marketDiffText}</div>
            </div>
        </div>
        <div class="flex gap-2 pt-1 items-center">
            <span class="inline-flex px-3 py-1 rounded-full text-xs tracking-wide text-sky-300 bg-sky-500/10">${seasonText}</span>
            ${parsed.hasCredits ? '<span class="inline-flex px-3 py-1 rounded-full text-xs tracking-wide text-emerald-300 bg-emerald-500/10">Credits</span>' : ''}
        </div>
        <div class="border-t border-zinc-700/80 pt-4 mt-1">
            <div class="text-zinc-400 text-sm mb-2">Cost Breakdown</div>
            <div class="bill-record-chart-wrap">
                <canvas id="bill-record-breakdown-chart"></canvas>
            </div>
        </div>
        <button onclick="closeBillModal()" class="mt-2 w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl text-lg">Close</button>
    `;
}

async function showBillModal(bill) {
    const parsed = bill && (bill.serviceStart !== undefined || bill.raw) ? bill : normalizeBillRecord(bill || {});
    const modal = document.getElementById('bill-modal');
    const modalContent = document.getElementById('modal-content');
    const startText = parsed.serviceStart
        ? parsed.serviceStart.toLocaleDateString([], { month: 'long', year: 'numeric' })
        : 'Unknown';
    const endText = parsed.serviceEnd
        ? parsed.serviceEnd.toLocaleDateString([], { month: 'long', day: 'numeric' })
        : 'Unknown';

    document.getElementById('modal-period').innerHTML =
        `${startText} — ${endText} • ${formatKwh(parsed.totalKwh)} kWh`;
    modalContent.innerHTML = renderBillModalContent(parsed);
    renderBillRecordBreakdownChart(parsed);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('modal-open');

    const detailed = await fetchBillDetailData(parsed);
    if (detailed) {
        const hydrated = normalizeBillRecord({ ...(parsed.raw || {}), ...detailed });
        modalContent.innerHTML = renderBillModalContent(hydrated);
        renderBillRecordBreakdownChart(hydrated);
    }
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    if (!modal) return;
    if (billRecordBreakdownChart) {
        billRecordBreakdownChart.destroy();
        billRecordBreakdownChart = null;
    }
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function renderBillRecordBreakdownChart(parsed) {
    const chartEl = document.getElementById('bill-record-breakdown-chart');
    if (!chartEl) return;
    if (billRecordBreakdownChart) {
        billRecordBreakdownChart.destroy();
    }

    const supply = Number(parsed?.supplyCost || 0);
    const delivery = Number(parsed?.deliveryCost || 0);
    const taxes = Number(parsed?.taxesFees || 0);
    const credits = Number(parsed?.credits || 0);
    const hasCreditsSlice = Math.abs(credits) > 0.004;
    const labels = ['Supply', 'Delivery', 'Taxes & Fees'];
    const values = [supply, delivery, taxes];
    const backgroundColor = ['#22c55e', '#38bdf8', '#f59e0b'];
    const borderColor = ['#14532d', '#0c4a6e', '#78350f'];
    if (hasCreditsSlice) {
        labels.push('Credits Applied');
        values.push(Math.abs(credits));
        backgroundColor.push('#a78bfa');
        borderColor.push('#5b21b6');
    }
    const total = values.reduce((sum, val) => sum + val, 0);

    if (!total) {
        billRecordBreakdownChart = new Chart(chartEl, {
            type: 'pie',
            data: {
                labels: ['No data'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#3f3f46'],
                    borderColor: ['#52525b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a1a1aa', boxWidth: 10, padding: 10 } },
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    billRecordBreakdownChart = new Chart(chartEl, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor,
                borderColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#e4e4e7', boxWidth: 10, padding: 10 } },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = Number(context.raw || 0);
                            const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatDollarAmount(value)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function formatKwh(value) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return '0';
    return Math.round(parsed).toLocaleString();
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    bindScorecardInteractions();
    initializeSupabase();
});
window.addEventListener('pageshow', closeBillModal);

window.showLiveStatDetail = showLiveStatDetail;
window.showBillsSummaryDetail = showBillsSummaryDetail;
window.loadWeatherInsights = loadWeatherInsights;
window.toggleWeatherInsights = toggleWeatherInsights;
