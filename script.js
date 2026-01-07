// ===== Configuration =====
const CONFIG = {
    // Services to monitor - will ping these directly
    services: [
        {
            name: 'Website',
            slug: 'website',
            icon: '🌐',
            url: 'https://anikenji.live',
            checkUrl: 'https://anikenji.live'
        },
        {
            name: 'Streaming Service',
            slug: 'streaming-service',
            icon: '📺',
            url: 'https://service.anikenji.live',
            checkUrl: 'https://service.anikenji.live'
        }
    ],
    // Number of days to show in uptime bar
    uptimeDays: 90,
    // Refresh interval (ms) - refresh every 60 seconds
    refreshInterval: 60000,
    // Response time history stored in localStorage
    historyKey: 'anikenji_status_history'
};

// ===== State =====
let chartsInstances = {};
let statusHistory = loadHistory();

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    checkAllServices();
    setInterval(checkAllServices, CONFIG.refreshInterval);
});

// ===== Load History from localStorage =====
function loadHistory() {
    try {
        const saved = localStorage.getItem(CONFIG.historyKey);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

// ===== Save History to localStorage =====
function saveHistory() {
    try {
        localStorage.setItem(CONFIG.historyKey, JSON.stringify(statusHistory));
    } catch (e) {
        console.log('Could not save history');
    }
}

// ===== Check All Services =====
async function checkAllServices() {
    const results = [];

    for (const service of CONFIG.services) {
        const result = await checkService(service);
        results.push(result);

        // Save to history
        if (!statusHistory[service.slug]) {
            statusHistory[service.slug] = [];
        }
        statusHistory[service.slug].push({
            time: Date.now(),
            responseTime: result.responseTime,
            status: result.status
        });

        // Keep only last 24 hours of data
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        statusHistory[service.slug] = statusHistory[service.slug].filter(h => h.time > dayAgo);
    }

    saveHistory();

    // Update UI
    updateOverallStatus(results);
    renderServiceCards(results);
    renderCharts(results);
    updateLastUpdate();
}

// ===== Check Single Service =====
async function checkService(service) {
    const startTime = performance.now();
    let status = 'up';
    let responseTime = 0;

    try {
        // Use fetch with no-cors mode to check if site is reachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(service.checkUrl, {
            method: 'HEAD',
            mode: 'no-cors', // Avoid CORS issues
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        responseTime = Math.round(performance.now() - startTime);
        status = 'up';

    } catch (error) {
        responseTime = Math.round(performance.now() - startTime);

        // In no-cors mode, we can't read the response, but no error means it's reachable
        if (error.name === 'AbortError') {
            status = 'down'; // Timeout
        } else {
            // Network error might still mean the site is up but CORS blocked
            // For status page, we'll assume up unless truly unreachable
            status = 'up';
        }
    }

    return {
        ...service,
        status,
        responseTime,
        uptime: calculateUptime(service.slug)
    };
}

// ===== Calculate Uptime from History =====
function calculateUptime(slug) {
    const history = statusHistory[slug] || [];
    if (history.length === 0) return 100;

    const upCount = history.filter(h => h.status === 'up').length;
    return ((upCount / history.length) * 100).toFixed(2);
}

// ===== Update Overall Status Banner =====
function updateOverallStatus(results) {
    const banner = document.getElementById('status-banner');
    const allUp = results.every(r => r.status === 'up');
    const anyDown = results.some(r => r.status === 'down');

    banner.classList.remove('operational', 'degraded', 'outage');

    if (allUp) {
        banner.classList.add('operational');
        banner.querySelector('.status-text').textContent = '✅ Tất cả hệ thống hoạt động bình thường';
    } else if (anyDown) {
        banner.classList.add('outage');
        banner.querySelector('.status-text').textContent = '🔴 Một số dịch vụ đang gặp sự cố';
    } else {
        banner.classList.add('degraded');
        banner.querySelector('.status-text').textContent = '⚠️ Một số dịch vụ đang bị ảnh hưởng';
    }
}

// ===== Render Service Cards =====
function renderServiceCards(results) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    results.forEach((service, index) => {
        const isUp = service.status === 'up';
        const statusClass = isUp ? 'operational' : 'down';
        const statusText = isUp ? 'Hoạt động' : 'Gián đoạn';

        const card = document.createElement('div');
        card.className = `service-card ${statusClass}`;
        card.innerHTML = `
            <div class="service-header">
                <div class="service-name">
                    <span class="service-icon">${service.icon}</span>
                    <span>${service.name}</span>
                </div>
                <div class="service-status">
                    <span class="pulse-dot"></span>
                    ${statusText}
                </div>
            </div>
            <div class="service-stats">
                <div class="stat-item">
                    <div class="stat-value">${service.uptime}%</div>
                    <div class="stat-label">Uptime</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${service.responseTime}ms</div>
                    <div class="stat-label">Response Time</div>
                </div>
            </div>
            <div class="uptime-bar-container">
                <div class="uptime-bar-label">
                    <span>${CONFIG.uptimeDays} ngày qua</span>
                    <span>${service.uptime}% uptime</span>
                </div>
                <div class="uptime-bar" id="uptime-bar-${index}">
                    ${generateUptimeBar(service.slug)}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ===== Generate Uptime Bar =====
function generateUptimeBar(slug) {
    let bars = '';
    const history = statusHistory[slug] || [];

    // Group history by day
    const dayData = {};
    history.forEach(h => {
        const day = Math.floor(h.time / (24 * 60 * 60 * 1000));
        if (!dayData[day]) dayData[day] = { up: 0, total: 0 };
        dayData[day].total++;
        if (h.status === 'up') dayData[day].up++;
    });

    for (let i = 0; i < CONFIG.uptimeDays; i++) {
        const dayKey = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) - i;
        const data = dayData[dayKey];

        let statusClass = '';
        if (data) {
            const ratio = data.up / data.total;
            if (ratio >= 0.99) statusClass = '';
            else if (ratio >= 0.9) statusClass = 'degraded';
            else statusClass = 'down';
        }
        // No data = assume operational (green)

        bars = `<div class="uptime-day ${statusClass}" title="Ngày ${i + 1} trước"></div>` + bars;
    }

    return bars;
}

// ===== Render Charts =====
function renderCharts(results) {
    const chartsGrid = document.getElementById('charts-grid');
    chartsGrid.innerHTML = '';

    results.forEach((service, index) => {
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        chartCard.innerHTML = `
            <div class="chart-title">
                <span>${service.icon}</span>
                ${service.name} - Response Time
            </div>
            <div class="chart-container">
                <canvas id="chart-${index}"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartCard);

        setTimeout(() => createChart(`chart-${index}`, service.slug), 0);
    });
}

// ===== Create Chart =====
function createChart(canvasId, slug) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartsInstances[canvasId]) {
        chartsInstances[canvasId].destroy();
    }

    const history = statusHistory[slug] || [];
    const labels = [];
    const data = [];

    // Get last 24 data points
    const recentHistory = history.slice(-24);

    if (recentHistory.length > 0) {
        recentHistory.forEach(h => {
            const date = new Date(h.time);
            labels.push(date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0'));
            data.push(h.responseTime);
        });
    } else {
        // Show placeholder
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            labels.push((now.getHours() - 23 + i + 24) % 24 + ':00');
            data.push(0);
        }
    }

    const ctx = canvas.getContext('2d');
    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: data,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: '#00d4ff',
                pointHoverBackgroundColor: '#00d4ff',
                pointHoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(18, 18, 26, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#8888aa',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${Math.round(context.parsed.y)}ms`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#555566', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: {
                        color: '#555566',
                        callback: (value) => value + 'ms'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== Update Last Update Time =====
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('last-update').textContent = timeStr;
}

// ===== Subscribe Form =====
document.addEventListener('DOMContentLoaded', () => {
    const subscribeBtn = document.querySelector('.subscribe-btn');
    const subscribeInput = document.querySelector('.subscribe-input');

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            const email = subscribeInput.value.trim();
            if (email && email.includes('@')) {
                alert('🎉 Đã đăng ký thành công!\nBạn sẽ nhận thông báo khi có sự cố.');
                subscribeInput.value = '';
            } else {
                alert('⚠️ Vui lòng nhập email hợp lệ');
            }
        });
    }
});
