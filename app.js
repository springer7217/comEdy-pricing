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

// ==================== IMPROVED SLOT MACHINE ANIMATION ====================
function animateSlotNumber(element, targetValue, duration = 1200) {
    if (!element) return;

    const finalStr = String(targetValue);
    element.innerHTML = '';
    element.style.fontVariantNumeric = 'tabular-nums';

    // Split numeric part and suffix (e.g. "3.3" + "¢")
    const match = finalStr.match(/^([\d.]+)(.*)$/);
    if (!match) {
        element.textContent = finalStr;
        return;
    }

    const numericPart = match[1];
    const suffix = match[2] || '';

    const container = document.createElement('span');
    container.style.display = 'inline-flex';
    container.style.alignItems = 'flex-end';
    container.style.gap = '1px';

    // Animate each digit
    numericPart.split('').forEach((char, index) => {
        if (char === '.') {
            const dot = document.createElement('span');
            dot.textContent = '.';
            dot.style.padding = '0 1px';
            container.appendChild(dot);
            return;
        }

        const reelWrapper = document.createElement('span');
        reelWrapper.style.overflow = 'hidden';
        reelWrapper.style.display = 'inline-block';
        reelWrapper.style.height = '1em';
        reelWrapper.style.width = '0.55em';
        reelWrapper.style.position = 'relative';
        reelWrapper.style.verticalAlign = 'bottom';

        const reel = document.createElement('div');
        reel.style.position = 'absolute';
        reel.style.top = '0';
        reel.style.left = '0';
        reel.style.transition = `transform ${duration}ms cubic-bezier(0.23, 1, 0.32, 1)`;
        reel.style.willChange = 'transform';

        let stripHTML = '';
        const sets = 3;
        for (let s = 0; s < sets; s++) {
            for (let d = 0; d <= 9; d++) {
                stripHTML += `<div style="height:1em; line-height:1em; text-align:center;">${d}</div>`;
            }
        }
        reel.innerHTML = stripHTML;
        reelWrapper.appendChild(reel);
        container.appendChild(reelWrapper);

        const digit = parseInt(char);
        const digitHeightEm = 1;
        const totalDigits = 10 * sets;
        const finalTranslateY = -((totalDigits - 10 + digit) * digitHeightEm);

        reel.style.transform = `translateY(0)`;

        setTimeout(() => {
            reel.style.transform = `translateY(${finalTranslateY}em)`;
        }, 30 + (index * 50));
    });

    // Add suffix (¢, $, etc.)
    if (suffix) {
        const suffixSpan = document.createElement('span');
        suffixSpan.textContent = suffix;
        suffixSpan.style.marginLeft = '1px';
        container.appendChild(suffixSpan);
    }

    element.appendChild(container);
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
        billsContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        billsContent.style.opacity = '0';
        billsContent.style.transform = 'translateY(8px)';

        setTimeout(() => {
            billsContent.classList.add('hidden');
            liveContent.classList.remove('hidden');
            liveContent.style.opacity = '0';
            liveContent.style.transform = 'translateY(8px)';
            liveBtn.classList.add('active');

            requestAnimationFrame(() => {
                liveContent.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                liveContent.style.opacity = '1';
                liveContent.style.transform = 'translateY(0)';
            });
        }, 180);
    } else {
        liveContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        liveContent.style.opacity = '0';
        liveContent.style.transform = 'translateY(8px)';

        setTimeout(() => {
            liveContent.classList.add('hidden');
            billsContent.classList.remove('hidden');
            billsContent.style.opacity = '0';
            billsContent.style.transform = 'translateY(8px)';
            billsBtn.classList.add('active');

            requestAnimationFrame(() => {
                billsContent.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                billsContent.style.opacity = '1';
                billsContent.style.transform = 'translateY(0)';
            });
        }, 180);
    }
}

// ==================== SUPABASE ====================
function initializeSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        loadData();
        loadBills();
        initPullToRefresh();
        setInterval(() => loadData(false), 5 * 60 * 1000);
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
        filterData(currentFilterHours, false);
    } catch (err) {
        console.error('Error loading price data:', err);
        const recentList = document.getElementById('recent-list');
        if (recentList) {
            recentList.innerHTML = `
                <div class="text-center py-8 text-red-400 text-sm">
                    Failed to load price data.<br>
                    <button onclick="loadData(true)" class="mt-2 px-4 py-1 bg-zinc-800 rounded-xl text-sm">Retry</button>
                </div>
            `;
        }
    }
}

function filterData(hours, updateActive = true) {
    if (!allPriceData.length) return;
    currentFilterHours = hours;

    const hoursInMs = hours * 60 * 60 * 1000;
    const now = new Date();
    const filtered = allPriceData.filter(row => {
        const recordTime = new Date(row.recorded_at);
        return (now - recordTime) <= hoursInMs;
    });

    if (filtered.length === 0) return;

    const latest = allPriceData[0];
    const price = parseFloat(latest.price);

    animateSlotNumber(document.getElementById('current-price'), price.toFixed(1) + '¢');
    document.getElementById('current-emoji').innerHTML = getEmoji(price);
    document.getElementById('current-time').innerHTML = 
        `Updated ${new Date(latest.recorded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    const prices = filtered.map(r => parseFloat(r.price));
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    animateSlotNumber(document.getElementById('avg-price'), avg.toFixed(1) + '¢');
    animateSlotNumber(document.getElementById('high-price'), high.toFixed(1) + '¢');
    animateSlotNumber(document.getElementById('low-price'), low.toFixed(1) + '¢');

    updateChart(filtered);
    displayedCount = 5;
    renderRecentList(filtered);
}

function getEmoji(price) {
    if (price <= 8.0) return '🟢';
    if (price <= 10.0) return '🟡';
    return '🔴';
}

function renderRecentList(filteredData) {
    const container = document.getElementById('recent-list');
    container.innerHTML = '';

    const toShow = filteredData.slice(0, displayedCount);
    const isLongRange = currentFilterHours > 24;

    toShow.forEach(row => {
        const p = parseFloat(row.price);
        const time = new Date(row.recorded_at);

        const el = document.createElement('div');
        el.className = `flex items-center justify-between px-4 py-[13px] bg-zinc-900/70 border border-zinc-800 rounded-2xl`;

        if (isLongRange) {
            el.innerHTML = `
                <div class="flex items-center gap-3.5">
                    <span class="text-3xl">${getEmoji(p)}</span>
                    <div>
                        <div class="font-semibold text-xl tracking-tight">${p.toFixed(1)}<span class="text-sm font-normal text-zinc-400">¢</span></div>
                        <div class="text-[10px] text-zinc-500 -mt-0.5">
                            ${time.toLocaleDateString([], {month:'short', day:'numeric'})} · ${time.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}
                        </div>
                    </div>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="flex items-center gap-3.5">
                    <span class="text-3xl">${getEmoji(p)}</span>
                    <div>
                        <div class="font-semibold text-xl tracking-tight">${p.toFixed(1)}<span class="text-sm font-normal text-zinc-400">¢</span></div>
                    </div>
                </div>
                <div class="text-right text-xs text-zinc-400 font-mono">
                    ${time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
            `;
        }
        container.appendChild(el);
    });

    document.getElementById('reading-count').innerHTML = `${filteredData.length} readings`;
    document.getElementById('load-more-btn').style.display = (filteredData.length > displayedCount) ? 'block' : 'none';
}

function loadMore() {
    displayedCount += LOAD_MORE_AMOUNT;
    filterData(currentFilterHours, false);
}

// ==================== CHART ====================
function updateChart(data) {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;

    if (priceChart) priceChart.destroy();

    const labels = data.slice().reverse().map(r => {
        const d = new Date(r.recorded_at);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    });

    const prices = data.slice().reverse().map(r => parseFloat(r.price));

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price (¢)',
                data: prices,
                borderColor: '#22c55e',
                borderWidth: 2,
                tension: 0.3,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } } }
            }
        }
    });
}

// ==================== BILL FUNCTIONS ====================
async function loadBills() {
    try {
        const { data, error } = await supabaseClient
            .from('bills')
            .select('*')
            .order('service_start', { ascending: false });

        if (error) throw error;
        allBillsData = data || [];
        renderBillsList(allBillsData);
        renderSummaryStats(allBillsData);
    } catch (err) {
        console.error('Error loading bills:', err);
    }
}

function renderBillsList(bills) {
    const container = document.getElementById('bills-list');
    container.innerHTML = '';
    document.getElementById('bill-count').innerHTML = `${bills.length} bills`;

    bills.forEach(bill => {
        const el = document.createElement('div');
        el.className = 'bill-card glass border border-zinc-800 rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.985]';
        el.onclick = () => showBillModal(bill);

        const eff = parseFloat(bill.effective_rate) || 0;
        const diff = parseFloat(bill.market_vs_paid_diff) || 0;
        const diffColor = diff > 0 ? 'text-red-400' : 'text-emerald-400';

        el.innerHTML = `
            <div class="flex justify-between mb-3">
                <div>
                    <div class="font-semibold">${new Date(bill.service_start).toLocaleDateString([], {month:'short', year:'numeric'})} — ${new Date(bill.service_end).toLocaleDateString([], {month:'short', day:'numeric'})}</div>
                    <div class="text-xs text-zinc-400">${bill.days} days • ${bill.total_kwh} kWh</div>
                </div>
                <div class="text-right"><div class="font-semibold text-lg">${formatDollarAmount(bill.total_due)}</div></div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm">
                <div><div class="text-[10px] text-zinc-400">Effective Rate</div><div class="font-semibold">${formatCents(eff)}</div></div>
                <div><div class="text-[10px] text-zinc-400">vs Market</div><div class="font-semibold ${diffColor}">${diff > 0 ? '+' : ''}${diff.toFixed(2)}¢</div></div>
            </div>
        `;
        container.appendChild(el);
    });
}

function renderSummaryStats(bills) {
    if (!bills.length) return;

    const totalBills = bills.length;
    const totalSpent = bills.reduce((sum, b) => sum + (parseFloat(b.total_due) || 0), 0);
    const avgRate = bills.reduce((sum, b) => sum + (parseFloat(b.effective_rate) || 0), 0) / totalBills;

    animateSlotNumber(document.getElementById('total-bills'), totalBills);
    animateSlotNumber(document.getElementById('total-spent'), '$' + totalSpent.toFixed(2));
    animateSlotNumber(document.getElementById('avg-effective-rate'), avgRate.toFixed(2) + '¢');
}

function showBillModal(bill) {
    const modal = document.getElementById('bill-modal');
    const modalContent = modal.querySelector('.glass');

    document.getElementById('modal-period').innerHTML = 
        `${new Date(bill.service_start).toLocaleDateString([], {month:'long', year:'numeric'})} — ${new Date(bill.service_end).toLocaleDateString([], {month:'long', day:'numeric'})}`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    modalContent.style.transition = 'none';
    modalContent.style.transform = 'translateY(40px)';
    modalContent.style.opacity = '0';

    requestAnimationFrame(() => {
        modalContent.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease';
        modalContent.style.transform = 'translateY(0)';
        modalContent.style.opacity = '1';
    });
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    const modalContent = modal.querySelector('.glass');

    modalContent.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    modalContent.style.transform = 'translateY(30px)';
    modalContent.style.opacity = '0';

    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        modalContent.style.transform = '';
        modalContent.style.opacity = '';
    }, 180);
}

// ==================== HELPERS ====================
function formatDollarAmount(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

function formatCents(rate) {
    return parseFloat(rate).toFixed(2) + '¢';
}

function showSkeleton() {
    // Optional: expand later
}

function initPullToRefresh() {
    // Optional
}

function updateChart(data) {
    // Already defined above
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', initializeSupabase);
